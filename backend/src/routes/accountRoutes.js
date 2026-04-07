import { requireUser } from '../lib/auth.js';
import { deleteAccount } from '../db/index.js';

export function registerAccountRoutes(server) {

  /**
   * DELETE /account/delete
   * Deletes all user data across all tables, then removes the auth user.
   * Uses a DB transaction for application data — auth deletion is the final step.
   */
  server.delete('/account/delete', async (req, reply) => {
    const auth = requireUser(req, reply);
    if (!auth) return;

    try {
      await deleteAccount(auth.userId);
    } catch (err) {
      req.log.error({ err }, 'account deletion failed');
      return reply.code(500).send({ error: 'delete_failed', message: 'Failed to delete account. Contact support.' });
    }

    return reply.send({ ok: true, deleted: true });
  });
}
