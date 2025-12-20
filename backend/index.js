import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT || 8787);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

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
    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Server missing GOOGLE_OAUTH_CLIENT_ID/SECRET' });
    }

    const { user } = await requireUser(req);
    const { code, codeVerifier, redirectUri } = req.body || {};

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Missing code or redirectUri' });
    }

    const form = new URLSearchParams();
    form.set('code', code);
    form.set('client_id', GOOGLE_OAUTH_CLIENT_ID);
    form.set('client_secret', GOOGLE_OAUTH_CLIENT_SECRET);
    form.set('redirect_uri', redirectUri);
    form.set('grant_type', 'authorization_code');
    if (codeVerifier) form.set('code_verifier', codeVerifier);

    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const json = await tok.json();
    if (!tok.ok) {
      return res.status(400).json({ error: json?.error_description || json?.error || 'Token exchange failed' });
    }

    const now = Date.now();
    const expiresAt = json.expires_in ? new Date(now + json.expires_in * 1000).toISOString() : null;

    const row = {
      user_id: user.id,
      provider: 'google',
      access_token: json.access_token,
      refresh_token: json.refresh_token || null,
      scope: json.scope || null,
      token_type: json.token_type || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('mail_connections').upsert(row, { onConflict: 'user_id,provider' });
    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to store connection' });
    }

    return res.json({ ok: true, connected: true, provider: 'google' });
  } catch (e) {
    return res.status(401).json({ error: e?.message || String(e) });
  }
});

async function getGoogleAccessToken(userId) {
  const { data, error } = await supabase
    .from('mail_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (error || !data) throw new Error('No Gmail connection found');

  // If we have a non-expired access token, use it
  if (data.access_token && data.expires_at && new Date(data.expires_at).getTime() > Date.now() + 60_000) {
    return data.access_token;
  }

  if (!data.refresh_token) throw new Error('Missing refresh token. Reconnect Gmail.');
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Server missing Google OAuth config');
  }

  const form = new URLSearchParams();
  form.set('client_id', GOOGLE_OAUTH_CLIENT_ID);
  form.set('client_secret', GOOGLE_OAUTH_CLIENT_SECRET);
  form.set('refresh_token', data.refresh_token);
  form.set('grant_type', 'refresh_token');

  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const json = await tok.json();
  if (!tok.ok) throw new Error(json?.error_description || json?.error || 'Failed to refresh access token');

  const now = Date.now();
  const expiresAt = json.expires_in ? new Date(now + json.expires_in * 1000).toISOString() : null;

  await supabase.from('mail_connections').upsert({
    user_id: userId,
    provider: 'google',
    access_token: json.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  return json.access_token;
}

function normalizeMerchant(from = '') {
  // "Netflix <billing@netflix.com>" -> "Netflix"
  const cleaned = String(from).replace(/<.*?>/g, '').trim();
  return cleaned.replace(/\"/g, '').trim();
}

function parseAmount(text = '') {
  const s = String(text);
  // $12.99 or USD 12.99
  const m = s.match(/(USD|US\$|\$)\s?([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!m) return null;
  const amount = Number(m[2]);
  return Number.isFinite(amount) ? amount : null;
}

function scoreCandidate({ subject = '', from = '', snippet = '' }) {
  const txt = `${subject} ${from} ${snippet}`.toLowerCase();
  let score = 0;
  const hits = [
    ['subscription', 0.35],
    ['monthly', 0.15],
    ['yearly', 0.15],
    ['renew', 0.25],
    ['renewal', 0.25],
    ['receipt', 0.2],
    ['invoice', 0.2],
    ['charged', 0.25],
    ['payment', 0.2],
    ['plan', 0.15],
    ['membership', 0.25],
    ['trial', 0.2],
    ['auto-renew', 0.35],
  ];
  for (const [k, w] of hits) if (txt.includes(k)) score += w;

  // Some noise reduction
  if (txt.includes('one-time') || txt.includes('one time')) score -= 0.15;
  if (txt.includes('refund')) score -= 0.25;

  return Math.max(0, Math.min(1, score));
}

async function llmClassifyIfNeeded(candidate) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  // only for ambiguous stuff
  if (candidate.confidence >= 0.75 || candidate.confidence <= 0.25) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const prompt = {
    role: 'user',
    content: `Decide if this email looks like a recurring subscription charge.\n\nReturn strict JSON: {"is_subscription": boolean, "merchant": string, "cadence": "weekly"|"monthly"|"quarterly"|"yearly"|"unknown", "amount": number|null, "currency": string|null, "confidence": number}.\n\nEMAIL:\nFrom: ${candidate.from}\nSubject: ${candidate.subject}\nSnippet: ${candidate.snippet}`,
  };

  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: [prompt],
      response_format: { type: 'json_object' },
      max_output_tokens: 200,
    }),
  });

  const json = await resp.json();
  if (!resp.ok) return null;

  const text = json.output_text || '';
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

app.post('/mail/google/scan', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    const accessToken = await getGoogleAccessToken(user.id);

    // 1) search for likely subscription receipts
    const q = [
      '(receipt OR invoice OR subscription OR renewal OR "auto-renew" OR charged OR payment)',
      '-(password OR login OR security code OR verification)',
    ].join(' ');

    const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=25`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const listJson = await list.json();
    if (!list.ok) {
      return res.status(400).json({ error: listJson?.error?.message || 'Gmail list failed' });
    }

    const msgs = Array.isArray(listJson.messages) ? listJson.messages : [];

    const suggestions = [];

    for (const m of msgs) {
      const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const msgJson = await msg.json();
      if (!msg.ok) continue;

      const headers = msgJson.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || '';
      const from = headers.find((h) => h.name === 'From')?.value || '';
      const date = headers.find((h) => h.name === 'Date')?.value || '';
      const snippet = msgJson.snippet || '';

      const confidence = scoreCandidate({ subject, from, snippet });

      // crude extraction
      const merchant = normalizeMerchant(from);
      const amount = parseAmount(subject) ?? parseAmount(snippet);
      let cadence = 'monthly';
      const low = `${subject} ${snippet}`.toLowerCase();
      if (low.includes('annual') || low.includes('year')) cadence = 'yearly';
      if (low.includes('quarter')) cadence = 'quarterly';
      if (low.includes('weekly')) cadence = 'weekly';

      let enriched = null;
      const maybeLLM = await llmClassifyIfNeeded({ from, subject, snippet, confidence });
      if (maybeLLM && typeof maybeLLM === 'object') {
        enriched = maybeLLM;
      }

      const isSub = enriched ? !!enriched.is_subscription : confidence >= 0.55;
      if (!isSub) continue;

      const sug = {
        messageId: m.id,
        merchant: enriched?.merchant || merchant,
        amount: enriched?.amount ?? amount,
        currency: enriched?.currency || 'USD',
        cadence: (enriched?.cadence && enriched.cadence !== 'unknown') ? enriched.cadence : cadence,
        confidence: enriched?.confidence ?? confidence,
        rawSubject: subject,
        rawFrom: from,
        rawDate: date,
      };

      suggestions.push(sug);
    }

    // Optional: persist in Supabase table for cross-device.
    // If the table doesn't exist yet, just return results.
    try {
      if (suggestions.length) {
        const rows = suggestions.map((s) => ({
          user_id: user.id,
          provider: 'google',
          message_id: s.messageId,
          merchant: s.merchant,
          amount: s.amount,
          currency: s.currency,
          cadence: s.cadence,
          confidence: s.confidence,
          raw_subject: s.rawSubject,
          raw_from: s.rawFrom,
          raw_date: s.rawDate,
        }));
        await supabase.from('mail_subscription_suggestions').upsert(rows, { onConflict: 'user_id,provider,message_id' });
      }
    } catch {
      // ignore; table may not exist yet
    }

    return res.json({ ok: true, suggestions });
  } catch (e) {
    return res.status(400).json({ error: e?.message || String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`sublytics-backend listening on :${PORT}`);
});
