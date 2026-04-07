import crypto from 'crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { fetchJson } from '../lib/fetchUtil.js';
import { requireUser } from '../lib/auth.js';
import { encryptCredential } from '../services/crypto.js';
import { saveOAuthTokens } from '../db/index.js';

const GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_AUTH_BASE    = 'https://accounts.google.com/o/oauth2/v2/auth';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// HMAC key for signing OAuth state — reuse the encryption key
const STATE_SECRET = process.env.TOKEN_ENCRYPTION_KEY || '';

function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyState(stateParam) {
  const [data, sig] = (stateParam || '').split('.');
  if (!data || !sig) throw new Error('Invalid state');
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('State signature invalid');
  }
  const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error('State expired');
  return parsed;
}

// ── Body schemas ──────────────────────────────────────────────────────────────

const exchangeSchema = z.object({
  code:          z.string().min(1).max(4096),
  redirectUri:   z.string().url().max(2048),
  clientId:      z.string().min(1).optional(),
  codeVerifier:  z.string().min(1).optional(),
});

// ── Rate limit config (per user, 10 exchanges / 15 min) ───────────────────────
const OAUTH_RATE_LIMIT = {
  max: 10,
  timeWindow: '15 minutes',
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return decoded?.sub ?? req.ip;
    } catch { return req.ip; }
  },
  errorResponseBuilder: () => ({ error: 'rate_limited', message: 'Too many requests. Try again in 15 minutes.' }),
};

// ── Route registration ────────────────────────────────────────────────────────

export function registerOAuthRoutes(server) {

  /**
   * POST /oauth/google/exchange
   * Native / PKCE flow — mobile app exchanges an auth code for tokens.
   * The app sends clientId + codeVerifier; the backend exchanges with Google
   * and stores the encrypted refresh token.
   */
  server.post('/oauth/google/exchange', { config: { rateLimit: OAUTH_RATE_LIMIT } }, async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return; // 401 already sent

    const parsed = exchangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { code, redirectUri, clientId: bodyClientId, codeVerifier } = parsed.data;
    const effectiveClientId = bodyClientId || process.env.GOOGLE_CLIENT_ID;
    if (!effectiveClientId) {
      return reply.code(400).send({ error: 'missing_client_id', message: 'Send clientId in body or set GOOGLE_CLIENT_ID env var' });
    }

    const form = new URLSearchParams({
      code,
      client_id:    effectiveClientId,
      redirect_uri: redirectUri,
      grant_type:   'authorization_code',
    });
    if (codeVerifier) form.set('code_verifier', codeVerifier);
    if (process.env.GOOGLE_CLIENT_SECRET && effectiveClientId === process.env.GOOGLE_CLIENT_ID) {
      form.set('client_secret', process.env.GOOGLE_CLIENT_SECRET);
    }

    const tok = await fetchJson(
      GOOGLE_TOKEN_URL,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() },
      12_000
    );
    if (!tok.ok) {
      return reply.code(400).send({ error: 'token_exchange_failed', message: tok.json?.error_description || tok.json?.error || 'Token exchange failed' });
    }

    const { access_token, refresh_token, expires_in } = tok.json;
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    // Fetch Gmail address to store alongside the connection
    let gmailEmail = null;
    if (access_token) {
      const info = await fetchJson(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } }, 8_000);
      if (info.ok) gmailEmail = info.json?.email ?? null;
    }

    try {
      await saveOAuthTokens(auth.userId, {
        provider:     'google',
        accessToken:  access_token,
        refreshToken: refresh_token ? encryptCredential(refresh_token) : null,
        expiresAt,
        email:        gmailEmail,
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to persist OAuth tokens');
      return reply.code(500).send({ error: 'storage_failed', message: 'Failed to store connection' });
    }

    return reply.send({ ok: true, connected: true, provider: 'google', email: gmailEmail });
  });

  /**
   * GET /auth/google
   * Web OAuth init — builds a Google consent URL and redirects.
   * The user's Supabase JWT must be passed as ?token=<jwt> since
   * browser-initiated redirects cannot send custom headers.
   * The userId is embedded in a signed state parameter.
   */
  server.get('/auth/google', async (req, reply) => {
    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return reply.code(503).send({ error: 'oauth_not_configured', message: 'Web OAuth is not configured on this server' });
    }

    // Validate the passed JWT to get userId
    const tokenParam = req.query?.token;
    if (!tokenParam) return reply.code(401).send({ error: 'missing_token' });

    let userId;
    try {
      const payload = jwt.verify(tokenParam, process.env.SUPABASE_JWT_SECRET);
      userId = payload.sub;
    } catch {
      return reply.code(401).send({ error: 'invalid_token' });
    }

    const state = signState({ userId, nonce: crypto.randomBytes(8).toString('hex'), ts: Date.now() });

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         GMAIL_SCOPES,
      access_type:   'offline',
      prompt:        'consent',
      state,
    });

    return reply.redirect(`${GOOGLE_AUTH_BASE}?${params.toString()}`);
  });

  /**
   * GET /auth/google/callback
   * Google redirects here after user consent.
   * Verifies state, exchanges code, saves tokens, redirects to deep link.
   */
  server.get('/auth/google/callback', async (req, reply) => {
    const { code, state: stateParam, error: oauthError } = req.query || {};

    if (oauthError) {
      return reply.code(400).send({ error: 'oauth_denied', message: oauthError });
    }

    let stateData;
    try {
      stateData = verifyState(stateParam);
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_state', message: err.message });
    }

    if (!code) return reply.code(400).send({ error: 'missing_code' });

    const clientId    = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

    const form = new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    });

    const tok = await fetchJson(
      GOOGLE_TOKEN_URL,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() },
      12_000
    );
    if (!tok.ok) {
      return reply.code(400).send({ error: 'token_exchange_failed' });
    }

    const { access_token, refresh_token, expires_in } = tok.json;
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    let gmailEmail = null;
    if (access_token) {
      const info = await fetchJson(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } }, 8_000);
      if (info.ok) gmailEmail = info.json?.email ?? null;
    }

    try {
      await saveOAuthTokens(stateData.userId, {
        provider:     'google',
        accessToken:  access_token,
        refreshToken: refresh_token ? encryptCredential(refresh_token) : null,
        expiresAt,
        email:        gmailEmail,
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to persist web OAuth tokens');
      return reply.code(500).send({ error: 'storage_failed' });
    }

    const deepLink = process.env.GOOGLE_APP_DEEP_LINK || 'beforeitbills://oauth-success';
    return reply.redirect(`${deepLink}?provider=google&email=${encodeURIComponent(gmailEmail || '')}`);
  });
}
