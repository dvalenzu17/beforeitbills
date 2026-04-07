import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { getSubscriptions, updateSubscriptionStatus, saveFeedback } from '../db/index.js';

const patchSchema = z.object({
  user_status: z.enum(['confirmed', 'cancelled', 'ignored']),
});

const feedbackSchema = z.object({
  label:    z.enum(['confirmed', 'rejected']),
  features: z.record(z.unknown()).optional().default({}),
});

const listQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export function registerSubscriptionRoutes(server) {

  /**
   * GET /subscriptions
   * Returns all subscriptions for the authenticated user, newest first.
   * Supports ?limit= and ?offset= for pagination.
   */
  server.get('/subscriptions', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const parsed = listQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { limit, offset } = parsed.data;
    const rows = await getSubscriptions(auth.userId, { limit, offset });

    // Normalise to camelCase for the client
    const subscriptions = rows.map((s) => ({
      id:              s.id,
      merchant:        s.merchant,
      amount:          s.amount != null ? Number(s.amount) : null,
      currency:        s.currency || 'USD',
      billingInterval: s.billing_interval || 'monthly',
      renewalDate:     s.renewal_date ? new Date(s.renewal_date).toISOString().slice(0, 10) : null,
      confidence:      s.confidence != null ? Number(s.confidence) : 0,
      isActive:        s.is_active !== false,
      isSuggested:     s.is_suggested !== false,
      source:          s.source || null,
      userStatus:      s.user_status || null,
      lastSeenAt:      s.last_seen_at || null,
      createdAt:       s.created_at   || null,
    }));

    return reply.send({
      subscriptions,
      meta: { count: subscriptions.length, limit, offset },
    });
  });

  /**
   * PATCH /subscriptions/:id
   * Update user_status on a subscription (confirmed / cancelled / ignored).
   */
  server.patch('/subscriptions/:id', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const parsed = patchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const subscriptionId = req.params.id;
    if (!subscriptionId) return reply.code(400).send({ error: 'missing_id' });

    let updated;
    try {
      updated = await updateSubscriptionStatus(auth.userId, subscriptionId, parsed.data.user_status);
    } catch (err) {
      return reply.code(400).send({ error: 'update_failed', message: err.message });
    }

    if (!updated) {
      return reply.code(404).send({ error: 'not_found', message: 'Subscription not found or not owned by you' });
    }

    return reply.send({ ok: true, subscription: updated });
  });

  /**
   * POST /subscriptions/:id/feedback
   * Record a true/false positive label + feature vector for ML training.
   */
  server.post('/subscriptions/:id/feedback', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    const parsed = feedbackSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const subscriptionId = req.params.id;
    if (!subscriptionId) return reply.code(400).send({ error: 'missing_id' });

    try {
      await saveFeedback(auth.userId, subscriptionId, {
        label:    parsed.data.label,
        features: parsed.data.features,
      });
    } catch (err) {
      // FK violation means the subscription doesn't exist / doesn't belong to user
      if (err.code === '23503') {
        return reply.code(404).send({ error: 'not_found', message: 'Subscription not found or not owned by you' });
      }
      return reply.code(500).send({ error: 'save_failed', message: 'Failed to save feedback' });
    }

    return reply.send({ ok: true });
  });
}
