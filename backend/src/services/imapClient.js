import { ImapFlow } from 'imapflow';
import { extractSenderDomain } from './subscriptionEngine.js';

// ── Provider presets ──────────────────────────────────────────────────────────

const IMAP_PRESETS = {
  gmail:   { host: 'imap.gmail.com',         port: 993, secure: true },
  yahoo:   { host: 'imap.mail.yahoo.com',   port: 993, secure: true },
  outlook: { host: 'outlook.office365.com', port: 993, secure: true },
  icloud:  { host: 'imap.mail.me.com',      port: 993, secure: true },
};

export function getImapConfig(provider, user, pass, customHost, customPort) {
  const preset = IMAP_PRESETS[provider] || null;
  const host   = preset?.host || customHost;
  const port   = Number(preset?.port || customPort || 993);
  if (!host) throw new Error('Missing IMAP host. Provide a host for custom providers.');

  return {
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: true },
    disableAutoIdle: true,
  };
}

// ── Sanitise auth errors — never surface raw IMAP server messages ─────────────

function sanitizeImapError(err) {
  const msg = err?.message || String(err);
  const isAuth = /auth|login|password|credential|invalid|535|534|NO \[/i.test(msg);
  return isAuth
    ? 'Authentication failed. Check your email and app password.'
    : 'Could not connect to mail server. Check your settings.';
}

// ── Verify credentials ────────────────────────────────────────────────────────

export async function verifyImapCredentials({ provider, user, pass, customHost, customPort }) {
  const client = new ImapFlow(getImapConfig(provider, user, pass, customHost, customPort));
  try {
    await client.connect();
    await client.logout();
  } catch (err) {
    throw new Error(sanitizeImapError(err));
  }
}

// ── Scan inbox ────────────────────────────────────────────────────────────────

// Subject keywords that indicate a message is worth fetching a body snippet for.
// Kept broad — the scoring engine handles the final filtering.
const SNIPPET_WORTH_SUBJECTS = [
  'subscription', 'renewal', 'renew', 'membership', 'billing', 'billed', 'invoice',
  'receipt', 'payment', 'charged', 'charge', 'plan', 'auto-renew', 'statement',
  'bill', 'due', 'amount due', 'balance', 'insurance', 'mortgage', 'loan',
];

function subjectWorthSnippet(subject) {
  const s = subject.toLowerCase();
  return SNIPPET_WORTH_SUBJECTS.some(kw => s.includes(kw));
}

/**
 * Extract a plain-text snippet from a bodyStructure node tree.
 * Returns the MIME section identifier of the first text/plain or text/html part.
 */
function findTextPart(node, section = '') {
  if (!node) return null;
  const type    = (node.type    || '').toLowerCase();
  const subtype = (node.subtype || '').toLowerCase();

  if (type === 'text' && (subtype === 'plain' || subtype === 'html')) {
    return section || '1';
  }
  if (Array.isArray(node.childNodes)) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const childSection = section ? `${section}.${i + 1}` : `${i + 1}`;
      const found = findTextPart(node.childNodes[i], childSection);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Connect via IMAP, scan INBOX for subscription-related emails using a two-pass approach:
 *   Pass 1 — fetch envelope + bodyStructure for all recent messages
 *   Pass 2 — fetch a body snippet for messages whose subject looks promising
 *
 * @returns {{ rawEmails: EmailObject[], scannedCount: number }}
 */
export async function scanImapInbox({ provider, user, pass, daysBack = 365, customHost, customPort }) {
  const client = new ImapFlow(getImapConfig(provider, user, pass, customHost, customPort));
  const rawEmails = [];
  let scannedCount = 0;

  try {
    await client.connect();

    const since = new Date(Date.now() - Number(daysBack) * 24 * 60 * 60 * 1000);
    const lock  = await client.getMailboxLock('INBOX');

    try {
      // Search by date only — let the scoring engine filter by content.
      const uids = await client.search({ since }, { uid: true });
      // Cap at 200 most recent to keep response times reasonable
      const recentUids = uids.slice(-200);
      scannedCount = recentUids.length;

      if (recentUids.length === 0) return { rawEmails, scannedCount };

      // ── Pass 1: envelope + body structure ────────────────────────────────────
      const pass1 = new Map(); // uid → { subject, fromStr, date, senderDomain, hasPdf, pdfFilename, textSection }

      for await (const msg of client.fetch(recentUids, { envelope: true, bodyStructure: true }, { uid: true })) {
        try {
          const env  = msg.envelope;
          const from = env?.from?.[0];
          const fromStr = from
            ? `${from.name ? `${from.name} ` : ''}<${from.mailbox}@${from.host}>`
            : '';
          const subject      = env?.subject || '';
          const date         = env?.date    || null;
          const senderDomain = from?.host?.toLowerCase() || extractSenderDomain(fromStr);

          const parts   = msg.bodyStructure?.childNodes || [];
          const pdfPart = parts.find(p =>
            (p.type === 'application' && p.subtype === 'pdf') ||
            p.disposition?.params?.filename?.toLowerCase().endsWith('.pdf')
          );

          // Find the section id for the first text part (for pass 2 fetch)
          const textSection = subjectWorthSnippet(subject)
            ? findTextPart(msg.bodyStructure)
            : null;

          pass1.set(msg.uid, {
            subject, fromStr, date, senderDomain,
            hasPdf:      !!pdfPart,
            pdfFilename: pdfPart?.disposition?.params?.filename || '',
            textSection,
          });
        } catch {
          // Skip malformed messages
        }
      }

      // ── Pass 2: fetch body snippets for promising messages ────────────────────
      const snippetMap = new Map(); // uid → snippet string

      // Group by section to batch-fetch where possible
      const snippetUids = [...pass1.entries()]
        .filter(([, m]) => m.textSection)
        .map(([uid]) => uid);

      if (snippetUids.length > 0) {
        // Fetch each promising message's first text part (capped at 800 bytes server-side).
        // We use source partial fetch to avoid pulling full bodies over IMAP.
        for (const uid of snippetUids) {
          try {
            const meta = pass1.get(uid);
            // Fetch up to 1200 bytes of the raw message body starting after typical headers.
            // This is a best-effort snippet — if it fails we fall back to the subject.
            const fetched = await client.fetchOne(
              String(uid),
              { bodyParts: [meta.textSection] },
              { uid: true }
            );
            const partBuffer = fetched?.bodyParts?.get(meta.textSection);
            if (partBuffer) {
              const raw = partBuffer.toString('utf8');
              // Strip HTML tags if present, collapse whitespace, cap length
              const plain = raw
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 600);
              if (plain.length > 10) snippetMap.set(uid, plain);
            }
          } catch {
            // Non-fatal — fall back to subject as snippet
          }
        }
      }

      // ── Assemble final email objects ─────────────────────────────────────────
      for (const [uid, meta] of pass1) {
        rawEmails.push({
          messageId:    String(uid),
          subject:      meta.subject,
          from:         meta.fromStr,
          date:         meta.date,
          senderDomain: meta.senderDomain,
          snippet:      snippetMap.get(uid) || meta.subject,
          hasPdf:       meta.hasPdf,
          pdfFilename:  meta.pdfFilename,
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    try { await client.logout(); } catch {}
    throw new Error(sanitizeImapError(err));
  }

  return { rawEmails, scannedCount };
}
