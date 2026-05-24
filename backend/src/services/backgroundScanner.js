/**
 * Background Email Scanner
 *
 * Runs every 6 hours via node-cron.
 * Re-scans all connected users' email accounts for new subscriptions.
 * Only processes emails newer than last_background_scan_at.
 *
 * After each scan, triggers:
 *   - Price change detection (Feature 2)
 *   - Trial email detection (Feature 3)
 *   - Annual renewal warnings (Feature 4)
 *   - Re-billing detection (Feature 5)
 *   - Dormancy scoring (Feature D)
 *   - Shared subscription detection (Feature C) — daily
 *   - Creep score update (Feature 6)
 *   - Streak update (Feature G)
 *   - Weekly digest (Feature F) — Mondays
 *   - Anniversary digests (Feature 7) — daily
 *   - Trial notifications (Feature 3) — daily
 */

import cron from 'node-cron';
import pLimit from 'p-limit';
import pg from 'pg';

import { getValidAccessToken, listMessages, fetchMessage } from './gmailClient.js';
import { scanImapInbox } from './imapClient.js';
import { decryptCredential } from './crypto.js';
import { detectRecurringSubscriptions } from './subscriptionEngine.js';
import {
  batchUpsertSubscriptions,
  markStaleSubscriptions,
  saveScanMetadata,
} from '../db/index.js';
import { dispatchImmediate } from './notificationDispatcher.js';
import { processPriceChanges } from './priceChangeDetector.js';
import { processTrialEmails, checkTrialNotifications } from './trialDetector.js';
import { updateCreepScore } from './creepScore.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function daysBetween(dateA, dateB) {
  return Math.ceil(Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24));
}

/**
 * Check whether a subscription_events record exists for this type within a window.
 * Used for application-level dedup (no unique DB index on timestamptz truncation).
 */
async function hasRecentEvent(subscriptionId, userId, eventType, windowDays = 30) {
  const { rows } = await pool.query(
    `SELECT id FROM subscription_events
     WHERE subscription_id = $1 AND user_id = $2 AND event_type = $3
       AND created_at > now() - ($4 || ' days')::interval
     LIMIT 1`,
    [subscriptionId, userId, eventType, windowDays]
  );
  return rows.length > 0;
}

async function recordEvent(subscriptionId, userId, eventType, metadata) {
  await pool.query(
    `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, now())`,
    [subscriptionId, userId, eventType, JSON.stringify(metadata || {})]
  );
}

// ── Per-user scan ─────────────────────────────────────────────────────────────

export async function runBackgroundScanForUser(userId, logger = console) {
  const started = Date.now();

  try {
    const { rows: profileRows } = await pool.query(
      `SELECT last_background_scan_at FROM profiles WHERE id = $1`,
      [userId]
    );
    const lastScan = profileRows[0]?.last_background_scan_at
      ? new Date(profileRows[0].last_background_scan_at)
      : null;

    const daysBack = lastScan
      ? Math.max(1, Math.min(7, daysBetween(lastScan, new Date()) + 1))
      : 7;

    // Snapshot inactive merchants before upsert (for re-billing detection)
    const { rows: inactiveRows } = await pool.query(
      `SELECT merchant, last_seen_at FROM subscriptions WHERE user_id = $1 AND is_active = false`,
      [userId]
    );
    const inactiveMerchants = new Map(
      inactiveRows.map(r => [r.merchant, new Date(r.last_seen_at || 0)])
    );

    // Snapshot existing merchants before upsert (for new-subscription detection)
    const { rows: existingRows } = await pool.query(
      `SELECT merchant FROM subscriptions WHERE user_id = $1`,
      [userId]
    );
    const existingMerchants = new Set(existingRows.map(r => r.merchant));

    let allDetected = [];
    let allRawEmails = [];

    // ── Gmail scan ────────────────────────────────────────────────────────────
    const { rows: gmailRows } = await pool.query(
      `SELECT supabase_user_id FROM gmail_connections WHERE supabase_user_id = $1 LIMIT 1`,
      [userId]
    );

    if (gmailRows.length) {
      try {
        const accessToken = await getValidAccessToken(userId);
        const messageRefs = await listMessages(accessToken, { daysBack });

        if (messageRefs.length) {
          const limit  = pLimit(25);
          const emails = (
            await Promise.all(messageRefs.map(({ id }) => limit(() => fetchMessage(accessToken, id))))
          ).filter(Boolean);

          allRawEmails = allRawEmails.concat(emails);
          const detected = await detectRecurringSubscriptions(emails, 'background_gmail');
          allDetected = allDetected.concat(detected);
          await processTrialEmails(userId, emails, logger).catch(() => {});
        }
      } catch (err) {
        logger.warn?.({ err, userId }, '[bg-scan] Gmail scan failed');
      }
    }

    // ── IMAP scan ─────────────────────────────────────────────────────────────
    const { rows: imapRows } = await pool.query(
      `SELECT provider, imap_user, imap_pass FROM imap_credentials WHERE user_id = $1`,
      [userId]
    );

    for (const cred of imapRows) {
      try {
        let pass;
        try { pass = decryptCredential(cred.imap_pass); } catch { continue; }

        const { rawEmails } = await scanImapInbox({
          provider: cred.provider,
          user:     cred.imap_user,
          pass,
          daysBack,
        });

        allRawEmails = allRawEmails.concat(rawEmails || []);
        const detected = await detectRecurringSubscriptions(rawEmails || [], `background_imap_${cred.provider}`);
        allDetected = allDetected.concat(detected);
        await processTrialEmails(userId, rawEmails || [], logger).catch(() => {});
      } catch (err) {
        logger.warn?.({ err, userId, provider: cred.provider }, '[bg-scan] IMAP scan failed');
      }
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    if (allDetected.length) {
      await batchUpsertSubscriptions(userId, allDetected).catch(err =>
        logger.warn?.({ err }, '[bg-scan] batchUpsertSubscriptions failed')
      );
    }
    await markStaleSubscriptions(userId).catch(() => {});

    // ── Post-scan hooks ───────────────────────────────────────────────────────

    // 1. New subscription notifications
    for (const sub of allDetected) {
      if (!existingMerchants.has(sub.merchant)) {
        await notifyNewSubscription(userId, sub, logger);
      }
    }

    // 2. Price change detection
    await processPriceChanges(userId, allDetected, logger).catch(() => {});

    // 3. Annual renewal warnings
    await checkAnnualRenewalWarnings(userId, logger).catch(() => {});

    // 4. Re-billing detection
    await checkRebilling(userId, inactiveMerchants, logger).catch(() => {});

    // 5. Dormancy scoring (Gmail only — needs email query)
    if (gmailRows.length) {
      import('./dormancyScorer.js')
        .then(m => m.scoreDormancyForUser(userId, logger))
        .catch(() => {});
    }

    // 6. Creep score
    await updateCreepScore(userId, logger).catch(() => {});

    // 7. Streak
    import('./streakService.js')
      .then(m => m.updateStreak(userId, logger))
      .catch(() => {});

    // Update last_background_scan_at
    await pool.query(
      `UPDATE profiles SET last_background_scan_at = now() WHERE id = $1`,
      [userId]
    );

    const executionTimeMs = Date.now() - started;
    await saveScanMetadata(userId, {
      scannedMessages: allRawEmails.length,
      detectedCharges: allDetected.length,
      executionTimeMs,
    }).catch(() => {});

    logger.info?.({ userId, detected: allDetected.length, ms: executionTimeMs }, '[bg-scan] complete');
  } catch (err) {
    logger.error?.({ err, userId }, '[bg-scan] unhandled error');
  }
}

// ── New subscription notification ─────────────────────────────────────────────

async function notifyNewSubscription(userId, sub, logger) {
  try {
    const { rows: subRows } = await pool.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND merchant = $2 LIMIT 1`,
      [userId, sub.merchant]
    );
    if (!subRows.length) return;
    const subscriptionId = subRows[0].id;

    const alreadyFired = await hasRecentEvent(subscriptionId, userId, 'new_subscription', 30);
    if (alreadyFired) return;

    await recordEvent(subscriptionId, userId, 'new_subscription', { merchant: sub.merchant, amount: sub.amount });

    await dispatchImmediate(userId, 'new_subscription', {
      subscriptionId,
      merchant: sub.merchant,
      amount: sub.amount,
      cadence: sub.cadence,
      currency: sub.currency,
    }, logger);
  } catch {}
}

// ── Annual renewal warnings (Feature 4) ──────────────────────────────────────

async function checkAnnualRenewalWarnings(userId, logger) {
  await pool.query(
    `UPDATE subscriptions
     SET annual_renewal_date = (
       CASE
         WHEN renewal_date IS NOT NULL THEN (
           SELECT d::date FROM generate_series(
             renewal_date::date,
             (now() + interval '400 days')::date,
             interval '1 year'
           ) d
           WHERE d::date >= now()::date
           ORDER BY d
           LIMIT 1
         )
         ELSE NULL
       END
     )
     WHERE user_id = $1 AND billing_interval = 'yearly' AND is_active = true`,
    [userId]
  ).catch(() => {});

  const { rows: renewals } = await pool.query(
    `SELECT id, merchant, renewal_amount, currency, annual_renewal_date
     FROM subscriptions
     WHERE user_id = $1
       AND billing_interval = 'yearly'
       AND is_active = true
       AND annual_renewal_date IS NOT NULL
       AND annual_renewal_date BETWEEN now()::date AND (now() + INTERVAL '14 days')::date`,
    [userId]
  );

  for (const sub of renewals) {
    try {
      const daysOut = Math.ceil((new Date(sub.annual_renewal_date) - new Date()) / 86400000);
      const eventType = daysOut <= 7 ? 'annual_renewal_7day' : 'annual_renewal_14day';
      const notifType = daysOut <= 7 ? 'annual_renewal_7day' : 'annual_renewal_14day';

      const alreadyFired = await hasRecentEvent(sub.id, userId, eventType, 14);
      if (alreadyFired) continue;

      await recordEvent(sub.id, userId, eventType, {
        daysOut, renewal_date: sub.annual_renewal_date, amount: sub.renewal_amount,
      });

      const payload = {
        subscriptionId: sub.id,
        merchant: sub.merchant,
        amount: sub.renewal_amount,
        currency: sub.currency,
        renewalDate: new Date(sub.annual_renewal_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        daysOut,
      };

      if (daysOut <= 7) {
        await dispatchImmediate(userId, notifType, payload, logger);
      } else {
        const { dispatchDigest } = await import('./notificationDispatcher.js');
        await dispatchDigest(userId, notifType, payload);
      }
    } catch (err) {
      logger.warn?.({ err, merchant: sub.merchant }, '[annual] warning failed');
    }
  }
}

// ── Re-billing detection (Feature 5) ─────────────────────────────────────────

async function checkRebilling(userId, inactiveMerchants, logger) {
  if (!inactiveMerchants.size) return;

  const merchantList = [...inactiveMerchants.keys()];
  const { rows: reactivated } = await pool.query(
    `SELECT id, merchant, last_seen_at FROM subscriptions
     WHERE user_id = $1 AND merchant = ANY($2) AND is_active = true`,
    [userId, merchantList]
  );

  for (const sub of reactivated) {
    const lastInactive = inactiveMerchants.get(sub.merchant);
    if (!lastInactive) continue;
    if (daysBetween(lastInactive, new Date()) < 60) continue;

    try {
      const alreadyFired = await hasRecentEvent(sub.id, userId, 'rebilling', 30);
      if (alreadyFired) continue;

      await recordEvent(sub.id, userId, 'rebilling', { merchant: sub.merchant });

      await dispatchImmediate(userId, 'rebilling', {
        subscriptionId: sub.id,
        merchant: sub.merchant,
      }, logger);
    } catch (err) {
      logger.warn?.({ err, merchant: sub.merchant }, '[rebilling] failed');
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function scheduleBackgroundScans(logger = console) {
  // Every 6 hours — background email scan for all connected users
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[bg-scan] Starting scheduled background scan');
    await runAllUsers(logger);
  });

  // Daily at 09:00 UTC — trial countdowns + anniversary digests
  cron.schedule('0 9 * * *', async () => {
    logger.info('[bg-scan] Running daily checks');
    await checkTrialNotifications(logger).catch(err =>
      logger.error?.({ err }, '[bg-scan] trial check failed')
    );
    const { checkAnniversaryDigests } = await import('./anniversaryDigest.js');
    await checkAnniversaryDigests(logger).catch(err =>
      logger.error?.({ err }, '[bg-scan] anniversary check failed')
    );
    // Shared subscription detection — runs daily after scans settle
    const { processLinkedPairs } = await import('./sharedSubscriptionDetector.js');
    await processLinkedPairs(logger).catch(err =>
      logger.error?.({ err }, '[bg-scan] shared-sub check failed')
    );
  });

  // Every Monday at 09:00 UTC — weekly digest
  cron.schedule('0 9 * * 1', async () => {
    logger.info('[bg-scan] Sending weekly digests');
    const { sendWeeklyDigests } = await import('./notificationDispatcher.js');
    await sendWeeklyDigests(logger).catch(err =>
      logger.error?.({ err }, '[bg-scan] weekly digest failed')
    );
  });

  logger.info('[bg-scan] Scheduled: 6h scans, daily checks 09:00, Monday digest 09:00');
}

async function runAllUsers(logger) {
  try {
    const { rows: users } = await pool.query(
      `SELECT DISTINCT p.id FROM profiles p
       WHERE p.id IN (
         SELECT supabase_user_id FROM gmail_connections
         UNION
         SELECT user_id FROM imap_credentials
       )`
    );
    logger.info?.({ count: users.length }, '[bg-scan] users to scan');
    const limit = pLimit(5);
    await Promise.all(users.map(({ id }) => limit(() => runBackgroundScanForUser(id, logger))));
  } catch (err) {
    logger.error?.({ err }, '[bg-scan] runAllUsers failed');
  }
}
