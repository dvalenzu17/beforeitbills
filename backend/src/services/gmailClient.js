import { fetchJson } from '../lib/fetchUtil.js';
import { decryptCredential, encryptCredential } from './crypto.js';
import { getGmailTokens, updateGmailAccessToken } from '../db/index.js';
import { CircuitBreaker, withRetry } from './retryUtil.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE       = 'https://gmail.googleapis.com/gmail/v1/users/me';

// One circuit breaker per process — shared across all users
// Opens after 5 consecutive Gmail API failures, resets after 30s
const gmailBreaker = new CircuitBreaker({ threshold: 5, resetMs: 30_000, name: 'gmail-api' });

// Wrap fetch with retry + circuit breaker for Gmail API calls
async function gmailFetch(url, options, timeoutMs = 12_000) {
  return gmailBreaker.execute(() =>
    withRetry(
      () => fetchJson(url, options, timeoutMs),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        // Only retry on network errors, not 4xx responses
        shouldRetry: (err) => !err?.message?.includes('circuit_open'),
      }
    )
  );
}

// ── Access token management ───────────────────────────────────────────────────

/**
 * Returns a valid Gmail access token for the user.
 * Refreshes automatically if the stored token is within 60s of expiry.
 */
export async function getValidAccessToken(userId) {
  const row = await getGmailTokens(userId);
  if (!row) throw new Error('No Gmail connection found. Reconnect your Gmail account.');

  // Token is fresh — use as-is
  if (row.access_token && row.token_expires_at &&
      new Date(row.token_expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token;
  }

  if (!row.refresh_token) throw new Error('Missing refresh token. Reconnect Gmail.');

  const refreshToken = decryptCredential(row.refresh_token);
  if (!refreshToken) throw new Error('Invalid refresh token. Reconnect Gmail.');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Missing GOOGLE_CLIENT_ID on server.');

  const form = new URLSearchParams({
    client_id:     clientId,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
  });
  if (process.env.GOOGLE_CLIENT_SECRET) {
    form.set('client_secret', process.env.GOOGLE_CLIENT_SECRET);
  }

  const tok = await fetchJson(
    GOOGLE_TOKEN_URL,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() },
    12_000
  );
  if (!tok.ok) throw new Error(tok.json?.error_description || tok.json?.error || 'Failed to refresh access token');

  const { access_token, refresh_token: newRefresh, expires_in } = tok.json;
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  await updateGmailAccessToken(userId, {
    accessToken:  access_token,
    refreshToken: newRefresh ? encryptCredential(newRefresh) : null,
    expiresAt,
  });

  return access_token;
}

// ── Gmail API helpers ─────────────────────────────────────────────────────────

/**
 * List message IDs matching a Gmail search query.
 * Returns { ids: string[], fromBillQuery: Set<string> }
 */
export async function listMessages(accessToken, { daysBack = 180 } = {}) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const afterStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`;

  const subQuery = [
    '(',
      'subject:subscription OR subject:renewal OR subject:"auto-renew" OR',
      'subject:membership OR subject:"billing cycle" OR subject:"your plan" OR',
      'subject:invoice OR subject:receipt OR subject:payment OR',
      'subject:charged OR subject:billing OR subject:"your subscription" OR',
      'subject:"payment confirmation" OR subject:"payment received" OR',
      'subject:"thanks for subscribing" OR subject:"thank you for subscribing" OR',
      'subject:"your membership" OR subject:"account charged" OR subject:billed',
    ')',
    `-subject:"order confirmation" -subject:"your order" -subject:shipped`,
    `-subject:delivered -subject:delivery -subject:tracking`,
    `-subject:"security code" -subject:"verify your" -subject:"confirm your email"`,
    `-subject:"sign in" -subject:password -subject:refund -subject:"gift card"`,
    `-subject:"order shipped" -subject:"order has shipped" -subject:"order tracking"`,
    `after:${afterStr}`,
  ].join(' ');

  const billQuery = [
    '(',
      'subject:statement OR subject:"payment due" OR subject:"bill ready" OR',
      'subject:"your bill" OR subject:"amount due" OR subject:"balance due" OR',
      'subject:"policy renewal" OR subject:"premium due" OR subject:insurance OR',
      'subject:mortgage OR subject:"loan statement" OR subject:utility OR',
      'subject:utilities OR subject:electric OR subject:"water bill" OR',
      'subject:"gas bill" OR subject:"rent payment" OR subject:"rent due"',
    ')',
    `-subject:"order confirmation" -subject:shipped -subject:delivered`,
    `-subject:password -subject:"security code" -subject:"verify your"`,
    `after:${afterStr}`,
  ].join(' ');

  const [subList, billList] = await Promise.all([
    gmailFetch(`${GMAIL_BASE}/messages?q=${encodeURIComponent(subQuery)}&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }, 15_000),
    gmailFetch(`${GMAIL_BASE}/messages?q=${encodeURIComponent(billQuery)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }, 15_000),
  ]);

  if (!subList.ok) {
    throw new Error(subList.json?.error?.message || 'Gmail list failed');
  }

  const subMsgs  = Array.isArray(subList.json?.messages)  ? subList.json.messages  : [];
  const billMsgs = Array.isArray(billList.json?.messages) ? billList.json.messages : [];
  const billIds  = new Set(billMsgs.map(m => m.id));

  const seen = new Set();
  const merged = [];
  for (const m of [...subMsgs, ...billMsgs]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push({ id: m.id, fromBillQuery: billIds.has(m.id) });
  }

  return merged;
}

/**
 * Fetch metadata for a single Gmail message.
 * Returns a normalised EmailObject or null on failure.
 */
export async function fetchMessage(accessToken, messageId) {
  const msg = await gmailFetch(
    `${GMAIL_BASE}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    12_000
  );
  if (!msg.ok) return null;

  const headers     = msg.json?.payload?.headers || [];
  const subject     = headers.find(h => h.name === 'Subject')?.value || '';
  const from        = headers.find(h => h.name === 'From')?.value    || '';
  const date        = headers.find(h => h.name === 'Date')?.value    || '';
  const snippet     = msg.json?.snippet || '';
  const parts       = msg.json?.payload?.parts || [];
  const pdfPart     = parts.find(p => p.mimeType === 'application/pdf' || p.filename?.toLowerCase().endsWith('.pdf'));

  const { extractSenderDomain } = await import('./subscriptionEngine.js');

  return {
    messageId,
    subject,
    from,
    date,
    senderDomain: extractSenderDomain(from),
    snippet,
    hasPdf:      !!pdfPart,
    pdfFilename: pdfPart?.filename || '',
  };
}
