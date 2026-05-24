/**
 * Retention feature routes
 *
 * GET  /creep-score             — subscription spend creep score
 * GET  /streak                  — guardian streak
 * GET  /on-this-day             — one-year-ago comparison
 * GET  /notifications           — notification inbox
 * PATCH /notifications/:id/read — mark notification read
 * POST /scan/background         — manual trigger for background scan
 * POST /users/link              — invite a user to link accounts
 * POST /users/link/:id/accept   — accept a pending link
 * GET  /users/links             — list my links
 */

import pg from 'pg';
import { requireUser } from '../lib/auth.js';
import { getCreepScore } from '../services/creepScore.js';
import { getStreak } from '../services/streakService.js';
import { getOnThisDay } from '../services/onThisDay.js';
import {
  listNotifications,
  markNotificationRead,
} from '../services/notificationDispatcher.js';
import { runBackgroundScanForUser } from '../services/backgroundScanner.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

export function registerRetentionRoutes(server) {

  // ── Creep score ─────────────────────────────────────────────────────────────
  server.get('/creep-score', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const score = await getCreepScore(auth.userId);
    if (!score) return reply.code(404).send({ error: 'no_data', message: 'No scan data yet.' });
    return reply.send(score);
  });

  // ── Streak ──────────────────────────────────────────────────────────────────
  server.get('/streak', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const streak = await getStreak(auth.userId);
    if (!streak) return reply.code(404).send({ error: 'no_data' });
    return reply.send(streak);
  });

  // ── On-this-day ─────────────────────────────────────────────────────────────
  server.get('/on-this-day', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const data = await getOnThisDay(auth.userId);
    if (!data) return reply.code(404).send({ error: 'no_data', message: 'Less than one year of data.' });
    return reply.send(data);
  });

  // ── Notifications inbox ─────────────────────────────────────────────────────
  server.get('/notifications', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const digestOnly = req.query?.tier === 'digest';
    const limit      = Math.min(Number(req.query?.limit || 50), 100);

    const notifications = await listNotifications(auth.userId, { limit, digestOnly });
    return reply.send({ notifications });
  });

  server.patch('/notifications/:id/read', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const updated = await markNotificationRead(auth.userId, req.params.id);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ ok: true });
  });

  // ── Manual background scan trigger ─────────────────────────────────────────
  server.post('/scan/background', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    setImmediate(() => runBackgroundScanForUser(auth.userId, req.log));
    return reply.code(202).send({ ok: true, message: 'Background scan started.' });
  });

  // ── User links (shared subscription detection) ──────────────────────────────
  server.post('/users/link', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: 'email required' });
    }

    // Look up user_id_b by email from profiles
    const { rows: target } = await pool.query(
      `SELECT id FROM profiles WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (!target.length) {
      return reply.code(404).send({ error: 'user_not_found', message: 'No BIB user with that email.' });
    }
    const userIdB = target[0].id;

    if (userIdB === auth.userId) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Cannot link to yourself.' });
    }

    // Create or return existing link
    const { rows } = await pool.query(
      `INSERT INTO user_links (user_id_a, user_id_b, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id_a, user_id_b) DO UPDATE SET status = user_links.status
       RETURNING id, status`,
      [auth.userId, userIdB]
    );

    return reply.send({ linkId: rows[0].id, status: rows[0].status });
  });

  server.post('/users/link/:id/accept', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    // Only user_id_b can accept
    const { rows } = await pool.query(
      `UPDATE user_links SET status = 'accepted'
       WHERE id = $1 AND user_id_b = $2 AND status = 'pending'
       RETURNING id`,
      [req.params.id, auth.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ ok: true, linkId: rows[0].id });
  });

  server.get('/users/links', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const { rows } = await pool.query(
      `SELECT ul.id, ul.status, ul.created_at,
              CASE WHEN ul.user_id_a = $1 THEN ul.user_id_b ELSE ul.user_id_a END AS partner_id,
              p.email AS partner_email, p.display_name AS partner_name
       FROM user_links ul
       JOIN profiles p ON p.id = CASE WHEN ul.user_id_a = $1 THEN ul.user_id_b ELSE ul.user_id_a END
       WHERE ul.user_id_a = $1 OR ul.user_id_b = $1
       ORDER BY ul.created_at DESC`,
      [auth.userId]
    );
    return reply.send({ links: rows });
  });
}
