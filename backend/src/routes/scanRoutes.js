import { z } from 'zod';
import jwt from 'jsonwebtoken';
import pLimit from 'p-limit';
import { requireUser } from '../lib/auth.js';
import { getValidAccessToken, listMessages, fetchMessage } from '../services/gmailClient.js';
import { detectRecurringSubscriptions } from '../services/subscriptionEngine.js';
import {
  batchUpsertSubscriptions, markStaleSubscriptions, saveScanMetadata,
  createScanSession, getScanSession, getNewScanEvents,
} from '../db/index.js';

const QUEUE_ENABLED = process.env.QUEUE_ENABLED === 'true';

const scanBodySchema = z.object({
  daysBack: z.number().int().min(1).max(730).optional().default(180),
});

const SCAN_RATE_LIMIT = {
  max: 3,
  timeWindow: '15 minutes',
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return `scan:${decoded?.sub ?? req.ip}`;
    } catch { return `scan:${req.ip}`; }
  },
  errorResponseBuilder: () => ({
    error: 'rate_limited',
    message: 'Too many scans. Please wait 15 minutes before scanning again.',
  }),
};

export function registerScanRoutes(server) {

  /**
   * POST /scan
   *
   * QUEUE_ENABLED=false (default): runs synchronously, returns results immediately.
   * QUEUE_ENABLED=true:            enqueues job, returns { jobId, status:"queued" } (HTTP 202).
   *                                Poll GET /scan/:jobId/status or stream GET /scan/:jobId/events.
   */
  server.post('/scan', { config: { rateLimit: SCAN_RATE_LIMIT } }, async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const parsed = scanBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { daysBack } = parsed.data;

    // ── Queue mode ────────────────────────────────────────────────────────────
    if (QUEUE_ENABLED) {
      const { addScanJob } = await import('../services/scanQueue.js');

      const session = await createScanSession(auth.userId, 'gmail', { daysBack });
      await addScanJob(session.id, auth.userId, daysBack);

      return reply.code(202).send({
        jobId:  session.id,
        status: 'queued',
        eventsUrl: `/scan/${session.id}/events`,
        statusUrl: `/scan/${session.id}/status`,
      });
    }

    // ── Sync mode ─────────────────────────────────────────────────────────────
    const started = Date.now();

    let accessToken;
    try {
      accessToken = await getValidAccessToken(auth.userId);
    } catch (err) {
      return reply.code(400).send({ error: 'gmail_not_connected', message: err.message });
    }

    let messageRefs;
    try {
      messageRefs = await listMessages(accessToken, { daysBack });
    } catch (err) {
      return reply.code(400).send({ error: 'gmail_list_failed', message: err.message });
    }

    const limit = pLimit(25);
    const emails = (
      await Promise.all(messageRefs.map(({ id }) => limit(() => fetchMessage(accessToken, id))))
    ).filter(Boolean);

    const subscriptions = await detectRecurringSubscriptions(emails, 'gmail_scan');

    if (subscriptions.length) {
      await batchUpsertSubscriptions(auth.userId, subscriptions).catch((err) =>
        req.log.warn({ err }, 'batchUpsertSubscriptions failed')
      );
    }
    await markStaleSubscriptions(auth.userId).catch(() => {});

    const executionTimeMs = Date.now() - started;
    saveScanMetadata(auth.userId, {
      scannedMessages: emails.length,
      detectedCharges: subscriptions.length,
      executionTimeMs,
    }).catch(() => {});

    return reply.send({
      success: true,
      detectedSubscriptions: subscriptions.length,
      subscriptions,
      meta: { scannedMessages: emails.length, detectedCharges: subscriptions.length, executionTimeMs },
    });
  });

  /**
   * GET /scan/:jobId/status
   * Returns the current status of a queued scan job.
   * Works whether queue mode is enabled or not (returns 404 for sync-mode scans).
   */
  server.get('/scan/:jobId/status', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const session = await getScanSession(req.params.jobId, auth.userId);
    if (!session) return reply.code(404).send({ error: 'job_not_found' });

    return reply.send({
      jobId:          session.id,
      status:         session.status,
      scannedTotal:   session.scanned_total,
      foundTotal:     session.found_total,
      errorMessage:   session.error_message || null,
      createdAt:      session.created_at,
      updatedAt:      session.updated_at,
    });
  });

  /**
   * GET /scan/:jobId/events
   * SSE stream — polls scan_events table every 500ms and forwards events to client.
   * Closes automatically when a 'done' or 'error' event is received.
   */
  server.get('/scan/:jobId/events', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const session = await getScanSession(req.params.jobId, auth.userId);
    if (!session) return reply.code(404).send({ error: 'job_not_found' });

    const { sessionId, userId } = { sessionId: session.id, userId: auth.userId };

    async function* eventStream() {
      yield { event: 'connected', data: JSON.stringify({ jobId: sessionId, status: session.status }) };

      // If job already completed before we connected, emit a synthetic done
      if (session.status === 'done' || session.status === 'error') {
        yield {
          event: session.status,
          data: JSON.stringify({ status: session.status, message: session.error_message || null }),
        };
        return;
      }

      let lastEventId = 0;
      let done = false;
      let stalledMs = 0;
      const STALL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min max stream

      while (!done && stalledMs < STALL_TIMEOUT_MS) {
        const events = await getNewScanEvents(sessionId, lastEventId);

        if (events.length === 0) {
          // Keep-alive ping every 15s to prevent proxy timeouts
          if (stalledMs % 15_000 === 0) {
            yield { event: 'ping', data: '{}' };
          }
          await sleep(500);
          stalledMs += 500;
          continue;
        }

        stalledMs = 0;
        for (const ev of events) {
          yield { event: ev.event_type, data: JSON.stringify(ev.payload) };
          lastEventId = ev.id;
          if (ev.event_type === 'done' || ev.event_type === 'error') {
            done = true;
            break;
          }
        }
      }
    }

    reply.sse(eventStream());
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
