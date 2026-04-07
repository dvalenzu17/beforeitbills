/**
 * BullMQ scan queue + worker.
 *
 * Only used when QUEUE_ENABLED=true. The worker runs in the same process
 * (started from server.js) but could be split into a separate process later.
 *
 * Job data: { sessionId, userId, daysBack }
 *
 * Progress is tracked via scan_sessions (status/counts) and scan_events
 * (streamed to the SSE endpoint at GET /scan/:jobId/events).
 */

import { Queue, Worker } from 'bullmq';
import pLimit from 'p-limit';
import { getValidAccessToken } from './gmailClient.js';
import { listMessages, fetchMessage } from './gmailClient.js';
import { detectRecurringSubscriptions } from './subscriptionEngine.js';
import { filterUnprocessedIds, markProcessedIds } from './messageCache.js';
import {
  batchUpsertSubscriptions, markStaleSubscriptions, saveScanMetadata,
  updateScanSession, writeScanEvent,
} from '../db/index.js';

const QUEUE_NAME = 'gmail-scan';

function redisConnection() {
  return {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
    port: Number(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || 6379),
  };
}

// ── Queue (producer side) ─────────────────────────────────────────────────────

let _queue = null;

export function getQueue() {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600 },  // keep completed jobs 1h
        removeOnFail: { age: 86400 },     // keep failed jobs 24h
      },
    });
  }
  return _queue;
}

/**
 * Enqueue a Gmail scan job. Returns the BullMQ job ID (stored alongside sessionId).
 */
export async function addScanJob(sessionId, userId, daysBack = 180) {
  const queue = getQueue();
  const job   = await queue.add('scan', { sessionId, userId, daysBack });
  return job.id;
}

// ── Worker (consumer side) ────────────────────────────────────────────────────

export function startWorker(logger = console) {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { sessionId, userId, daysBack } = job.data;
      const started = Date.now();

      try {
        // Mark session as running
        await updateScanSession(sessionId, { status: 'running', leased_by: `worker-${process.pid}` });
        await writeScanEvent(sessionId, userId, 'hello', { message: 'Scan started' });

        // Get Gmail access token
        const accessToken = await getValidAccessToken(userId);

        // List candidate message IDs
        const messageRefs = await listMessages(accessToken, { daysBack });
        await updateScanSession(sessionId, { pages: 1, scanned_total: messageRefs.length });
        await writeScanEvent(sessionId, userId, 'progress', {
          percent: 5, scanned: 0, found: 0, total: messageRefs.length,
        });

        // Dedup against already-processed IDs
        const allIds    = messageRefs.map(r => r.id);
        const freshIds  = await filterUnprocessedIds(userId, allIds);
        const freshRefs = messageRefs.filter(r => freshIds.includes(r.id));

        logger.info({ sessionId, total: allIds.length, fresh: freshIds.length }, 'scan ids filtered');

        // Fetch message metadata in parallel batches
        const limit  = pLimit(25);
        const emails = [];
        let   fetched = 0;

        const batches = chunk(freshRefs, 25);
        for (const batch of batches) {
          const results = await Promise.all(
            batch.map(({ id }) => limit(() => fetchMessage(accessToken, id)))
          );
          emails.push(...results.filter(Boolean));
          fetched += batch.length;

          const percent = 5 + Math.round((fetched / Math.max(freshRefs.length, 1)) * 70);
          await updateScanSession(sessionId, { scanned_total: fetched });
          await writeScanEvent(sessionId, userId, 'progress', {
            percent, scanned: fetched, found: emails.length, total: freshRefs.length,
          });
        }

        // Score candidates
        const subscriptions = await detectRecurringSubscriptions(emails, 'gmail_scan');
        await updateScanSession(sessionId, { found_total: subscriptions.length });
        await writeScanEvent(sessionId, userId, 'candidates', { count: subscriptions.length });

        // Persist
        if (subscriptions.length) {
          await batchUpsertSubscriptions(userId, subscriptions).catch((err) =>
            logger.warn({ err }, 'batchUpsertSubscriptions failed')
          );
        }
        await markStaleSubscriptions(userId).catch(() => {});

        const executionTimeMs = Date.now() - started;
        await saveScanMetadata(userId, {
          scannedMessages: fetched,
          detectedCharges: subscriptions.length,
          executionTimeMs,
        }).catch(() => {});

        // Mark processed IDs so next scan skips them
        await markProcessedIds(userId, freshIds);

        // Done
        await updateScanSession(sessionId, { status: 'done', last_stats: { executionTimeMs, found: subscriptions.length } });
        await writeScanEvent(sessionId, userId, 'done', {
          detectedSubscriptions: subscriptions.length,
          meta: { scannedMessages: fetched, detectedCharges: subscriptions.length, executionTimeMs },
        });

        return { subscriptions, meta: { scannedMessages: fetched, detectedCharges: subscriptions.length, executionTimeMs } };

      } catch (err) {
        logger.error({ err, sessionId }, 'scan job failed');
        const msg = err?.message || String(err);
        await updateScanSession(sessionId, { status: 'error', error_message: msg }).catch(() => {});
        await writeScanEvent(sessionId, userId, 'error', { message: msg }).catch(() => {});
        throw err;
      }
    },
    {
      connection: redisConnection(),
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'scan job completed'));
  worker.on('failed',    (job, err) => logger.warn({ jobId: job?.id, err: err?.message }, 'scan job failed'));

  return worker;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
