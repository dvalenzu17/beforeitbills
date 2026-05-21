import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { requireUser } from '../lib/auth.js';
import { encryptCredential, decryptCredential } from '../services/crypto.js';
import { verifyImapCredentials, scanImapInbox } from '../services/imapClient.js';
import { detectRecurringSubscriptions } from '../services/subscriptionEngine.js';
import { batchUpsertSubscriptions, markStaleSubscriptions, saveScanMetadata, saveImapCredentials, getImapCredentials } from '../db/index.js';

const PROVIDERS = ['gmail', 'yahoo', 'outlook', 'icloud'];

const verifyBodySchema = z.object({
  provider: z.enum(PROVIDERS),
  user:     z.string().email(),
  pass:     z.string().min(1),
});

const scanBodySchema = z.object({
  provider:   z.enum(PROVIDERS),
  user:       z.string().email().optional(),
  pass:       z.string().min(1).optional(),
  daysBack:   z.number().int().min(1).max(730).optional().default(365),
});

// Per-user rate limit: 3 IMAP scans per 15 minutes (IMAP is slow)
const IMAP_RATE_LIMIT = {
  max: 3,
  timeWindow: '15 minutes',
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return `imap:${decoded?.sub ?? req.ip}`;
    } catch { return `imap:${req.ip}`; }
  },
  errorResponseBuilder: () => ({
    error: 'rate_limited',
    message: 'Too many scans. Please wait 15 minutes before scanning again.',
  }),
};

export function registerImapScanRoutes(server) {

  /**
   * POST /scan/imap/verify
   * Verify IMAP credentials without running a full scan.
   * Returns { ok: true } on success or a 400 with a sanitized error message.
   */
  server.post('/scan/imap/verify', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const parsed = verifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { provider, user, pass } = parsed.data;

    try {
      await verifyImapCredentials({ provider, user, pass });
    } catch (err) {
      return reply.code(400).send({ error: 'imap_auth_failed', message: err.message });
    }

    return reply.send({ ok: true });
  });

  /**
   * POST /scan/imap
   * Full IMAP inbox scan for Yahoo, Outlook, or iCloud.
   * Credentials can be passed in the request body or loaded from stored encrypted creds.
   */
  server.post('/scan/imap', { config: { rateLimit: IMAP_RATE_LIMIT } }, async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const parsed = scanBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    let { provider, user, pass, daysBack } = parsed.data;

    // Fall back to stored credentials if not supplied in request
    if (!user || !pass) {
      const stored = await getImapCredentials(auth.userId, provider);
      if (!stored) {
        return reply.code(400).send({
          error: 'imap_not_connected',
          message: `No stored credentials for ${provider}. Please connect first.`,
        });
      }
      user = stored.imap_user;
      try {
        pass = decryptCredential(stored.imap_pass);
      } catch {
        return reply.code(400).send({
          error: 'imap_not_connected',
          message: 'Stored credentials are invalid. Please reconnect.',
        });
      }
    }

    const started = Date.now();

    let rawEmails, scannedCount;
    try {
      ({ rawEmails, scannedCount } = await scanImapInbox({ provider, user, pass, daysBack }));
    } catch (err) {
      return reply.code(400).send({ error: 'scan_failed', message: err.message });
    }

    // Persist credentials after a successful scan (may be the first time or a rotation)
    await saveImapCredentials(auth.userId, {
      provider,
      user,
      encryptedPass: encryptCredential(pass),
    }).catch((err) => req.log.warn({ err }, 'saveImapCredentials failed'));

    // Score and dedup
    const subscriptions = await detectRecurringSubscriptions(rawEmails, `imap_${provider}`);

    // Persist subscriptions
    if (subscriptions.length) {
      await batchUpsertSubscriptions(auth.userId, subscriptions).catch((err) =>
        req.log.warn({ err }, 'batchUpsertSubscriptions failed')
      );
    }
    await markStaleSubscriptions(auth.userId).catch((err) =>
      req.log.warn({ err }, 'markStaleSubscriptions failed')
    );

    const executionTimeMs = Date.now() - started;

    saveScanMetadata(auth.userId, {
      scannedMessages: scannedCount,
      detectedCharges: subscriptions.length,
      executionTimeMs,
    }).catch((err) => req.log.warn({ err }, 'saveScanMetadata failed'));

    return reply.send({
      success: true,
      detectedSubscriptions: subscriptions.length,
      subscriptions,
      meta: {
        scannedMessages: scannedCount,
        detectedCharges: subscriptions.length,
        executionTimeMs,
      },
    });
  });
}
