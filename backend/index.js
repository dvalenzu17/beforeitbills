import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const PORT = Number(process.env.PORT || 8787);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Optional fallback (e.g. web OAuth)
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || null;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || null;

const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || null;

if (!TOKEN_ENCRYPTION_KEY) {
  console.error('[FATAL] TOKEN_ENCRYPTION_KEY is not set. Refusing to start.');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();

// CORS: allow mobile (no Origin header) and optionally restrict web origins
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // mobile/native
      if (CORS_ORIGINS.length === 0) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '1mb' }));

// Tiny in-memory rate limiter (good enough for beta)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rl = new Map();
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rl.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  rl.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

function parseEncryptionKey(key) {
  if (!key) return null;
  // accept base64 or hex
  try {
    const b64 = Buffer.from(key, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  try {
    const hex = Buffer.from(key, 'hex');
    if (hex.length === 32) return hex;
  } catch {}
  return null;
}

const ENC_KEY = parseEncryptionKey(TOKEN_ENCRYPTION_KEY);

if (!ENC_KEY) {
  // Should not reach here — startup check exits if key missing
}

function encryptToken(plain) {
  if (!plain) return null;
  if (!ENC_KEY) return String(plain);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptToken(stored) {
  if (!stored) return null;
  const s = String(stored);
  if (!s.startsWith('v1.')) return s;
  if (!ENC_KEY) throw new Error('Server missing TOKEN_ENCRYPTION_KEY for decrypt');
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}

async function fetchJson(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const json = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, json };
  } finally {
    clearTimeout(id);
  }
}

async function requireUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new Error('Missing Authorization bearer token');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error('Invalid user token');
  return { user: data.user, token };
}

app.post('/oauth/google/exchange', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    const { code, codeVerifier, redirectUri, clientId } = req.body || {};

    if (!code || typeof code !== 'string' || code.length > 4096) {
      return res.status(400).json({ error: 'Missing/invalid code' });
    }

    if (!redirectUri || typeof redirectUri !== 'string' || redirectUri.length > 2048) {
      return res.status(400).json({ error: 'Missing/invalid redirectUri' });
    }

    const effectiveClientId = (typeof clientId === 'string' && clientId) ? clientId : GOOGLE_OAUTH_CLIENT_ID;
    if (!effectiveClientId) {
      return res.status(400).json({ error: 'Missing clientId (send from app) or set GOOGLE_OAUTH_CLIENT_ID' });
    }

    const form = new URLSearchParams();
    form.set('code', code);
    form.set('client_id', effectiveClientId);
    form.set('redirect_uri', redirectUri);
    form.set('grant_type', 'authorization_code');
    if (codeVerifier) form.set('code_verifier', codeVerifier);

    // Optional: support web flows if you explicitly set a secret
    if (GOOGLE_OAUTH_CLIENT_SECRET && effectiveClientId === GOOGLE_OAUTH_CLIENT_ID) {
      form.set('client_secret', GOOGLE_OAUTH_CLIENT_SECRET);
    }

    const tok = await fetchJson(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      },
      12_000
    );

    if (!tok.ok) {
      return res.status(400).json({ error: tok.json?.error_description || tok.json?.error || 'Token exchange failed' });
    }

    const json = tok.json;
    const now = Date.now();
    const expiresAt = json.expires_in ? new Date(now + json.expires_in * 1000).toISOString() : null;

    // Write to gmail_connections (primary table — supabase_user_id is the PK column)
    const gcRow = {
      supabase_user_id: user.id,
      gmail_email: user.email || null,
      access_token: json.access_token,
      refresh_token: encryptToken(json.refresh_token || null),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    const { error: gcError } = await supabase
      .from('gmail_connections')
      .upsert(gcRow, { onConflict: 'supabase_user_id' });

    if (gcError) {
      return res.status(500).json({ error: gcError.message || 'Failed to store Gmail connection' });
    }

    // Also write to oauth_tokens for compatibility with the separate email-import backend
    const otRow = {
      user_id: user.id,
      provider: 'google',
      access_token: json.access_token,
      refresh_token: encryptToken(json.refresh_token || null),
      expiry_date: expiresAt,
      updated_at: new Date().toISOString(),
    };

    // Non-fatal if oauth_tokens upsert fails — gmail_connections is the source of truth
    await supabase
      .from('oauth_tokens')
      .upsert(otRow, { onConflict: 'user_id,provider' })
      .catch(() => {});

    return res.json({ ok: true, connected: true, provider: 'google' });
  } catch (e) {
    return res.status(401).json({ error: e?.message || String(e) });
  }
});

async function getGoogleAccessToken(userId) {
  // Read from gmail_connections — the real table (supabase_user_id is the PK column)
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('supabase_user_id', userId)
    .maybeSingle();

  if (error || !data) throw new Error('No Gmail connection found. Reconnect your Gmail account.');

  // If we have a non-expired access token, use it directly
  if (data.access_token && data.token_expires_at &&
      new Date(data.token_expires_at).getTime() > Date.now() + 60_000) {
    return data.access_token;
  }

  if (!data.refresh_token) throw new Error('Missing refresh token. Reconnect Gmail.');

  const refreshToken = decryptToken(data.refresh_token);
  if (!refreshToken) throw new Error('Invalid refresh token. Reconnect Gmail.');

  const clientId = GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID on server. Contact support.');

  const form = new URLSearchParams();
  form.set('client_id', clientId);
  if (GOOGLE_OAUTH_CLIENT_SECRET) {
    form.set('client_secret', GOOGLE_OAUTH_CLIENT_SECRET);
  }
  form.set('refresh_token', refreshToken);
  form.set('grant_type', 'refresh_token');

  const tok = await fetchJson(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
    12_000
  );

  if (!tok.ok) throw new Error(tok.json?.error_description || tok.json?.error || 'Failed to refresh access token');

  const json = tok.json;
  const now = Date.now();
  const expiresAt = json.expires_in ? new Date(now + json.expires_in * 1000).toISOString() : null;

  // Update the access token in gmail_connections
  await supabase.from('gmail_connections').upsert({
    supabase_user_id: userId,
    access_token: json.access_token,
    // Google occasionally rotates the refresh token — preserve it if present
    ...(json.refresh_token ? { refresh_token: encryptToken(json.refresh_token) } : {}),
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'supabase_user_id' });

  return json.access_token;
}

// ── Extraction helpers ────────────────────────────────────────────────────────

/**
 * Extract sender domain from a From header.
 * "Netflix <billing@netflix.com>" → "netflix.com"
 * "noreply@amazon.co.uk" → "amazon.co.uk"
 */
function extractSenderDomain(from = '') {
  const s = String(from);
  const emailMatch = s.match(/<([^>]+)>/) || s.match(/([^\s<>"]+@[^\s<>"]+)/);
  const email = emailMatch?.[1] || '';
  const parts = email.split('@');
  return (parts[1] || '').toLowerCase().trim();
}

/**
 * Collapse a sender domain to its root brand.
 * "orders.amazon.co.uk" → "amazon"
 * "billing.netflix.com" → "netflix"
 * "noreply.spotify.com" → "spotify"
 */
function brandFromDomain(domain = '') {
  if (!domain) return '';
  // Strip known TLDs and subdomains — keep penultimate segment
  const parts = domain.replace(/\.(com|co|net|org|io|app|mail|email)(\.[a-z]{2})?$/, '').split('.');
  return parts[parts.length - 1].toLowerCase();
}

const BRAND_NAME_MAP = {
  netflix: 'Netflix', spotify: 'Spotify', amazon: 'Amazon', youtube: 'YouTube',
  google: 'Google', apple: 'Apple', disney: 'Disney+', hulu: 'Hulu',
  hbo: 'HBO Max', max: 'Max', peacock: 'Peacock', paramount: 'Paramount+',
  microsoft: 'Microsoft', adobe: 'Adobe', dropbox: 'Dropbox', notion: 'Notion',
  slack: 'Slack', github: 'GitHub', openai: 'OpenAI', zoom: 'Zoom',
  canva: 'Canva', figma: 'Figma', grammarly: 'Grammarly', audible: 'Audible',
  twitch: 'Twitch', crunchyroll: 'Crunchyroll', duolingo: 'Duolingo',
  headspace: 'Headspace', calm: 'Calm', peloton: 'Peloton', medium: 'Medium',
  substack: 'Substack', patreon: 'Patreon', nytimes: 'New York Times',
  klaviyo: 'Klaviyo', interactivebrokers: 'Interactive Brokers',
  uberone: 'Uber One', hoyoverse: 'HoYoverse', chatgpt: 'ChatGPT',
  icloud: 'iCloud', appletv: 'Apple TV+', applemusic: 'Apple Music',
  amazonprime: 'Amazon Prime', primevideo: 'Prime Video',
};

function applyBrandMap(brand) {
  const key = String(brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return BRAND_NAME_MAP[key] || (brand.charAt(0).toUpperCase() + brand.slice(1));
}

/**
 * Normalise merchant display name from From header.
 * "Netflix <billing@netflix.com>" → "Netflix"
 * "noreply@spotify.com" → "Spotify"   (no display name → derive from domain)
 * "Amazon.com <orders@amazon.com>" → "Amazon"  (strip .com from display name)
 */
function normalizeMerchant(from = '', senderDomain = '') {
  const withoutBrackets = String(from).replace(/<.*?>/g, '').replace(/"/g, '').trim();

  // If display name is empty or looks like an email address, derive from domain
  const looksLikeEmail = !withoutBrackets || withoutBrackets.includes('@');
  if (looksLikeEmail) {
    const brand = brandFromDomain(senderDomain || extractSenderDomain(from));
    return brand ? applyBrandMap(brand) : 'Subscription';
  }

  // Strip trailing domain extension from display names like "Amazon.com"
  const clean = withoutBrackets.replace(/\.(com|net|io|org|co|app)$/i, '').trim();
  const brand = brandFromDomain(clean.toLowerCase().replace(/\s/g, ''));
  if (BRAND_NAME_MAP[brand]) return BRAND_NAME_MAP[brand];

  // Fall back to display name with first letter capitalised
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Estimate next renewal date from email date + cadence.
 * "2024-01-15" + "monthly" → "2024-02-15"
 */
function estimateRenewalDate(emailDate, cadence) {
  if (!emailDate) return null;
  const d = new Date(emailDate instanceof Date ? emailDate : emailDate);
  if (isNaN(d.getTime())) return null;
  switch (String(cadence || 'monthly')) {
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    default:          d.setMonth(d.getMonth() + 1); // monthly
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Parse email date string → Date object. Returns null on failure.
 */
function parseEmailDate(dateStr = '') {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Extract a dollar/euro/gbp amount from text.
 * Handles: $12.99  USD 12.99  £9.99  €14.99  12.99 USD
 */
function parseAmount(text = '') {
  const s = String(text);
  const patterns = [
    /(USD|US\$|\$|GBP|£|EUR|€)\s?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:\.[0-9]{1,2})?)\s?(USD|GBP|EUR)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      // figure out which capture group has the number
      const num = Number(m[1]) || Number(m[2]);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return null;
}

/**
 * Parse currency from text. Returns 'USD' as default.
 */
function parseCurrency(text = '') {
  const s = String(text).toUpperCase();
  if (s.includes('£') || s.includes('GBP')) return 'GBP';
  if (s.includes('€') || s.includes('EUR')) return 'EUR';
  if (s.includes('CAD')) return 'CAD';
  if (s.includes('AUD')) return 'AUD';
  return 'USD';
}

/**
 * Score how likely an email represents a RECURRING subscription charge.
 *
 * Key improvements over v1:
 * - Heavy penalty for one-time purchase signals (Amazon order, shipping, delivery)
 * - Heavy penalty for transactional but non-recurring signals
 * - Bonus for explicit recurring language
 * - Subject and snippet weighted separately
 */
function scoreCandidate({ subject = '', from = '', snippet = '', senderDomain = '' }) {
  const subLow = subject.toLowerCase();
  const allLow = `${subLow} ${from.toLowerCase()} ${snippet.toLowerCase()}`;

  let score = 0;

  // ── Strong recurring signals ─────────────────────────────────────────────
  const recurringHits = [
    ['subscription',  0.40],
    ['auto-renew',    0.40],
    ['auto renew',    0.35],
    ['renewal',       0.35],
    ['renews',        0.30],
    ['membership',    0.30],
    ['monthly plan',  0.30],
    ['annual plan',   0.30],
    ['billing cycle', 0.30],
    ['next billing',  0.25],
    ['monthly',       0.15],
    ['yearly',        0.15],
    ['quarterly',     0.15],
    ['weekly',        0.15],
    ['plan',          0.10],
    ['trial',         0.20],
  ];
  for (const [k, w] of recurringHits) {
    if (allLow.includes(k)) score += w;
  }

  // ── Receipt/invoice signals (weaker — present on one-time too) ──────────
  if (allLow.includes('receipt'))  score += 0.10;
  if (allLow.includes('invoice'))  score += 0.10;
  if (allLow.includes('charged'))  score += 0.10;
  if (allLow.includes('payment received')) score += 0.10;

  // ── One-time purchase penalties ──────────────────────────────────────────
  // These dominate Amazon, eBay, Uber Eats, Doordash, etc.
  const oneTimePenalties = [
    ['your order',          -0.60],
    ['order confirmation',  -0.60],
    ['order #',             -0.60],
    ['order number',        -0.55],
    ['shipped',             -0.70],
    ['delivery',            -0.60],
    ['out for delivery',    -0.70],
    ['delivered',           -0.70],
    ['tracking',            -0.50],
    ['dispatch',            -0.50],
    ['has been shipped',    -0.65],
    ['arriving',            -0.55],
    ['estimated delivery',  -0.60],
    ['package',             -0.40],
    ['items ordered',       -0.60],
    ['purchase confirmation', -0.55],
    ['one-time',            -0.50],
    ['one time',            -0.50],
    ['refund',              -0.60],
    ['return',              -0.30],
    ['cancellation',        -0.40],
    ['verification',        -0.80],
    ['confirm your email',  -0.80],
    ['security code',       -0.80],
    ['sign in',             -0.70],
    ['login',               -0.70],
    ['password',            -0.80],
    ['forgot',              -0.80],
    ['gift card',           -0.50],
    ['gift receipt',        -0.50],
    ['donation',            -0.40],
    ['survey',              -0.60],
    ['unsubscribe',         -0.30],
  ];
  for (const [k, w] of oneTimePenalties) {
    if (allLow.includes(k)) score += w; // w is already negative
  }

  // ── Known one-time-heavy sender domains ──────────────────────────────────
  const brand = brandFromDomain(senderDomain);
  const oneTimeSenders = new Set([
    'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy', 'bestbuy',
    'doordash', 'ubereats', 'grubhub', 'instacart', 'shipt',
    'lyft', 'uber',
    'airbnb', 'booking', 'expedia', 'hotels',
    'eventbrite',
  ]);
  if (oneTimeSenders.has(brand)) {
    // These senders DO have recurring services (Amazon Prime, Uber One, etc.)
    // but require explicit recurring language to pass — apply a baseline penalty
    score -= 0.35;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * 24-hour dedup: within a single scan result set, if we already have a
 * suggestion from the same sender domain within 24 hours, skip duplicates.
 *
 * This is the core fix for Amazon shipping 3+ emails per order all getting
 * flagged as separate "subscriptions". It also prevents double-counting
 * monthly services that send both a charge email and a receipt email.
 *
 * Logic:
 * - Group by sender domain (root brand)
 * - Within each group, keep only the one email per 24h window
 * - Within a window, prefer the one with the highest confidence score
 * - If two emails are genuinely > 24h apart → they may be separate billing
 *   cycles and both are kept
 */
function deduplicateWithin24h(suggestions) {
  // Sort by date ascending so we process oldest first
  const sorted = [...suggestions].sort((a, b) => {
    const ta = a.emailDate ? a.emailDate.getTime() : 0;
    const tb = b.emailDate ? b.emailDate.getTime() : 0;
    return ta - tb;
  });

  const kept = [];
  // domain → last kept email date
  const lastKeptAt = new Map();

  for (const s of sorted) {
    const domain = s.senderDomain || 'unknown';
    const emailTs = s.emailDate ? s.emailDate.getTime() : null;
    const lastTs = lastKeptAt.get(domain);

    if (lastTs != null && emailTs != null) {
      const diffMs = emailTs - lastTs;
      const within24h = diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000;

      if (within24h) {
        // Within 24h window from same domain — check if this one scores higher
        // than the one we already kept in this window
        const existing = kept[kept.length - 1]; // last appended from this domain
        const existingIdx = kept.findIndex(k => k.senderDomain === domain);
        if (existingIdx !== -1 && s.confidence > kept[existingIdx].confidence) {
          // Replace with higher-confidence version
          kept.splice(existingIdx, 1, s);
        }
        // Either way, don't add a second entry for this 24h window
        continue;
      }
    }

    kept.push(s);
    if (emailTs != null) lastKeptAt.set(domain, emailTs);
  }

  return kept;
}

/**
 * Score an email as a recurring BILL (utility, insurance, mortgage, rent, loan).
 * Returns { confidence, iconKey, category } — separate from subscription scoring.
 *
 * Bills differ from subscriptions:
 * - Often come as PDF attachments (electricity, insurance, mortgage statements)
 * - Subject lines say "statement", "payment due", "amount due" not "renewal"
 * - Senders are utility companies, banks, insurance providers
 * - No "cancel anytime" or "plan" language
 */
function scoreBillCandidate({ subject = '', from = '', snippet = '', senderDomain = '', hasPdf = false, pdfFilename = '' }) {
  const allLow = `${subject} ${from} ${snippet} ${pdfFilename}`.toLowerCase();
  let score = 0;
  let iconKey = 'bill';
  let category = 'Bills';

  // ── Strong bill signals ──────────────────────────────────────────────────
  if (allLow.includes('payment due'))       { score += 0.50; }
  if (allLow.includes('amount due'))        { score += 0.50; }
  if (allLow.includes('balance due'))       { score += 0.45; }
  if (allLow.includes('bill ready'))        { score += 0.45; }
  if (allLow.includes('your bill'))         { score += 0.40; }
  if (allLow.includes('statement ready'))   { score += 0.45; }
  if (allLow.includes('monthly statement')) { score += 0.45; }
  if (allLow.includes('due date'))          { score += 0.30; }
  if (allLow.includes('past due'))          { score += 0.55; }
  if (allLow.includes('pay now'))           { score += 0.35; }
  if (allLow.includes('autopay'))           { score += 0.30; }

  // PDF attachment is a strong bill signal (insurance, mortgage, utility statements)
  if (hasPdf) { score += 0.35; }

  // ── Category detection with icon assignment ──────────────────────────────
  if (allLow.includes('electric') || allLow.includes('electricity') || allLow.includes('kwh') || allLow.includes('power company') || allLow.includes('energy bill') || allLow.includes('con ed') || allLow.includes('duke energy') || allLow.includes('pge') || allLow.includes('pg&e') || allLow.includes('xcel')) {
    score += 0.40; iconKey = 'electricity'; category = 'Electricity';
  } else if (allLow.includes('water') && (allLow.includes('bill') || allLow.includes('statement') || allLow.includes('due'))) {
    score += 0.40; iconKey = 'water'; category = 'Water';
  } else if ((allLow.includes('gas') || allLow.includes('natural gas')) && (allLow.includes('bill') || allLow.includes('statement') || allLow.includes('due'))) {
    score += 0.40; iconKey = 'gas'; category = 'Gas';
  } else if (allLow.includes('internet') || allLow.includes('broadband') || allLow.includes('wifi') || allLow.includes('comcast') || allLow.includes('xfinity') || allLow.includes('spectrum') || allLow.includes('cox') || allLow.includes('fios') || allLow.includes('att internet') || allLow.includes('at&t internet')) {
    score += 0.35; iconKey = 'wifi'; category = 'Internet';
  } else if (allLow.includes('phone') || allLow.includes('wireless') || allLow.includes('mobile') || allLow.includes('t-mobile') || allLow.includes('verizon') || allLow.includes('sprint') || allLow.includes('at&t mobility')) {
    score += 0.30; iconKey = 'phone'; category = 'Phone';
  } else if (allLow.includes('insurance') || allLow.includes('premium due') || allLow.includes('policy renewal') || allLow.includes('coverage') || allLow.includes('deductible') || allLow.includes('geico') || allLow.includes('state farm') || allLow.includes('allstate') || allLow.includes('progressive') || allLow.includes('usaa') || allLow.includes('anthem') || allLow.includes('blue cross') || allLow.includes('cigna') || allLow.includes('aetna') || allLow.includes('kaiser')) {
    score += 0.45;
    if (allLow.includes('health') || allLow.includes('medical') || allLow.includes('dental') || allLow.includes('vision')) {
      iconKey = 'health'; category = 'Health Insurance';
    } else if (allLow.includes('auto') || allLow.includes('car') || allLow.includes('vehicle')) {
      iconKey = 'car_insurance'; category = 'Car Insurance';
    } else if (allLow.includes('home') || allLow.includes('renters') || allLow.includes('homeowner')) {
      iconKey = 'home_insurance'; category = 'Home Insurance';
    } else if (allLow.includes('life')) {
      iconKey = 'life_insurance'; category = 'Life Insurance';
    } else {
      iconKey = 'home_insurance'; category = 'Insurance';
    }
  } else if (allLow.includes('mortgage') || allLow.includes('home loan') || allLow.includes('escrow') || allLow.includes('principal') || allLow.includes('wells fargo home') || allLow.includes('rocket mortgage') || allLow.includes('quicken loans')) {
    score += 0.50; iconKey = 'mortgage'; category = 'Mortgage';
  } else if ((allLow.includes('rent') || allLow.includes('rental payment')) && !allLow.includes('car rental') && !allLow.includes('rent confirmation') && !allLow.includes('rent a')) {
    score += 0.40; iconKey = 'home'; category = 'Rent';
  } else if (allLow.includes('loan') || allLow.includes('student loan') || allLow.includes('personal loan') || allLow.includes('credit card statement') || allLow.includes('sallie mae') || allLow.includes('navient') || allLow.includes('great lakes')) {
    score += 0.40; iconKey = 'loan'; category = 'Loan';
  } else if (allLow.includes('auto loan') || allLow.includes('car payment') || allLow.includes('vehicle payment')) {
    score += 0.40; iconKey = 'car_payment'; category = 'Car Payment';
  } else if (allLow.includes('gym') || allLow.includes('fitness') || allLow.includes('planet fitness') || allLow.includes('equinox')) {
    score += 0.25; iconKey = 'gym'; category = 'Gym';
  } else if (allLow.includes('trash') || allLow.includes('waste') || allLow.includes('garbage') || allLow.includes('recycl')) {
    score += 0.35; iconKey = 'trash'; category = 'Trash';
  }

  // ── Subscription noise penalties (bills don't say these) ─────────────────
  if (allLow.includes('subscription'))   score -= 0.20;
  if (allLow.includes('cancel anytime')) score -= 0.30;
  if (allLow.includes('your plan'))      score -= 0.20;
  if (allLow.includes('membership'))     score -= 0.15;
  if (allLow.includes('free trial'))     score -= 0.30;

  return { confidence: Math.max(0, Math.min(1, score)), iconKey, category };
}

async function llmClassifyIfNeeded(candidate) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  // Only run LLM on ambiguous cases — saves cost, adds no value at extremes
  if (candidate.confidence >= 0.70 || candidate.confidence <= 0.20) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const prompt = {
    role: 'user',
    content: `You are classifying whether an email represents a RECURRING subscription or membership charge (not a one-time purchase, order confirmation, shipping notice, or transactional email).

Return strict JSON only: {"is_subscription": boolean, "merchant": string, "cadence": "weekly"|"monthly"|"quarterly"|"yearly"|"unknown", "amount": number|null, "currency": string|null, "confidence": number}

Rules:
- is_subscription = true ONLY if there is clear evidence of recurring billing (renewal, subscription, membership, plan, auto-renew)
- Order confirmations, shipping emails, delivery updates, one-time purchases = false
- Amazon order emails = false unless explicitly about Amazon Prime/Kindle Unlimited/etc.
- confidence: 0.0–1.0

EMAIL:
From: ${candidate.rawFrom}
Subject: ${candidate.rawSubject}
Snippet: ${candidate.snippet}`,
  };

  const resp = await fetchJson(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [prompt],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0,
      }),
    },
    15_000
  );

  if (!resp.ok) return null;

  const text = resp.json?.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function gmailScanHandler(req, res) {
  try {
    const { user } = await requireUser(req);
    const accessToken = await getGoogleAccessToken(user.id);

    // ── Query 1: subscription signals ────────────────────────────────────────
    const subQuery = [
      '(',
        'subject:subscription OR',
        'subject:renewal OR',
        'subject:"auto-renew" OR',
        'subject:membership OR',
        'subject:"billing cycle" OR',
        'subject:"your plan" OR',
        'subject:invoice OR',
        'subject:receipt',
      ')',
      '-subject:"order confirmation"',
      '-subject:"your order"',
      '-subject:shipped',
      '-subject:delivered',
      '-subject:delivery',
      '-subject:tracking',
      '-subject:"security code"',
      '-subject:"verify your"',
      '-subject:"confirm your email"',
      '-subject:"sign in"',
      '-subject:password',
      '-subject:refund',
      '-subject:"gift card"',
    ].join(' ');

    // ── Query 2: recurring bill signals (utilities, insurance, mortgage, rent) ─
    // Intentionally does NOT exclude has:attachment — insurance/mortgage PDFs
    // arrive as attachments and we want to detect them.
    const billQuery = [
      '(',
        'subject:statement OR',
        'subject:"payment due" OR',
        'subject:"bill ready" OR',
        'subject:"your bill" OR',
        'subject:"amount due" OR',
        'subject:"balance due" OR',
        'subject:"policy renewal" OR',
        'subject:"premium due" OR',
        'subject:"premium notice" OR',
        'subject:"insurance" OR',
        'subject:"mortgage" OR',
        'subject:"loan statement" OR',
        'subject:utility OR',
        'subject:utilities OR',
        'subject:"electric" OR',
        'subject:"water bill" OR',
        'subject:"gas bill" OR',
        'subject:"rent payment" OR',
        'subject:"rent due" OR',
        'subject:"rent reminder"',
      ')',
      '-subject:"order confirmation"',
      '-subject:shipped',
      '-subject:delivered',
      '-subject:password',
      '-subject:"security code"',
      '-subject:"verify your"',
    ].join(' ');

    // Fetch both in parallel
    const [subList, billList] = await Promise.all([
      fetchJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(subQuery)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        15_000
      ),
      fetchJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(billQuery)}&maxResults=30`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        15_000
      ),
    ]);

    if (!subList.ok) {
      return res.status(400).json({ error: subList.json?.error?.message || 'Gmail list failed' });
    }

    // Merge message lists, deduplicate by message ID
    const subMsgs  = Array.isArray(subList.json?.messages)  ? subList.json.messages  : [];
    const billMsgs = Array.isArray(billList.json?.messages) ? billList.json.messages : [];
    const allMsgIds = new Set();
    const mergedMsgs = [];
    const billMsgIds = new Set(billMsgs.map(m => m.id));

    for (const m of [...subMsgs, ...billMsgs]) {
      if (allMsgIds.has(m.id)) continue;
      allMsgIds.add(m.id);
      mergedMsgs.push({ ...m, _fromBillQuery: billMsgIds.has(m.id) });
    }

    const candidates = [];

    for (const m of mergedMsgs) {
      // Use full metadata including Parts for PDF detection
      const msg = await fetchJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        12_000
      );
      if (!msg.ok) continue;

      const headers = msg.json?.payload?.headers || [];
      const subject  = headers.find(h => h.name === 'Subject')?.value || '';
      const from     = headers.find(h => h.name === 'From')?.value || '';
      const date     = headers.find(h => h.name === 'Date')?.value || '';
      const snippet  = msg.json?.snippet || '';

      // ── PDF attachment detection ──────────────────────────────────────────
      // Gmail metadata format returns parts array with mimeType info
      const parts = msg.json?.payload?.parts || [];
      const pdfPart = parts.find(p =>
        p.mimeType === 'application/pdf' ||
        (p.filename && p.filename.toLowerCase().endsWith('.pdf'))
      );
      const hasPdf = !!pdfPart;
      const pdfFilename = pdfPart?.filename || '';

      const senderDomain = extractSenderDomain(from);
      const allText = `${subject} ${snippet} ${pdfFilename}`;

      // ── Score as subscription vs bill ─────────────────────────────────────
      const subConfidence  = scoreCandidate({ subject, from, snippet, senderDomain });
      const billResult     = scoreBillCandidate({ subject, from, snippet, senderDomain, hasPdf, pdfFilename });

      // Determine which kind wins
      const isBillSignal = billResult.confidence > 0.40 && billResult.confidence >= subConfidence;
      const isSubSignal  = subConfidence >= 0.55;

      // Pre-filter: drop anything that scores low on both
      if (!isSubSignal && !isBillSignal) continue;

      const merchant = normalizeMerchant(from, senderDomain);
      const amount   = parseAmount(allText);
      const currency = parseCurrency(allText);
      const emailDate = parseEmailDate(date);

      if (isBillSignal && !isSubSignal) {
        // Pure bill — bypass subscription dedup and LLM
        let cadence = 'monthly';
        const low = allText.toLowerCase();
        if (low.includes('annual') || low.includes('year')) cadence = 'yearly';
        if (low.includes('quarter')) cadence = 'quarterly';

        candidates.push({
          messageId: m.id,
          kind: 'bill',
          merchant,
          senderDomain,
          amount,
          currency,
          cadence,
          confidence: billResult.confidence,
          iconKey: billResult.iconKey,
          category: billResult.category,
          rawSubject: subject,
          rawFrom: from,
          rawDate: date,
          emailDate,
          snippet,
          hasPdf,
          pdfFilename,
        });
      } else {
        // Subscription candidate (or ambiguous — LLM will decide)
        let cadence = null;
        const low = allText.toLowerCase();
        if (low.includes('annual') || low.includes('year'))  cadence = 'yearly';
        else if (low.includes('quarter'))                     cadence = 'quarterly';
        else if (low.includes('weekly'))                      cadence = 'weekly';
        else if (low.includes('month'))                       cadence = 'monthly';

        candidates.push({
          messageId: m.id,
          kind: 'subscription',
          merchant,
          senderDomain,
          amount,
          currency,
          cadence,
          confidence: subConfidence,
          rawSubject: subject,
          rawFrom: from,
          rawDate: date,
          emailDate,
          snippet,
        });
      }
    }

    // ── 24h dedup (subscriptions only — bills are already one per month) ────
    const subCandidates  = candidates.filter(c => c.kind === 'subscription');
    const billCandidates = candidates.filter(c => c.kind === 'bill');

    const dedupedSubs = deduplicateWithin24h(subCandidates);

    // ── LLM pass on ambiguous subscription survivors ──────────────────────
    const suggestions = [];

    for (const c of dedupedSubs) {
      let enriched = null;
      const maybeLLM = await llmClassifyIfNeeded(c);
      if (maybeLLM && typeof maybeLLM === 'object') {
        enriched = maybeLLM;
      }

      const finalConfidence = enriched?.confidence ?? c.confidence;
      const isSub = enriched
        ? !!enriched.is_subscription && finalConfidence >= 0.40
        : c.confidence >= 0.55;

      if (!isSub) continue;

      const finalCadence = (enriched?.cadence && enriched.cadence !== 'unknown')
        ? enriched.cadence
        : (c.cadence || 'monthly');
      suggestions.push({
        messageId:   c.messageId,
        kind:        'subscription',
        merchant:    (() => {
                       const llmMerchant = enriched?.merchant;
                       // Only trust LLM merchant if it looks like a brand name (≤3 words, no sentence noise)
                       const looksLikeBrand = llmMerchant && /^[a-z0-9\s.+\-]{1,40}$/i.test(llmMerchant) && llmMerchant.trim().split(/\s+/).length <= 3;
                       return looksLikeBrand
                         ? applyBrandMap(brandFromDomain(llmMerchant.toLowerCase()) || llmMerchant)
                         : c.merchant;
                     })(),
        senderDomain: c.senderDomain,
        amount:      enriched?.amount ?? c.amount,
        currency:    enriched?.currency || c.currency,
        cadence:     finalCadence,
        renewalDate: estimateRenewalDate(c.emailDate, finalCadence),
        confidence:  finalConfidence,
        rawSubject:  c.rawSubject,
        rawFrom:     c.rawFrom,
        rawDate:     c.rawDate,
      });
    }

    // Bill candidates go straight through — no LLM needed, signals are clear
    for (const c of billCandidates) {
      // 24h dedup for bills too (insurance sends multiple reminder emails)
      suggestions.push({
        messageId:   c.messageId,
        kind:        'bill',
        merchant:    c.merchant,
        senderDomain: c.senderDomain,
        amount:      c.amount,
        currency:    c.currency,
        cadence:     c.cadence,
        renewalDate: estimateRenewalDate(c.emailDate, c.cadence),
        confidence:  c.confidence,
        iconKey:     c.iconKey,
        category:    c.category,
        hasPdf:      c.hasPdf,
        pdfFilename: c.pdfFilename,
        rawSubject:  c.rawSubject,
        rawFrom:     c.rawFrom,
        rawDate:     c.rawDate,
      });
    }

    // Deduplicate bill suggestions by sender domain (keep highest confidence per domain)
    const billByDomain = new Map();
    const dedupedSuggestions = suggestions.filter(s => s.kind === 'subscription');
    for (const s of suggestions.filter(s => s.kind === 'bill')) {
      const existing = billByDomain.get(s.senderDomain);
      if (!existing || s.confidence > existing.confidence) {
        billByDomain.set(s.senderDomain, s);
      }
    }
    dedupedSuggestions.push(...billByDomain.values());

    // Persist scan results to scan_candidates (the real table for detected items)
    // Each suggestion gets a fingerprint so duplicates are ignored on re-scan.
    try {
      if (dedupedSuggestions.length) {
        const rows = dedupedSuggestions.map(s => ({
          user_id:     user.id,
          session_id:  null,  // no session for direct Gmail scan — use a null-safe default
          fingerprint: `gmail:${s.senderDomain || s.merchant}:${s.kind}`,
          candidate:   s,
          created_at:  new Date().toISOString(),
        }));

        // scan_candidates requires session_id (NOT NULL) — persist to subscriptions
        // table instead as suggested candidates (is_suggested = true).
        const subRows = dedupedSuggestions
          .filter(s => s.kind === 'subscription')
          .map(s => ({
            user_id:          user.id,
            merchant:         s.merchant,
            renewal_amount:   s.amount,
            amount:           s.amount,
            currency:         s.currency || 'USD',
            billing_interval: s.cadence || 'monthly',
            cadence:          s.cadence || 'monthly',
            renewal_date:     s.renewalDate || null,
            sender_domain:    s.senderDomain || null,
            raw_subject:      s.rawSubject || null,
            raw_from:         s.rawFrom || null,
            confidence:       s.confidence,
            is_suggested:     true,
            is_active:        true,
            source:           'gmail_scan',
            updated_at:       new Date().toISOString(),
          }));

        if (subRows.length) {
          await supabase
            .from('subscriptions')
            .upsert(subRows, { onConflict: 'user_id,merchant', ignoreDuplicates: false });
        }
      }
    } catch {
      // Non-fatal — suggestions are still returned to the client
    }

    return res.json({ ok: true, suggestions: dedupedSuggestions });
  } catch (e) {
    return res.status(400).json({ error: e?.message || String(e) });
  }
}

app.post('/mail/google/scan', gmailScanHandler);
// Client calls /scan — alias to the same handler
app.post('/scan', gmailScanHandler);

// ── GET /subscriptions — return stored scan candidates for this user ──────────
app.get('/subscriptions', async (req, res) => {
  try {
    const { user } = await requireUser(req);

    const { data, error } = await supabase
      .from('subscriptions')
      .select('id,merchant,amount,renewal_amount,currency,billing_interval,cadence,renewal_date,sender_domain,raw_subject,raw_from,confidence,is_suggested,is_active,source,created_at')
      .eq('user_id', user.id)
      .eq('is_suggested', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Normalise field names so the client doesn't need to handle both variants
    const subscriptions = (data || []).map(s => ({
      id:              s.id,
      merchant:        s.merchant,
      amount:          s.amount ?? s.renewal_amount ?? null,
      currency:        s.currency || 'USD',
      billingInterval: s.billing_interval || s.cadence || 'monthly',
      cadence:         s.billing_interval || s.cadence || 'monthly',
      renewalDate:     s.renewal_date || null,
      senderDomain:    s.sender_domain || null,
      rawSubject:      s.raw_subject || null,
      rawFrom:         s.raw_from || null,
      confidence:      s.confidence || 0,
      isSuggested:     s.is_suggested !== false,
      isActive:        s.is_active !== false,
      source:          s.source || 'gmail',
    }));

    return res.json({ subscriptions, meta: { count: subscriptions.length } });
  } catch (e) {
    return res.status(401).json({ error: e?.message || String(e) });
  }
});

// ── DELETE ACCOUNT ───────────────────────────────────────────────────────────
// Requires a valid user Bearer token. Uses service role to:
// 1. Delete user data from application tables (best-effort)
// 2. Delete the auth user — profiles cascades automatically via FK
app.delete('/account/delete', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    const userId = user.id;

    // Tables that exist and use user_id as FK column
    const userIdTables = [
      'scan_sessions',
      'scan_candidates',
      'scan_metadata',
      'scan_events',
      'push_tokens',
      'subscriptions',
    ];

    for (const table of userIdTables) {
      try {
        await supabase.from(table).delete().eq('user_id', userId);
      } catch {
        // Non-fatal — auth user deletion is the critical step
      }
    }

    // profiles uses `id` (not user_id) as PK with ON DELETE CASCADE on auth.users
    // Explicit delete handles any missing FK constraint
    try {
      await supabase.from('profiles').delete().eq('id', userId);
    } catch {}

    // Delete the auth user — invalidates all sessions immediately.
    // Must be last since requireUser() reads from auth.users.
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to delete account' });
    }

    return res.json({ ok: true, deleted: true });
  } catch (e) {
    return res.status(401).json({ error: e?.message || String(e) });
  }
});

// Basic error handler (e.g. CORS failures)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.message === 'Not allowed by CORS') return res.status(403).json({ error: 'Forbidden' });
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});