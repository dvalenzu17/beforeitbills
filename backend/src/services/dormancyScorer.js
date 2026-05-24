/**
 * Dormancy Scoring
 *
 * Scores each active subscription 0–100 based on absence of usage-signal emails
 * from that merchant in the last 90 days.
 *
 * Usage signals = any email from the merchant domain that is NOT a billing email.
 * Billing emails: subjects containing invoice/receipt/payment/charge/billing/renewal.
 *
 * Score logic:
 *   0 signals in 90d  → 90–100 (dormant)
 *   1–3 signals        → 50–89
 *   4+  signals        → 0–49  (active)
 * Weighted by recency using a simple decay.
 */

import pg from 'pg';
import { getValidAccessToken } from './gmailClient.js';
import { fetchJson } from '../lib/fetchUtil.js';
import { dispatchDigest } from './notificationDispatcher.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

const BILLING_SUBJECT_PATTERN = /invoice|receipt|payment|charged|billing|renewal|subscription|order|statement/i;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

/**
 * Recency weight for an email date.
 * Mirrors the decay logic in subscriptionEngine (not exported from there).
 */
function recencyWeight(emailDate) {
  const daysAgo = (Date.now() - emailDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < 7)  return 1.0;
  if (daysAgo < 30) return 0.6;
  if (daysAgo < 60) return 0.3;
  return 0.1;
}

/**
 * Compute dormancy score from a weighted signal count.
 * weightedCount: sum of recency weights for non-billing emails.
 */
function computeDormancyScore(weightedCount) {
  if (weightedCount === 0) return 95;
  if (weightedCount < 0.5) return 85;  // 1 old signal
  if (weightedCount < 1.5) return 70;  // ~1 recent or 2 old
  if (weightedCount < 3.0) return 50;  // 2–3 moderate signals
  if (weightedCount < 5.0) return 30;  // several signals
  return 10;                            // actively used
}

/**
 * Query Gmail for non-billing emails from a sender domain in the last 90 days.
 * Returns array of { date: Date } objects.
 */
async function listUsageSignalEmails(accessToken, domain, daysBack = 90) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const afterStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`;

  const query = `from:${domain} after:${afterStr} -subject:invoice -subject:receipt -subject:payment -subject:charged -subject:billing -subject:renewal -subject:"order confirmation"`;

  try {
    const res = await fetchJson(
      `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      12_000
    );
    if (!res.ok) return [];

    const messages = Array.isArray(res.json?.messages) ? res.json.messages : [];
    if (!messages.length) return [];

    // Fetch dates for each message (metadata only)
    const withDates = await Promise.all(
      messages.slice(0, 10).map(async (m) => {
        try {
          const msg = await fetchJson(
            `${GMAIL_BASE}/messages/${m.id}?format=metadata&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
            10_000
          );
          if (!msg.ok) return null;
          const dateHeader = (msg.json?.payload?.headers || []).find(h => h.name === 'Date');
          const date = dateHeader ? new Date(dateHeader.value) : null;
          if (!date || isNaN(date)) return null;
          return { date };
        } catch { return null; }
      })
    );

    return withDates.filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Score dormancy for all active Gmail-connected subscriptions for a user.
 */
export async function scoreDormancyForUser(userId, logger = console) {
  try {
    const accessToken = await getValidAccessToken(userId);

    const { rows: subs } = await pool.query(
      `SELECT id, merchant, renewal_amount, currency, sender_domain
       FROM subscriptions
       WHERE user_id = $1 AND is_active = true AND sender_domain IS NOT NULL`,
      [userId]
    );

    for (const sub of subs) {
      try {
        const signals = await listUsageSignalEmails(accessToken, sub.sender_domain, 90);

        const weightedCount = signals.reduce((sum, s) => sum + recencyWeight(s.date), 0);
        const score = computeDormancyScore(weightedCount);
        const lastSignalAt = signals.length
          ? new Date(Math.max(...signals.map(s => s.date.getTime()))).toISOString()
          : null;

        // Upsert dormancy_scores
        await pool.query(
          `INSERT INTO dormancy_scores (subscription_id, user_id, score, last_usage_signal_at, calculated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (subscription_id) DO UPDATE SET
             score                = EXCLUDED.score,
             last_usage_signal_at = EXCLUDED.last_usage_signal_at,
             calculated_at        = now()`,
          [sub.id, userId, score, lastSignalAt]
        );

        // Mirror score on subscriptions row
        await pool.query(
          `UPDATE subscriptions SET dormancy_score = $2, updated_at = now() WHERE id = $1`,
          [sub.id, score]
        );

        // If highly dormant (score ≥ 80): queue a digest notification (not immediate)
        if (score >= 80) {
          // Dedup: check for recent dormant notification for this sub (within 60 days)
          const { rows: recent } = await pool.query(
            `SELECT id FROM notifications
             WHERE user_id = $1 AND type = 'dormant'
               AND payload->>'subscriptionId' = $2
               AND created_at > now() - interval '60 days'
             LIMIT 1`,
            [userId, sub.id]
          );
          if (!recent.length) {
            await dispatchDigest(userId, 'dormant', {
              subscriptionId: sub.id,
              merchant: sub.merchant,
              amount: sub.renewal_amount,
              currency: sub.currency,
              dormancyScore: score,
            });
          }
        }
      } catch (err) {
        logger.warn?.({ err, merchant: sub.merchant }, '[dormancy] scoring failed for sub');
      }
    }
  } catch (err) {
    logger.warn?.({ err, userId }, '[dormancy] scorer failed');
  }
}
