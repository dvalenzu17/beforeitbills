/**
 * Guardian Streak
 *
 * Tracks how many consecutive weeks the user's email has been scanned.
 * BIB is not a daily-use app — streaks are weekly (8-day window to accommodate
 * the 6-hour background scan cadence and weekends).
 *
 * Milestones: 4 weeks, 12 weeks, 52 weeks.
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const STREAK_WINDOW_DAYS = 8; // scan within 8 days = streak continues

/**
 * Update streak after a successful background scan.
 * Called from backgroundScanner.runBackgroundScanForUser.
 */
export async function updateStreak(userId, logger = console) {
  try {
    const { rows } = await pool.query(
      `SELECT streak_count, streak_last_updated FROM profiles WHERE id = $1`,
      [userId]
    );
    if (!rows.length) return;

    const { streak_count, streak_last_updated } = rows[0];
    const today = new Date().toISOString().slice(0, 10);

    if (!streak_last_updated) {
      // First scan ever
      await pool.query(
        `UPDATE profiles SET streak_count = 1, streak_last_updated = $2, streak_broken_at = NULL
         WHERE id = $1`,
        [userId, today]
      );
      return;
    }

    const lastUpdated = new Date(streak_last_updated);
    const daysSince   = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince === 0) return; // already updated today

    if (daysSince <= STREAK_WINDOW_DAYS) {
      // Streak continues — only increment if a full 7-day week has passed
      if (daysSince >= 7) {
        const newCount = (streak_count || 0) + 1;
        await pool.query(
          `UPDATE profiles SET streak_count = $2, streak_last_updated = $3, streak_broken_at = NULL
           WHERE id = $1`,
          [userId, newCount, today]
        );
        logger.info?.({ userId, newCount }, '[streak] incremented');
      }
      // else: within the week, just update timestamp to reset the window
      else {
        await pool.query(
          `UPDATE profiles SET streak_last_updated = $2 WHERE id = $1`,
          [userId, today]
        );
      }
    } else {
      // Streak broken
      await pool.query(
        `UPDATE profiles SET streak_count = 0, streak_last_updated = $2, streak_broken_at = $2
         WHERE id = $1`,
        [userId, today]
      );
      logger.info?.({ userId, daysSince }, '[streak] broken');
    }
  } catch (err) {
    logger.warn?.({ err, userId }, '[streak] update failed');
  }
}

/**
 * Return streak data for a user.
 */
export async function getStreak(userId) {
  const { rows } = await pool.query(
    `SELECT streak_count, streak_last_updated, streak_broken_at
     FROM profiles WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return null;

  const { streak_count, streak_last_updated, streak_broken_at } = rows[0];
  const isBroken = streak_broken_at != null;

  return {
    streakCount:       streak_count || 0,
    streakLastUpdated: streak_last_updated,
    streakBrokenAt:    streak_broken_at,
    isBroken,
    milestoneReached:  getMilestone(streak_count || 0),
  };
}

function getMilestone(count) {
  if (count >= 52) return 52;
  if (count >= 12) return 12;
  if (count >= 4)  return 4;
  return null;
}
