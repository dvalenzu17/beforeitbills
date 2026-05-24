/**
 * Centralized Notification Dispatcher
 *
 * All engine features write to the notifications table via this module.
 * Immediate types are pushed right away.
 * Digest types accumulate until the weekly Monday send.
 *
 * Idempotent: deduplicates by checking for existing unread notification
 * of same type + subscription_id within 7 days before inserting.
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

// ── Tier classification ───────────────────────────────────────────────────────

// Notification types that warrant immediate push
const IMMEDIATE_TYPES = new Set([
  'price_increase',
  'trial_ending_3day',
  'trial_ending_1day',
  'rebilling',
  'annual_renewal_7day',
  'new_subscription',
]);

export function isImmediate(type) {
  return IMMEDIATE_TYPES.has(type);
}

// ── Notification copy ─────────────────────────────────────────────────────────

export function buildNotificationCopy(type, payload) {
  const m   = payload.merchant || 'Subscription';
  const sym = currencySymbol(payload.currency);

  switch (type) {
    case 'price_increase':
      return {
        title: `Price increase: ${m}`,
        body:  `Went from ${sym}${Number(payload.oldAmount || 0).toFixed(2)} to ${sym}${Number(payload.newAmount || 0).toFixed(2)}`,
      };
    case 'price_decrease':
      return {
        title: `Price drop: ${m}`,
        body:  `Dropped from ${sym}${Number(payload.oldAmount || 0).toFixed(2)} to ${sym}${Number(payload.newAmount || 0).toFixed(2)}`,
      };
    case 'trial_ending_3day':
      return {
        title: `${m} trial ends in 3 days`,
        body:  payload.amount
          ? `You'll be charged ${sym}${Number(payload.amount).toFixed(2)}/mo after your trial.`
          : 'Remember to cancel if you no longer want this service.',
      };
    case 'trial_ending_1day':
      return {
        title: `${m} trial ends tomorrow`,
        body:  payload.amount
          ? `You'll be charged ${sym}${Number(payload.amount).toFixed(2)}/mo starting tomorrow.`
          : 'Last chance to cancel before you\'re charged.',
      };
    case 'annual_renewal_7day':
      return {
        title: `Annual renewal: ${m}`,
        body:  `Renews on ${payload.renewalDate || 'upcoming date'}${payload.amount ? ` — ${sym}${Number(payload.amount).toFixed(2)}` : ''}. Still using it?`,
      };
    case 'annual_renewal_14day':
      return {
        title: `Upcoming annual renewal: ${m}`,
        body:  `Renews in ~14 days${payload.amount ? ` — ${sym}${Number(payload.amount).toFixed(2)}` : ''}`,
      };
    case 'rebilling':
      return {
        title: `${m} is charging you again`,
        body:  `You're being charged by ${m} again — you may have forgotten to cancel.`,
      };
    case 'new_subscription':
      return {
        title: 'New subscription found',
        body:  payload.amount
          ? `${m} — ${sym}${Number(payload.amount).toFixed(2)}/${shortCadence(payload.cadence)}`
          : `${m} detected in your inbox`,
      };
    case 'dormant':
      return {
        title: `Still using ${m}?`,
        body:  `You haven't used ${m} in 90 days${payload.amount ? ` — still worth ${sym}${Number(payload.amount).toFixed(2)}/mo?` : ''}`,
      };
    case 'shared_subscription':
      return {
        title: `Shared subscription: ${m}`,
        body:  payload.saving
          ? `You and a linked user both pay for ${m}. You could save ${sym}${Number(payload.saving).toFixed(2)}/mo.`
          : `You and a linked user both pay for ${m}.`,
      };
    case 'anniversary_digest':
      return {
        title: 'Your BIB year in review',
        body:  payload.summary || `You paid ${sym}${Number(payload.totalSpend || 0).toFixed(2)} in subscriptions this year.`,
      };
    default:
      return { title: 'BeforeItBills', body: 'You have a new notification.' };
  }
}

// ── Core: create a notification record ───────────────────────────────────────

/**
 * Insert a notification into the notifications table.
 * Deduplicates: returns existing id if same type + subscription_id found within 7 days.
 */
export async function createNotification(userId, type, payload = {}) {
  // Dedup check
  const subId = payload.subscriptionId || null;
  const { rows: existing } = await pool.query(
    `SELECT id FROM notifications
     WHERE user_id = $1
       AND type = $2
       AND ($3::uuid IS NULL OR payload->>'subscriptionId' = $3::text)
       AND created_at > now() - interval '7 days'
       AND read_at IS NULL
     LIMIT 1`,
    [userId, type, subId]
  );
  if (existing.length) return existing[0].id;

  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, type, JSON.stringify(payload)]
  );
  return rows[0].id;
}

// ── Dispatch: immediate ───────────────────────────────────────────────────────

/**
 * Create notification + send push immediately.
 * Returns notification id.
 */
export async function dispatchImmediate(userId, type, payload = {}, logger = console) {
  try {
    const notifId = await createNotification(userId, type, payload);
    const { title, body } = buildNotificationCopy(type, payload);

    const { sent } = await sendPushToUser(userId, title, body, { type, ...payload }, logger);

    if (sent > 0) {
      await pool.query(
        `UPDATE notifications SET sent_at = now() WHERE id = $1`,
        [notifId]
      );
    }
    return notifId;
  } catch (err) {
    logger.warn?.({ err, userId, type }, '[notif] dispatchImmediate failed');
    return null;
  }
}

// ── Dispatch: digest tier ─────────────────────────────────────────────────────

/**
 * Create notification record — does NOT send push immediately.
 * Will be batched into the weekly digest.
 */
export async function dispatchDigest(userId, type, payload = {}) {
  try {
    return await createNotification(userId, type, payload);
  } catch {
    return null;
  }
}

// ── Weekly digest sender ──────────────────────────────────────────────────────

/**
 * Called every Monday at 09:00 UTC from backgroundScanner cron.
 * For each user: find unread digest notifications from the last 7 days.
 * Send a single summary push if any exist.
 */
export async function sendWeeklyDigests(logger = console) {
  // Find users with unread digest-tier notifications in the last 7 days
  const { rows: users } = await pool.query(
    `SELECT DISTINCT user_id FROM notifications
     WHERE read_at IS NULL
       AND digest_included = false
       AND type NOT IN (${[...IMMEDIATE_TYPES].map((_, i) => `$${i + 1}`).join(',')})
       AND created_at > now() - interval '7 days'`,
    [...IMMEDIATE_TYPES]
  );

  for (const { user_id: userId } of users) {
    try {
      const digestTypes = [...IMMEDIATE_TYPES].map((_, i) => `$${i + 2}`).join(',');
      const { rows: notifications } = await pool.query(
        `SELECT id, type, payload FROM notifications
         WHERE user_id = $1
           AND read_at IS NULL
           AND digest_included = false
           AND type NOT IN (${digestTypes})
           AND created_at > now() - interval '7 days'
         ORDER BY created_at DESC`,
        [userId, ...[...IMMEDIATE_TYPES]]
      );

      if (!notifications.length) continue;

      const { sent } = await sendPushToUser(
        userId,
        'Your weekly BIB update',
        `${notifications.length} thing${notifications.length === 1 ? '' : 's'} to review`,
        { type: 'weekly_digest', count: notifications.length },
        logger
      );

      if (sent > 0) {
        const ids = notifications.map(n => n.id);
        await pool.query(
          `UPDATE notifications SET digest_included = true
           WHERE id = ANY($1)`,
          [ids]
        );
      }
    } catch (err) {
      logger.warn?.({ err, userId }, '[digest] weekly digest failed for user');
    }
  }
}

// ── Routes helpers ────────────────────────────────────────────────────────────

/**
 * List recent notifications for a user.
 */
export async function listNotifications(userId, { limit = 50, digestOnly = false } = {}) {
  const digestFilter = digestOnly
    ? `AND type NOT IN (${[...IMMEDIATE_TYPES].map((_, i) => `$${i + 3}`).join(',')})`
    : '';

  const params = [userId, Math.min(limit, 100)];
  if (digestOnly) params.push(...[...IMMEDIATE_TYPES]);

  const { rows } = await pool.query(
    `SELECT id, type, payload, sent_at, read_at, digest_included, created_at
     FROM notifications
     WHERE user_id = $1
       ${digestFilter}
     ORDER BY created_at DESC
     LIMIT $2`,
    params
  );
  return rows;
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(userId, notifId) {
  const { rows } = await pool.query(
    `UPDATE notifications SET read_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notifId, userId]
  );
  return rows[0] ?? null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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
    default:          return 'mo';
  }
}
