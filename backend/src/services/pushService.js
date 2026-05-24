/**
 * Expo Push Notification service.
 *
 * Sends push notifications via the Expo Push HTTP API.
 * No extra SDK required — uses fetch.
 *
 * Expo limits: max 100 messages per request.
 * Receipt polling not implemented (fire-and-forget with error logging).
 */

import pg from 'pg';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

/**
 * Fetch all Expo push tokens for a user.
 * Returns [] if none registered.
 */
export async function getUserPushTokens(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT token FROM push_tokens WHERE user_id = $1`,
      [userId]
    );
    return rows.map(r => r.token);
  } catch {
    return [];
  }
}

/**
 * Remove a stale token (DeviceNotRegistered receipt).
 */
async function removeStaleToken(token) {
  try {
    await pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
  } catch {}
}

/**
 * Send push notifications to an array of Expo tokens.
 *
 * @param {string[]} tokens  - Expo push token strings (ExponentPushToken[...])
 * @param {string}   title
 * @param {string}   body
 * @param {object}   data    - Custom payload attached to the notification
 * @returns {{ sent: number, failed: number }}
 */
export async function sendPush(tokens, title, body, data = {}) {
  if (!tokens?.length) return { sent: 0, failed: 0 };

  // Filter to valid Expo tokens
  const valid = tokens.filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken['));
  if (!valid.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  // Batch into chunks of 100 (Expo limit)
  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100).map(token => ({
      to: token,
      title,
      body,
      sound: 'default',
      data: { app: 'bib', ...data },
      priority: 'high',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        failed += batch.length;
        continue;
      }

      const json = await res.json();
      const ticketData = Array.isArray(json?.data) ? json.data : [];

      for (let j = 0; j < ticketData.length; j++) {
        const ticket = ticketData[j];
        if (ticket?.status === 'ok') {
          sent += 1;
        } else {
          failed += 1;
          // Clean up tokens that are no longer registered
          if (ticket?.details?.error === 'DeviceNotRegistered') {
            removeStaleToken(batch[j].to);
          }
        }
      }
    } catch {
      failed += batch.length;
    }
  }

  return { sent, failed };
}

/**
 * Convenience: fetch tokens for a user then send.
 * Never throws — logs errors and returns counts.
 */
export async function sendPushToUser(userId, title, body, data = {}, logger = console) {
  try {
    const tokens = await getUserPushTokens(userId);
    if (!tokens.length) return { sent: 0, failed: 0 };
    const result = await sendPush(tokens, title, body, data);
    if (result.failed > 0) {
      logger.warn?.({ userId, ...result }, '[push] some notifications failed');
    }
    return result;
  } catch (err) {
    logger.error?.({ err, userId }, '[push] sendPushToUser error');
    return { sent: 0, failed: 0 };
  }
}
