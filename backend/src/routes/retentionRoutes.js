/**
 * Retention feature routes
 *
 * GET  /creep-score          — current subscription creep score for the user
 * POST /scan/background      — dev/admin manual trigger for background scan (dev only)
 */

import { requireUser } from '../lib/auth.js';
import { getCreepScore } from '../services/creepScore.js';
import { runBackgroundScanForUser } from '../services/backgroundScanner.js';

export function registerRetentionRoutes(server) {

  /**
   * GET /creep-score
   * Returns the user's subscription creep score.
   */
  server.get('/creep-score', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const score = await getCreepScore(auth.userId);
    if (!score) {
      return reply.code(404).send({ error: 'no_data', message: 'No scan data yet.' });
    }

    return reply.send(score);
  });

  /**
   * POST /scan/background
   * Manually trigger a background scan for the authenticated user.
   * Useful for development and testing without waiting for the 6h cron.
   * In production this is just for the user to trigger their own scan.
   */
  server.post('/scan/background', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    // Fire and forget — respond immediately, scan runs async
    setImmediate(() => {
      runBackgroundScanForUser(auth.userId, req.log);
    });

    return reply.code(202).send({ ok: true, message: 'Background scan started.' });
  });
}
