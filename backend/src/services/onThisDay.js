/**
 * On-This-Day
 *
 * Returns data about what the user's subscriptions looked like exactly 1 year ago.
 * Used on the home screen to re-engage users annually.
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

/**
 * Returns on-this-day data for a user, or null if the user hasn't been on BIB for a year.
 *
 * @returns {object|null}
 */
export async function getOnThisDay(userId) {
  // Check first_scan_at — must be at least 364 days ago
  const { rows: profileRows } = await pool.query(
    `SELECT first_scan_at FROM profiles WHERE id = $1`,
    [userId]
  );
  if (!profileRows.length) return null;

  const firstScan = profileRows[0].first_scan_at;
  if (!firstScan) return null;

  const daysSinceFirstScan = Math.floor(
    (Date.now() - new Date(firstScan).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceFirstScan < 364) return null;

  // Subscriptions that were active (created before, not yet cancelled) ~1 year ago
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoISO = oneYearAgo.toISOString();

  // Window: ±1 day around the 365-day mark
  const windowStart = new Date(oneYearAgo.getTime() - 86400000).toISOString();
  const windowEnd   = new Date(oneYearAgo.getTime() + 86400000).toISOString();

  // Monthly spend then: use subscription_price_history records from the window
  const { rows: historyRows } = await pool.query(
    `SELECT DISTINCT ON (ph.subscription_id) ph.subscription_id, ph.amount, ph.currency,
            s.merchant, s.billing_interval
     FROM subscription_price_history ph
     JOIN subscriptions s ON s.id = ph.subscription_id
     WHERE ph.user_id = $1
       AND ph.detected_at BETWEEN $2 AND $3`,
    [userId, windowStart, windowEnd]
  );

  // Price increases since then
  const { rows: increaseRows } = await pool.query(
    `SELECT s.merchant, e.metadata
     FROM subscription_events e
     JOIN subscriptions s ON s.id = e.subscription_id
     WHERE e.user_id = $1 AND e.event_type = 'price_increase'
       AND e.created_at > $2`,
    [userId, oneYearAgoISO]
  );

  // Monthly total then
  let monthlySpendThen = 0;
  for (const row of historyRows) {
    const amt = Number(row.amount || 0);
    switch (row.billing_interval) {
      case 'weekly':    monthlySpendThen += amt * 52 / 12; break;
      case 'monthly':   monthlySpendThen += amt; break;
      case 'quarterly': monthlySpendThen += amt / 3; break;
      case 'yearly':    monthlySpendThen += amt / 12; break;
      default:          monthlySpendThen += amt; break;
    }
  }
  monthlySpendThen = Math.round(monthlySpendThen * 100) / 100;

  // Current monthly total
  const { rows: currentRows } = await pool.query(
    `SELECT renewal_amount, billing_interval FROM subscriptions
     WHERE user_id = $1 AND is_active = true AND renewal_amount > 0`,
    [userId]
  );

  let monthlySpendNow = 0;
  for (const row of currentRows) {
    const amt = Number(row.renewal_amount || 0);
    switch (row.billing_interval) {
      case 'weekly':    monthlySpendNow += amt * 52 / 12; break;
      case 'monthly':   monthlySpendNow += amt; break;
      case 'quarterly': monthlySpendNow += amt / 3; break;
      case 'yearly':    monthlySpendNow += amt / 12; break;
      default:          monthlySpendNow += amt; break;
    }
  }
  monthlySpendNow = Math.round(monthlySpendNow * 100) / 100;

  // Only return data if we have something meaningful from a year ago
  if (monthlySpendThen === 0 && historyRows.length === 0) return null;

  return {
    monthlySpendThen,
    monthlySpendNow,
    netChange:      Math.round((monthlySpendNow - monthlySpendThen) * 100) / 100,
    subsOneYearAgo: historyRows.map(r => r.merchant),
    priceIncreases: increaseRows.map(r => ({
      merchant: r.merchant,
      metadata: r.metadata,
    })),
  };
}
