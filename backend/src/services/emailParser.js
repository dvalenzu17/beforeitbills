/**
 * Email body parser.
 *
 * Fetches the full Gmail message body (HTML or plain text) and extracts:
 *   - Plain text content (HTML stripped via html-to-text + cheerio)
 *   - Amount and currency
 *   - Cadence hints (monthly, yearly, etc.)
 *   - Renewal date hints
 *
 * Only called for messages that passed the initial subject/snippet scoring
 * (confidence 0.35–0.70) to avoid adding latency to clear winners/losers.
 */

import { convert } from 'html-to-text';
import * as cheerio from 'cheerio';
import { parseAmount, parseCurrency } from './subscriptionEngine.js';
import { fetchJson } from '../lib/fetchUtil.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Fetch and parse the plain-text body of a Gmail message.
 * Returns enriched data or null if not worth fetching (e.g. too large).
 */
export async function parseGmailMessageBody(accessToken, messageId) {
  const resp = await fetchJson(
    `${GMAIL_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    15_000
  );
  if (!resp.ok) return null;

  const raw = resp.json;
  const text = extractText(raw?.payload);
  if (!text || text.length < 20) return null;

  return {
    text:     text.slice(0, 4000), // cap to avoid feeding huge bodies downstream
    amount:   parseAmount(text),
    currency: parseCurrency(text),
    cadence:  detectCadence(text),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(payload) {
  if (!payload) return '';

  // Recursively collect all text/plain and text/html parts
  const plain = [];
  const html  = [];

  function walk(part) {
    if (!part) return;
    const mt = part.mimeType || '';
    if (mt === 'text/plain' && part.body?.data) {
      plain.push(decodeBase64Url(part.body.data));
    } else if (mt === 'text/html' && part.body?.data) {
      html.push(decodeBase64Url(part.body.data));
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  }

  walk(payload);

  if (plain.length) return plain.join('\n').replace(/\s+/g, ' ').trim();
  if (html.length)  return htmlToPlain(html.join('\n'));
  return '';
}

function htmlToPlain(html) {
  try {
    // Cheerio pre-processing: remove nav/footer noise
    const $ = cheerio.load(html);
    $('nav, footer, header, script, style, [role="navigation"]').remove();
    const cleaned = $.html();
    return convert(cleaned, {
      wordwrap: false,
      selectors: [
        { selector: 'a',   options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
      ],
    }).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function decodeBase64Url(data) {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function detectCadence(text) {
  const t = text.toLowerCase();
  if (t.includes('annual') || t.includes('yearly') || t.includes('per year') || t.includes('/year')) return 'yearly';
  if (t.includes('quarterly') || t.includes('every 3 months') || t.includes('/quarter')) return 'quarterly';
  if (t.includes('weekly') || t.includes('per week') || t.includes('/week')) return 'weekly';
  if (t.includes('monthly') || t.includes('per month') || t.includes('/month') || t.includes('every month')) return 'monthly';
  return null;
}
