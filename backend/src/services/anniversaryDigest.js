/**
 * Yearly Subscription Audit Notification (Feature 7)
 *
 * On each user's BIB anniversary (1 year after first_scan_at), sends a digest
 * summarising their year: total spend, price increases, cancellations.
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
 * Check for users whose BIB anniversary is today and send them a digest.
 * Called daily from node-cron at 09:00.
 */
export async function checkAnniversaryDigests(logger = console) {
  // Find users whose first_scan_at was exactly 1 year ago (by calendar date)
  const { rows: users } = await pool.query(
    `SELECT id
     FROM profiles
     WHERE first_scan_at IS NOT NULL
       AND DATE_TRUNC('day', first_scan_at) = DATE_TRUNC('day', now() - INTERVAL '1 year')`
  );

  for (const user of users) {
    try {
      await sendAnniversaryDigest(user.id, logger);
    } catch (err) {
      logger.warn?.({ err, userId: user.id }, '[anniversary] digest failed');
    }
  }
}

async function sendAnniversaryDigest(userId, logger) {
  // Dedup: only once per user per year
  const { rowCount } = await pool.query(
    `INSERT INTO subscription_events (user_id, event_type, metadata)
     VALUES ($1, 'anniversary_digest', $2)
     ON CONFLICT DO NOTHING`,
    [userId, JSON.stringify({ year: new Date().getFullYear() })]
  );
  if (rowCount === 0) return;

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoISO = oneYearAgo.toISOString();

  // Total spend: sum of all price history records in last 12 months
  const { rows: spendRows } = await pool.query(
    `SELECT COALESCE(SUM(ph.amount), 0) AS total_spend
     FROM subscription_price_history ph
     WHERE ph.user_id = $1 AND ph.detected_at >= $2`,
    [userId, oneYearAgoISO]
  );
  const totalSpend = Number(spendRows[0]?.total_spend || 0);

  // Price increases in last 12 months
  const { rows: increaseRows } = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM subscription_events
     WHERE user_id = $1 AND event_type = 'price_increase' AND created_at >= $2`,
    [userId, oneYearAgoISO]
  );
  const priceIncreases = Number(increaseRows[0]?.cnt || 0);

  // Cancellations in last 12 months
  const { rows: cancelRows } = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM subscriptions
     WHERE user_id = $1 AND user_status = 'cancelled' AND updated_at >= $2`,
    [userId, oneYearAgoISO]
  );
  const cancellations = Number(cancelRows[0]?.cnt || 0);

  const spendStr    = `$${totalSpend.toFixed(2)}`;
  const increaseStr = priceIncreases === 1 ? '1 price increased' : `${priceIncreases} prices increased`;
  const cancelStr   = cancellations === 1 ? 'you cancelled 1 service' : `you cancelled ${cancellations} services`;

  const body = `You paid ${spendStr} in subscriptions. ${increaseStr}. ${cancelStr}.`;

  await sendPushToUser(userId,
    'Your BIB year in review',
    body,
    { type: 'anniversary_digest', totalSpend, priceIncreases, cancellations },
    logger
  );

  logger.info?.({ userId, totalSpend, priceIncreases, cancellations }, '[anniversary] digest sent');
}
