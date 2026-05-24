/**
 * Database layer — raw pg pool.
 *
 * Uses a direct PostgreSQL connection (DATABASE_URL) for all scan/subscription
 * writes. Auth operations (deleteUser) still go through the Supabase admin client
 * since there's no direct SQL equivalent.
 *
 * Unique constraints confirmed in DB:
 *   subscriptions        → (user_id, merchant)
 *   oauth_tokens         → (user_id, provider)
 *   imap_credentials     → (user_id, provider)
 *   gmail_connections    → supabase_user_id (PK)
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// ── pg pool ───────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[pg] pool error', err.message);
});

// ── Supabase admin client (auth operations only) ──────────────────────────────
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── OAuth tokens ──────────────────────────────────────────────────────────────

/**
 * Upsert OAuth tokens for a user+provider pair.
 * Writes to both oauth_tokens and gmail_connections (for Gmail).
 */
export async function saveOAuthTokens(userId, { provider, accessToken, refreshToken, expiresAt, email }) {
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, expiry_date, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
       expiry_date  = EXCLUDED.expiry_date,
       updated_at   = EXCLUDED.updated_at`,
    [userId, provider, accessToken, refreshToken ?? null, expiresAt ?? null, now]
  );

  // Mirror to gmail_connections when provider is google
  if (provider === 'google') {
    await pool.query(
      `INSERT INTO gmail_connections
         (supabase_user_id, gmail_email, access_token, refresh_token, token_expires_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (supabase_user_id) DO UPDATE SET
         gmail_email     = COALESCE(EXCLUDED.gmail_email, gmail_connections.gmail_email),
         access_token    = EXCLUDED.access_token,
         refresh_token   = COALESCE(EXCLUDED.refresh_token, gmail_connections.refresh_token),
         token_expires_at = EXCLUDED.token_expires_at,
         updated_at      = EXCLUDED.updated_at`,
      [userId, email ?? null, accessToken, refreshToken ?? null, expiresAt ?? null, now]
    );
  }
}

/**
 * Fetch stored Gmail tokens for a user. Returns null if not connected.
 */
export async function getGmailTokens(userId) {
  const { rows } = await pool.query(
    `SELECT access_token, refresh_token, token_expires_at
     FROM gmail_connections WHERE supabase_user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

/**
 * Update only the access token + expiry (called after a token refresh).
 * Optionally rotates the refresh token if Google issued a new one.
 */
export async function updateGmailAccessToken(userId, { accessToken, refreshToken, expiresAt }) {
  const now = new Date().toISOString();
  await pool.query(
    `UPDATE gmail_connections SET
       access_token     = $2,
       refresh_token    = COALESCE($3, refresh_token),
       token_expires_at = $4,
       updated_at       = $5
     WHERE supabase_user_id = $1`,
    [userId, accessToken, refreshToken ?? null, expiresAt ?? null, now]
  );
  // Keep oauth_tokens in sync
  await pool.query(
    `UPDATE oauth_tokens SET
       access_token = $2,
       refresh_token = COALESCE($3, refresh_token),
       expiry_date   = $4,
       updated_at    = $5
     WHERE user_id = $1 AND provider = 'google'`,
    [userId, accessToken, refreshToken ?? null, expiresAt ?? null, now]
  );
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

/**
 * Upsert a batch of detected subscriptions.
 *
 * - Conflict key: (user_id, merchant)
 * - On re-detection: bumps last_seen_at, updates amount/confidence if changed
 * - Does NOT overwrite user_status — a user's manual confirm/cancel is preserved
 * - Staleness: marks is_active=false for subscriptions not seen in 2× their billing
 *   period (handled by markStaleSubscriptions, called after each scan)
 */
// Merchants in this set are auto-confirmed (is_suggested=false) and appear
// directly in the user's subscription list without requiring manual review.
// Values must match lowercase(subscriptionEngine BRAND_NAME_MAP output).
const CONFIRMED_BRANDS = new Set([
  // Streaming / Video
  "netflix", "hulu", "disney+", "max", "hbo max", "paramount+", "peacock",
  "apple tv+", "youtube", "youtube premium", "youtube tv", "crunchyroll", "funimation",
  "showtime", "starz", "discovery+", "espn+", "dazn",
  // Music / Audio
  "spotify", "apple music", "youtube music", "tidal", "deezer", "amazon music",
  "siriusxm", "audible", "pandora",
  // Productivity / Storage / Office
  "google", "google one", "google workspace", "microsoft", "icloud",
  "dropbox", "notion", "slack", "zoom", "grammarly", "canva", "figma",
  "miro", "airtable", "trello", "asana", "monday.com", "jira", "atlassian",
  "1password", "lastpass", "dashlane", "loom", "webflow", "framer",
  // Developer / Hosting / Monitoring
  "github", "gitlab", "vercel", "netlify", "heroku", "digitalocean",
  "linode", "cloudflare", "sentry", "datadog", "openai", "chatgpt",
  "anthropic", "claude", "cursor",
  // Delivery / Mobility
  "uber one",
  // E-commerce / Finance
  "amazon", "amazon prime", "prime video", "shopify",
  // Fitness / Wellness / News / Education
  "peloton", "strava", "calm", "headspace", "duolingo", "masterclass",
  "medium", "substack", "new york times", "linkedin",
  // Misc SaaS
  "hubspot", "salesforce", "mailchimp", "typeform", "mixpanel", "amplitude",
  "twitch", "patreon", "fastly",
]);

function isConfirmedBrand(merchant) {
  if (!merchant) return false;
  return CONFIRMED_BRANDS.has(merchant.toLowerCase().trim());
}

export async function batchUpsertSubscriptions(userId, subscriptions) {
  if (!subscriptions?.length) return;

  const now = new Date().toISOString();

  for (const s of subscriptions) {
    // Known subscription brands auto-appear in the main list (is_suggested=false).
    // Low-confidence unknowns go to the review queue (is_suggested=true).
    const isSuggested = !isConfirmedBrand(s.merchant) && (s.confidence ?? 0) < 0.70;

    await pool.query(
      `INSERT INTO subscriptions
         (user_id, merchant, renewal_amount, currency, renewal_date, billing_interval,
          confidence, is_active, is_suggested, source, last_seen_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10,$10)
       ON CONFLICT (user_id, merchant) DO UPDATE SET
         renewal_amount   = COALESCE(EXCLUDED.renewal_amount, subscriptions.renewal_amount),
         currency         = COALESCE(EXCLUDED.currency, subscriptions.currency),
         renewal_date     = COALESCE(EXCLUDED.renewal_date, subscriptions.renewal_date),
         billing_interval = COALESCE(EXCLUDED.billing_interval, subscriptions.billing_interval),
         confidence       = GREATEST(EXCLUDED.confidence, subscriptions.confidence),
         is_active        = true,
         -- Never flip is_suggested from false → true (don't un-confirm a known brand)
         is_suggested     = CASE WHEN subscriptions.is_suggested = false THEN false ELSE EXCLUDED.is_suggested END,
         source           = EXCLUDED.source,
         last_seen_at     = EXCLUDED.last_seen_at,
         updated_at       = EXCLUDED.updated_at`,
      [
        userId,
        s.merchant,
        s.amount ?? null,
        s.currency ?? 'USD',
        s.renewalDate ?? null,
        s.cadence ?? 'monthly',
        s.confidence ?? 0,
        isSuggested,
        s.source ?? 'gmail_scan',
        now,
      ]
    );
  }
}

/**
 * Mark subscriptions as inactive if they haven't been seen in 2× their billing window.
 * Called after every scan so the list self-heals without user intervention.
 */
export async function markStaleSubscriptions(userId) {
  await pool.query(
    `UPDATE subscriptions SET is_active = false, updated_at = now()
     WHERE user_id = $1
       AND is_active = true
       AND user_status IS DISTINCT FROM 'confirmed'
       AND last_seen_at < now() - (
         CASE billing_interval
           WHEN 'weekly'    THEN INTERVAL '14 days'
           WHEN 'monthly'   THEN INTERVAL '60 days'
           WHEN 'quarterly' THEN INTERVAL '180 days'
           WHEN 'yearly'    THEN INTERVAL '730 days'
           ELSE INTERVAL '60 days'
         END
       )`,
    [userId]
  );
}

/**
 * Update user_status on a subscription (confirmed / cancelled / ignored).
 * Returns the updated row or null if not found / not owned by user.
 */
export async function updateSubscriptionStatus(userId, subscriptionId, status) {
  const VALID = ['confirmed', 'cancelled', 'ignored'];
  if (!VALID.includes(status)) throw new Error(`Invalid status: ${status}`);

  const { rows } = await pool.query(
    `UPDATE subscriptions
     SET user_status = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, merchant, user_status`,
    [subscriptionId, userId, status]
  );
  return rows[0] ?? null;
}

/**
 * Fetch subscriptions for a user with pagination.
 */
export async function getSubscriptions(userId, { limit = 100, offset = 0 } = {}) {
  const safeLimit  = Math.min(Math.max(1, Number(limit)),  500);
  const safeOffset = Math.max(0, Number(offset));

  const { rows } = await pool.query(
    `SELECT id, merchant, renewal_amount AS amount, currency, billing_interval,
            renewal_date, confidence, is_active, is_suggested, source,
            user_status, last_seen_at, created_at, updated_at
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY last_seen_at DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset]
  );
  return rows;
}

// ── Scan metadata ─────────────────────────────────────────────────────────────

/**
 * Append a scan metadata row (one row per scan — no upsert, just insert).
 */
export async function saveScanMetadata(userId, { scannedMessages, detectedCharges, executionTimeMs }) {
  await pool.query(
    `INSERT INTO scan_metadata (user_id, scanned_messages, detected_charges, execution_time_ms)
     VALUES ($1, $2, $3, $4)`,
    [userId, scannedMessages ?? 0, detectedCharges ?? 0, executionTimeMs ?? 0]
  );
}

// ── IMAP credentials ──────────────────────────────────────────────────────────

/**
 * Store encrypted IMAP credentials. Upserts on (user_id, provider).
 */
export async function saveImapCredentials(userId, { provider, user, encryptedPass }) {
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO imap_credentials (user_id, provider, imap_user, imap_pass, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       imap_user  = EXCLUDED.imap_user,
       imap_pass  = EXCLUDED.imap_pass,
       updated_at = EXCLUDED.updated_at`,
    [userId, provider, user, encryptedPass, now]
  );
}

/**
 * Retrieve stored IMAP credentials for a user+provider. Returns null if none.
 */
export async function getImapCredentials(userId, provider) {
  const { rows } = await pool.query(
    `SELECT imap_user, imap_pass FROM imap_credentials
     WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  return rows[0] ?? null;
}

// ── Subscription feedback ─────────────────────────────────────────────────────

/**
 * Save a true/false positive label + feature vector for ML training.
 */
export async function saveFeedback(userId, subscriptionId, { label, features }) {
  const VALID = ['confirmed', 'rejected'];
  if (!VALID.includes(label)) throw new Error(`Invalid label: ${label}`);

  await pool.query(
    `INSERT INTO subscription_feedback (user_id, subscription_id, label, features)
     VALUES ($1, $2, $3, $4)`,
    [userId, subscriptionId, label, JSON.stringify(features ?? {})]
  );
}

// ── Scan sessions ─────────────────────────────────────────────────────────────

export async function createScanSession(userId, provider, options = {}) {
  const { rows } = await pool.query(
    `INSERT INTO scan_sessions (user_id, provider, status, options)
     VALUES ($1, $2, 'queued', $3)
     RETURNING id, status, created_at`,
    [userId, provider, JSON.stringify(options)]
  );
  return rows[0];
}

export async function updateScanSession(sessionId, updates) {
  const fields = [];
  const vals   = [];
  let   idx    = 1;
  for (const [k, v] of Object.entries(updates)) {
    fields.push(`${k} = $${idx++}`);
    vals.push(v);
  }
  fields.push(`updated_at = now()`);
  vals.push(sessionId);
  await pool.query(
    `UPDATE scan_sessions SET ${fields.join(', ')} WHERE id = $${idx}`,
    vals
  );
}

export async function getScanSession(sessionId, userId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, provider, status, scanned_total, found_total,
            error_code, error_message, last_stats, created_at, updated_at
     FROM scan_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rows[0] ?? null;
}

export async function writeScanEvent(sessionId, userId, eventType, payload) {
  await pool.query(
    `INSERT INTO scan_events (session_id, user_id, event_type, payload)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, eventType, JSON.stringify(payload)]
  );
}

export async function getNewScanEvents(sessionId, afterId = 0) {
  const { rows } = await pool.query(
    `SELECT id, event_type, payload FROM scan_events
     WHERE session_id = $1 AND id > $2
     ORDER BY id ASC LIMIT 50`,
    [sessionId, afterId]
  );
  return rows;
}

// ── Account deletion ──────────────────────────────────────────────────────────

/**
 * Delete all user data then remove the auth user.
 * Tables are cleaned in dependency order before the auth.users row is removed.
 */
export async function deleteAccount(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tables = [
      'subscription_feedback',
      'subscription_events',
      'subscription_price_history',
      'subscription_trials',
      'scan_events',
      'scan_candidates',
      'scan_chunk_logs',
      'scan_sessions',
      'scan_metadata',
      'subscriptions',
      'imap_credentials',
      'oauth_tokens',
      'gmail_connections',
      'push_tokens',
    ];
    for (const t of tables) {
      const col = t === 'gmail_connections' ? 'supabase_user_id' : 'user_id';
      await client.query(`DELETE FROM ${t} WHERE ${col} = $1`, [userId]);
    }
    await client.query(`DELETE FROM profiles WHERE id = $1`, [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Remove auth user last (invalidates all sessions)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message || 'Failed to delete auth user');
}
