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
 *   - Creep score update (Feature 6)
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
import { sendPushToUser } from './pushService.js';
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

// ── Per-user scan ─────────────────────────────────────────────────────────────

/**
 * Run a background scan for a single user.
 * Safe to call concurrently for different users.
 * Never throws — catches and logs all errors.
 */
export async function runBackgroundScanForUser(userId, logger = console) {
  const started = Date.now();

  try {
    // Determine how many days back to scan (since last scan, max 7 days, min 1)
    const { rows: profileRows } = await pool.query(
      `SELECT last_background_scan_at FROM profiles WHERE id = $1`,
      [userId]
    );
    const lastScan = profileRows[0]?.last_background_scan_at
      ? new Date(profileRows[0].last_background_scan_at)
      : null;

    const daysBack = lastScan
      ? Math.max(1, Math.min(7, daysBetween(lastScan, new Date()) + 1))
      : 7; // first background scan — look back 7 days

    // Snapshot currently inactive merchants BEFORE upsert (for re-billing detection)
    const { rows: inactiveRows } = await pool.query(
      `SELECT merchant, last_seen_at FROM subscriptions
       WHERE user_id = $1 AND is_active = false`,
      [userId]
    );
    const inactiveMerchants = new Map(
      inactiveRows.map(r => [r.merchant, new Date(r.last_seen_at || 0)])
    );

    // Snapshot existing merchants BEFORE upsert (for new-subscription detection)
    const { rows: existingRows } = await pool.query(
      `SELECT merchant FROM subscriptions WHERE user_id = $1`,
      [userId]
    );
    const existingMerchants = new Set(existingRows.map(r => r.merchant));

    let allDetected = [];

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
          const limit   = pLimit(25);
          const emails  = (
            await Promise.all(messageRefs.map(({ id }) => limit(() => fetchMessage(accessToken, id))))
          ).filter(Boolean);

          const detected = await detectRecurringSubscriptions(emails, 'background_gmail');
          allDetected = allDetected.concat(detected);

          // Trial detection uses the raw email objects (with subject/snippet)
          await processTrialEmails(userId, emails, logger).catch(() => {});
        }
      } catch (err) {
        logger.warn?.({ err, userId }, '[bg-scan] Gmail scan failed');
      }
    }

    // ── IMAP scan (all stored providers) ─────────────────────────────────────
    const { rows: imapRows } = await pool.query(
      `SELECT provider, imap_user, imap_pass FROM imap_credentials WHERE user_id = $1`,
      [userId]
    );

    for (const cred of imapRows) {
      try {
        let pass;
        try {
          pass = decryptCredential(cred.imap_pass);
        } catch {
          continue; // stale/invalid creds — skip silently
        }

        const { rawEmails } = await scanImapInbox({
          provider: cred.provider,
          user:     cred.imap_user,
          pass,
          daysBack,
        });

        const detected = await detectRecurringSubscriptions(rawEmails, `background_imap_${cred.provider}`);
        allDetected = allDetected.concat(detected);

        await processTrialEmails(userId, rawEmails, logger).catch(() => {});
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

    // 1. Push for newly detected subscriptions (not seen before)
    for (const sub of allDetected) {
      if (!existingMerchants.has(sub.merchant)) {
        await sendNewSubscriptionPush(userId, sub, logger);
      }
    }

    // 2. Price change detection
    await processPriceChanges(userId, allDetected, logger).catch(() => {});

    // 3. Annual renewal warnings
    await checkAnnualRenewalWarnings(userId, logger).catch(() => {});

    // 4. Re-billing detection
    await checkRebilling(userId, inactiveMerchants, logger).catch(() => {});

    // 5. Creep score
    await updateCreepScore(userId, logger).catch(() => {});

    // ── Update last_background_scan_at ────────────────────────────────────────
    await pool.query(
      `UPDATE profiles SET last_background_scan_at = now() WHERE id = $1`,
      [userId]
    );

    const executionTimeMs = Date.now() - started;
    await saveScanMetadata(userId, {
      scannedMessages: 0,
      detectedCharges: allDetected.length,
      executionTimeMs,
    }).catch(() => {});

    logger.info?.({ userId, detected: allDetected.length, ms: executionTimeMs }, '[bg-scan] user scan complete');
  } catch (err) {
    logger.error?.({ err, userId }, '[bg-scan] unhandled error for user');
  }
}

// ── Push helpers ──────────────────────────────────────────────────────────────

async function sendNewSubscriptionPush(userId, sub, logger) {
  try {
    // Idempotency: check subscription_events for 'new_subscription' this month
    const { rows: subRows } = await pool.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND merchant = $2 LIMIT 1`,
      [userId, sub.merchant]
    );
    if (!subRows.length) return;
    const subscriptionId = subRows[0].id;

    const { rowCount } = await pool.query(
      `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata)
       VALUES ($1, $2, 'new_subscription', $3)
       ON CONFLICT DO NOTHING`,
      [subscriptionId, userId, JSON.stringify({ merchant: sub.merchant, amount: sub.amount })]
    );
    if (rowCount === 0) return; // already notified this month

    const sym   = currencySymbol(sub.currency);
    const amt   = sub.amount != null ? ` · ${sym}${Number(sub.amount).toFixed(2)}` : '';
    const cadence = sub.cadence ? `/${shortCadence(sub.cadence)}` : '';

    await sendPushToUser(userId,
      `New subscription found`,
      `${sub.merchant}${amt}${cadence}`,
      { type: 'new_subscription', merchant: sub.merchant, amount: sub.amount },
      logger
    );
  } catch {}
}

// ── Annual renewal warnings (Feature 4) ──────────────────────────────────────

async function checkAnnualRenewalWarnings(userId, logger) {
  // First update annual_renewal_date for all yearly subs
  await pool.query(
    `UPDATE subscriptions
     SET annual_renewal_date = (
       -- Next occurrence of the stored renewal_date within the next 12 months
       CASE
         WHEN renewal_date IS NOT NULL THEN
           CASE
             WHEN (renewal_date + (
               CEIL(DATE_PART('day', now()::date - renewal_date::date) / 365.0) * INTERVAL '1 year'
             ))::date >= now()::date THEN
               (renewal_date + (
                 CEIL(DATE_PART('day', now()::date - renewal_date::date) / 365.0) * INTERVAL '1 year'
               ))::date
             ELSE
               (renewal_date + (
                 (CEIL(DATE_PART('day', now()::date - renewal_date::date) / 365.0) + 1) * INTERVAL '1 year'
               ))::date
           END
         ELSE NULL
       END
     )
     WHERE user_id = $1 AND billing_interval = 'yearly' AND is_active = true`,
    [userId]
  ).catch(() => {});

  // Find yearly subs renewing within 14 days
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
      // Dedup: only once per subscription per calendar month
      const { rowCount } = await pool.query(
        `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata)
         VALUES ($1, $2, 'annual_warning', $3)
         ON CONFLICT DO NOTHING`,
        [sub.id, userId, JSON.stringify({ renewal_date: sub.annual_renewal_date, amount: sub.renewal_amount })]
      );
      if (rowCount === 0) continue;

      const sym      = currencySymbol(sub.currency);
      const dateStr  = new Date(sub.annual_renewal_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      const amtStr   = sub.renewal_amount != null ? ` — ${sym}${Number(sub.renewal_amount).toFixed(2)}` : '';

      await sendPushToUser(userId,
        `Annual renewal: ${sub.merchant}`,
        `Renews on ${dateStr}${amtStr}. Still using it?`,
        { type: 'annual_warning', merchant: sub.merchant, renewalDate: sub.annual_renewal_date },
        logger
      );
    } catch (err) {
      logger.warn?.({ err, merchant: sub.merchant }, '[annual] warning failed');
    }
  }
}

// ── Re-billing detection (Feature 5) ─────────────────────────────────────────

async function checkRebilling(userId, inactiveMerchants, logger) {
  if (!inactiveMerchants.size) return;

  // Find merchants that were inactive and are now active again
  const merchantList = [...inactiveMerchants.keys()];
  const { rows: reactivated } = await pool.query(
    `SELECT id, merchant, last_seen_at FROM subscriptions
     WHERE user_id = $1
       AND merchant = ANY($2)
       AND is_active = true`,
    [userId, merchantList]
  );

  for (const sub of reactivated) {
    const lastInactive = inactiveMerchants.get(sub.merchant);
    if (!lastInactive) continue;

    // Only fire if inactive for 60+ days
    const daysSinceInactive = daysBetween(lastInactive, new Date());
    if (daysSinceInactive < 60) continue;

    try {
      const { rowCount } = await pool.query(
        `INSERT INTO subscription_events (subscription_id, user_id, event_type, metadata)
         VALUES ($1, $2, 'rebilling', $3)
         ON CONFLICT DO NOTHING`,
        [sub.id, userId, JSON.stringify({ daysSinceInactive, merchant: sub.merchant })]
      );
      if (rowCount === 0) continue;

      await sendPushToUser(userId,
        `Charge detected: ${sub.merchant}`,
        `You're being charged by ${sub.merchant} again — you may have forgotten to cancel.`,
        { type: 'rebilling', merchant: sub.merchant },
        logger
      );
    } catch (err) {
      logger.warn?.({ err, merchant: sub.merchant }, '[rebilling] notification failed');
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Start the background scan cron and daily notification checks.
 * Called once from server.js on startup.
 */
export function scheduleBackgroundScans(logger = console) {
  // Every 6 hours — background email scan for all connected users
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[bg-scan] Starting scheduled background scan for all users');
    await runAllUsers(logger);
  });

  // Daily at 09:00 — trial countdown notifications + anniversary digests
  cron.schedule('0 9 * * *', async () => {
    logger.info('[bg-scan] Running daily notification checks');
    try {
      await checkTrialNotifications(logger);
    } catch (err) {
      logger.error?.({ err }, '[bg-scan] checkTrialNotifications failed');
    }
    try {
      const { checkAnniversaryDigests } = await import('./anniversaryDigest.js');
      await checkAnniversaryDigests(logger);
    } catch (err) {
      logger.error?.({ err }, '[bg-scan] checkAnniversaryDigests failed');
    }
  });

  logger.info('[bg-scan] Scheduled: background scans every 6h, daily checks at 09:00');
}

/**
 * Run a background scan for ALL connected users.
 * Max 5 concurrent users to avoid overwhelming the DB/Gmail API.
 */
async function runAllUsers(logger) {
  try {
    // Get all users with at least one email connection
    const { rows: users } = await pool.query(
      `SELECT DISTINCT p.id
       FROM profiles p
       WHERE p.id IN (
         SELECT supabase_user_id FROM gmail_connections
         UNION
         SELECT user_id FROM imap_credentials
       )`
    );

    logger.info?.({ count: users.length }, '[bg-scan] users to scan');

    const limit = pLimit(5);
    await Promise.all(
      users.map(({ id }) => limit(() => runBackgroundScanForUser(id, logger)))
    );
  } catch (err) {
    logger.error?.({ err }, '[bg-scan] runAllUsers failed');
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function currencySymbol(currency) {
  switch ((currency || 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'CAD': return 'CA$';
    default:    return `${currency} `;
  }
}

function shortCadence(cadence) {
  switch (cadence) {
    case 'weekly':    return 'wk';
    case 'monthly':   return 'mo';
    case 'quarterly': return 'qtr';
    case 'yearly':    return 'yr';
    default:          return cadence;
  }
}
