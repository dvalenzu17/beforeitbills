/**
 * Price Change Detection
 *
 * Maintains a per-subscription price history and detects increases/decreases.
 * Called after every background scan, once subscriptions have been upserted.
 */

import pg from 'pg';
import { dispatchImmediate, dispatchDigest } from './notificationDispatcher.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

/**
 * Insert a price history record for a subscription.
 */
export async function recordPriceHistory(subscriptionId, userId, amount, currency = 'USD') {
  await pool.query(
    `INSERT INTO subscription_price_history (subscription_id, user_id, amount, currency)
     VALUES ($1, $2, $3, $4)`,
    [subscriptionId, userId, amount, currency]
  );
}

/**
 * Compare current amount against latest stored history for a merchant.
 * Returns null if no change (or no prior history).
 * Returns { direction, oldAmount, newAmount, delta, subscriptionId } on change.
 */
export async function detectPriceChange(userId, merchant, newAmount, currency = 'USD') {
  if (newAmount == null) return null;

  const { rows: subs } = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND merchant = $2 LIMIT 1`,
    [userId, merchant]
  );
  if (!subs.length) return null;
  const subscriptionId = subs[0].id;

  const { rows: history } = await pool.query(
    `SELECT amount FROM subscription_price_history
     WHERE subscription_id = $1
     ORDER BY detected_at DESC
     LIMIT 1`,
    [subscriptionId]
  );

  if (!history.length) {
    await recordPriceHistory(subscriptionId, userId, newAmount, currency);
    return null;
  }

  const oldAmount = Number(history[0].amount);
  const current   = Number(newAmount);

  if (Math.abs(current - oldAmount) < 0.01) return null;

  await recordPriceHistory(subscriptionId, userId, current, currency);

  return {
    subscriptionId,
    direction: current > oldAmount ? 'increase' : 'decrease',
    oldAmount,
    newAmount: current,
    delta: Math.abs(current - oldAmount),
  };
}

/**
 * Record an event in subscription_events with application-level dedup.
 * Replaces the ON CONFLICT approach (not possible with timestamptz in index).
 */
async function recordEventIfNew(subscriptionId, userId, eventType, metadata, windowDays = 30) {
  const { rows } = await pool.query(
    `SELECT id FROM subscription_events
     WHERE subscription_id = $1 AND event_type = $2
       AND created_at > now() - ($3 || ' days')::interval
     LIMIT 1`,
    [subscriptionId, eventType, windowDays]
  );
  if (rows.length) return false; // already recorded

  await pool.query(
    `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, now())`,
    [subscriptionId, userId, eventType, JSON.stringify(metadata)]
  );
  return true;
}

/**
 * Run price change detection for all detected subscriptions from a scan.
 */
export async function processPriceChanges(userId, detectedSubs, logger = console) {
  const results = [];

  for (const sub of (detectedSubs || [])) {
    if (sub.amount == null) continue;

    try {
      const change = await detectPriceChange(userId, sub.merchant, sub.amount, sub.currency || 'USD');
      if (!change) continue;

      results.push({ merchant: sub.merchant, ...change });

      const payload = {
        subscriptionId: change.subscriptionId,
        merchant: sub.merchant,
        oldAmount: change.oldAmount,
        newAmount: change.newAmount,
        currency: sub.currency || 'USD',
      };

      if (change.direction === 'increase') {
        const isNew = await recordEventIfNew(change.subscriptionId, userId, 'price_increase', payload, 30);
        if (isNew) {
          await dispatchImmediate(userId, 'price_increase', payload, logger);
        }
      } else {
        const isNew = await recordEventIfNew(change.subscriptionId, userId, 'price_decrease', payload, 30);
        if (isNew) {
          await dispatchDigest(userId, 'price_decrease', payload);
        }
      }
    } catch (err) {
      logger.warn?.({ err, merchant: sub.merchant }, '[price-change] error');
    }
  }

  return results;
}
