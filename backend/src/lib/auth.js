import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

/**
 * Extract and verify the Supabase JWT from the Authorization header.
 *
 * Returns { userId, email, role } on success.
 * Throws with a human-readable message on failure — callers convert to 401.
 *
 * Using direct jwt.verify() instead of supabase.auth.getUser() avoids a
 * network round-trip on every authenticated request.
 */
export function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization bearer token');
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }

  const userId = payload.sub;
  if (!userId) throw new Error('Token missing sub claim');

  return {
    userId,
    email: payload.email ?? null,
    role:  payload.role  ?? null,
  };
}

/**
 * Fastify-compatible auth helper.
 * Call at the top of any route handler: const { userId } = requireUser(req, reply);
 * Returns the decoded user or sends a 401 and returns null.
 */
export function requireUser(req, reply) {
  try {
    return verifyToken(req.headers.authorization);
  } catch (err) {
    reply.code(401).send({ error: 'unauthorized', message: err.message });
    return null;
  }
}
