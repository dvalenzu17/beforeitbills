import { ImapFlow } from 'imapflow';
import { extractSenderDomain } from './subscriptionEngine.js';

// ── Provider presets ──────────────────────────────────────────────────────────

const IMAP_PRESETS = {
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

/**
 * Connect via IMAP, search INBOX for subscription-related emails,
 * and return raw email objects for the subscription engine to score.
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
      // Complex OR queries have inconsistent support across IMAP servers.
      const uids = await client.search({ since }, { uid: true });
      // Cap at 150 most recent to keep response times reasonable
      const recentUids = uids.slice(-150);
      scannedCount = recentUids.length;

      if (recentUids.length === 0) return { rawEmails, scannedCount };

      for await (const msg of client.fetch(recentUids, { envelope: true, bodyStructure: true }, { uid: true })) {
        try {
          const env  = msg.envelope;
          const from = env?.from?.[0];
          const fromStr = from
            ? `${from.name ? `${from.name} ` : ''}<${from.mailbox}@${from.host}>`
            : '';
          const subject     = env?.subject || '';
          const date        = env?.date    || null;
          const senderDomain = from?.host?.toLowerCase() || extractSenderDomain(fromStr);

          // PDF detection from body structure
          const parts = msg.bodyStructure?.childNodes || [];
          const pdfPart = parts.find(p =>
            (p.type === 'application' && p.subtype === 'pdf') ||
            p.disposition?.params?.filename?.toLowerCase().endsWith('.pdf')
          );

          rawEmails.push({
            messageId:    String(msg.uid),
            subject,
            from:         fromStr,
            date,
            senderDomain,
            snippet:      subject, // IMAP metadata-only — no snippet, use subject
            hasPdf:       !!pdfPart,
            pdfFilename:  pdfPart?.disposition?.params?.filename || '',
          });
        } catch {
          // Skip malformed messages silently
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    // Try clean logout even on error
    try { await client.logout(); } catch {}
    throw new Error(sanitizeImapError(err));
  }

  return { rawEmails, scannedCount };
}
