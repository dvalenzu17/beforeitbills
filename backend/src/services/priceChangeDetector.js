/**
 * Price Change Detection
 *
 * Maintains a per-subscription price history and detects increases/decreases.
 * Called after every background scan, once subscriptions have been upserted.
 */

import pg from 'pg';
import { sendPushToUser } from './pushService.js';

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
 *
 * @param {string} userId
 * @param {string} merchant
 * @param {number|null} newAmount
 * @param {string} currency
 */
export async function detectPriceChange(userId, merchant, newAmount, currency = 'USD') {
  if (newAmount == null) return null;

  // Look up subscription id
  const { rows: subs } = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND merchant = $2 LIMIT 1`,
    [userId, merchant]
  );
  if (!subs.length) return null;
  const subscriptionId = subs[0].id;

  // Latest history entry for this subscription
  const { rows: history } = await pool.query(
    `SELECT amount FROM subscription_price_history
     WHERE subscription_id = $1
     ORDER BY detected_at DESC
     LIMIT 1`,
    [subscriptionId]
  );

  if (!history.length) {
    // First time we see this merchant — establish baseline, no alert
    await recordPriceHistory(subscriptionId, userId, newAmount, currency);
    return null;
  }

  const oldAmount = Number(history[0].amount);
  const current   = Number(newAmount);

  // No meaningful change (within 1 cent tolerance)
  if (Math.abs(current - oldAmount) < 0.01) return null;

  // Record new price
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
 * Run price change detection for all detected subscriptions from a scan.
 * Fires push notification on price increases.
 * Decreases are recorded silently (surfaced in annual digest).
 *
 * @param {string}   userId
 * @param {Array}    detectedSubs  - Array of subscription objects from detectRecurringSubscriptions
 * @param {object}   logger
 */
export async function processPriceChanges(userId, detectedSubs, logger = console) {
  const results = [];

  for (const sub of (detectedSubs || [])) {
    if (sub.amount == null) continue;

    try {
      const change = await detectPriceChange(userId, sub.merchant, sub.amount, sub.currency || 'USD');
      if (!change) continue;

      results.push({ merchant: sub.merchant, ...change });

      if (change.direction === 'increase') {
        const sym = currencySymbol(sub.currency);
        const title = `Price increase: ${sub.merchant}`;
        const body  = `Went from ${sym}${change.oldAmount.toFixed(2)} to ${sym}${change.newAmount.toFixed(2)}`;

        await sendPushToUser(userId, title, body, {
          type: 'price_increase',
          merchant: sub.merchant,
          oldAmount: change.oldAmount,
          newAmount: change.newAmount,
        }, logger);

        // Record event for deduplication / digest
        await pool.query(
          `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata)
           VALUES ($1, $2, 'price_increase', $3)
           ON CONFLICT DO NOTHING`,
          [change.subscriptionId, userId, JSON.stringify({ old: change.oldAmount, new: change.newAmount })]
        ).catch(() => {});
      }

      if (change.direction === 'decrease') {
        // Record for digest — no push
        await pool.query(
          `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata)
           VALUES ($1, $2, 'price_decrease', $3)
           ON CONFLICT DO NOTHING`,
          [change.subscriptionId, userId, JSON.stringify({ old: change.oldAmount, new: change.newAmount })]
        ).catch(() => {});
      }
    } catch (err) {
      logger.warn?.({ err, merchant: sub.merchant }, '[price-change] error processing merchant');
    }
  }

  return results;
}

function currencySymbol(currency) {
  switch ((currency || 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'CAD': return 'CA$';
    default:    return `${currency} `;
  }
}
