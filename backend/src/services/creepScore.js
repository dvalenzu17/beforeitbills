/**
 * Subscription Creep Score
 *
 * Score = (current monthly total / baseline monthly total at first scan) × 100
 * Baseline is set permanently on first scan.
 * Recomputed after every background scan.
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
 * Compute the current monthly total for a user across all active subscriptions.
 * Normalises all cadences to a monthly-equivalent amount.
 */
export async function computeMonthlyTotal(userId) {
  const { rows } = await pool.query(
    `SELECT renewal_amount, billing_interval
     FROM subscriptions
     WHERE user_id = $1
       AND is_active = true
       AND renewal_amount IS NOT NULL
       AND renewal_amount > 0`,
    [userId]
  );

  let total = 0;
  for (const row of rows) {
    const amount = Number(row.renewal_amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    switch (row.billing_interval) {
      case 'weekly':    total += amount * 52 / 12; break;
      case 'monthly':   total += amount; break;
      case 'quarterly': total += amount / 3; break;
      case 'yearly':    total += amount / 12; break;
      default:          total += amount; break; // assume monthly
    }
  }

  return Math.round(total * 100) / 100;
}

/**
 * Update the creep score for a user after a scan.
 * Sets baseline on first call, then computes score on subsequent calls.
 */
export async function updateCreepScore(userId, logger = console) {
  try {
    const current = await computeMonthlyTotal(userId);

    // Fetch existing baseline
    const { rows } = await pool.query(
      `SELECT baseline_monthly_spend FROM profiles WHERE id = $1`,
      [userId]
    );
    if (!rows.length) return;

    const baseline = rows[0].baseline_monthly_spend != null
      ? Number(rows[0].baseline_monthly_spend)
      : null;

    if (baseline == null) {
      // First scan — set baseline, score starts at 100
      await pool.query(
        `UPDATE profiles
         SET baseline_monthly_spend = $2,
             current_creep_score    = 100,
             first_scan_at          = COALESCE(first_scan_at, now())
         WHERE id = $1`,
        [userId, current]
      );
      return;
    }

    // Avoid division by zero if user had $0 at baseline
    const score = baseline > 0
      ? Math.round((current / baseline) * 100)
      : 100;

    await pool.query(
      `UPDATE profiles SET current_creep_score = $2 WHERE id = $1`,
      [userId, score]
    );
  } catch (err) {
    logger.warn?.({ err, userId }, '[creep-score] update failed');
  }
}

/**
 * Return the current creep score and metadata for a user.
 */
export async function getCreepScore(userId) {
  const { rows } = await pool.query(
    `SELECT baseline_monthly_spend, current_creep_score, first_scan_at
     FROM profiles WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return null;

  const row      = rows[0];
  const score    = row.current_creep_score != null ? Number(row.current_creep_score) : null;
  const baseline = row.baseline_monthly_spend != null ? Number(row.baseline_monthly_spend) : null;
  const current  = baseline != null && score != null
    ? Math.round((baseline * score / 100) * 100) / 100
    : null;

  let label = null;
  if (score != null) {
    if (score <= 100)      label = 'On track';
    else if (score <= 120) label = 'Growing';
    else                   label = 'High';
  }

  return {
    score,
    baseline,
    current,
    label,
    firstScanAt: row.first_scan_at,
  };
}
