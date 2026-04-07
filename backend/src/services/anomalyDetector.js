/**
 * Charge amount anomaly detector.
 *
 * Flags when a newly detected subscription amount deviates significantly
 * from the user's historical average for that merchant.
 *
 * Logic:
 *   - Fetch the last N subscription amounts for (user, merchant)
 *   - Compute mean and std deviation
 *   - If |current - mean| > threshold * std (or > FLAT_THRESHOLD when std is small)
 *     → flag as anomalous
 *
 * Anomalies are written to subscription_events with is_anomalous=true.
 */

import pool from './dbPool.js';

const HISTORY_LIMIT  = 12;   // look back at last 12 detected amounts
const Z_THRESHOLD    = 2.0;  // flag if > 2 std deviations from mean
const FLAT_THRESHOLD = 0.20; // flag if > 20% change when std is near zero

/**
 * Check whether a new amount is anomalous for this user+merchant.
 *
 * @returns {{ isAnomalous: boolean, mean: number|null, zScore: number|null }}
 */
export async function detectAmountAnomaly(userId, merchant, amount) {
  if (amount == null || amount <= 0) {
    return { isAnomalous: false, mean: null, zScore: null };
  }

  // Fetch historical amounts from subscription_events for this merchant
  const { rows } = await pool.query(
    `SELECT se.amount
     FROM subscription_events se
     JOIN subscriptions s ON s.id = se.subscription_id
     WHERE se.user_id = $1
       AND s.merchant = $2
       AND se.amount IS NOT NULL
       AND se.amount > 0
     ORDER BY se.detected_at DESC
     LIMIT $3`,
    [userId, merchant, HISTORY_LIMIT]
  );

  if (rows.length < 2) {
    // Not enough history to detect anomalies
    return { isAnomalous: false, mean: null, zScore: null };
  }

  const amounts = rows.map((r) => Number(r.amount));
  const mean    = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / amounts.length;
  const std      = Math.sqrt(variance);

  let isAnomalous = false;
  let zScore      = null;

  if (std < 0.01) {
    // Essentially a fixed price — flag if > 20% change
    isAnomalous = Math.abs(amount - mean) / mean > FLAT_THRESHOLD;
  } else {
    zScore      = Math.abs(amount - mean) / std;
    isAnomalous = zScore > Z_THRESHOLD;
  }

  return { isAnomalous, mean: Math.round(mean * 100) / 100, zScore: zScore ? Math.round(zScore * 100) / 100 : null };
}

/**
 * Write a subscription_events row for a detected charge.
 * Sets is_anomalous based on anomaly detection result.
 */
export async function recordSubscriptionEvent(userId, subscriptionId, { amount, source, isAnomalous = false }) {
  try {
    await pool.query(
      `INSERT INTO subscription_events (user_id, subscription_id, event_type, amount, source, is_anomalous)
       VALUES ($1, $2, 'detected', $3, $4, $5)`,
      [userId, subscriptionId, amount ?? null, source ?? null, isAnomalous]
    );
  } catch {
    // Non-fatal — event logging should not break the scan flow
  }
}
