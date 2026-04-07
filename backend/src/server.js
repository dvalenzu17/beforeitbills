import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifySse from 'fastify-sse-v2';

// ── Env guards ────────────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'DATABASE_URL',
];
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT || 8787);
const QUEUE_ENABLED = process.env.QUEUE_ENABLED === 'true';

const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ── Server ────────────────────────────────────────────────────────────────────
const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// CORS — allow native mobile (no Origin) + optional web allowlist
await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // mobile / native
    if (CORS_ORIGINS.length === 0) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  },
});

// Rate limiting — global false, applied per-route
await server.register(rateLimit, { global: false });

// SSE — used by GET /scan/:jobId/events (Tier 11)
await server.register(fastifySse);

// Add Retry-After header on every 429
server.addHook('onSend', async (_req, reply) => {
  if (reply.statusCode === 429) {
    reply.header('Retry-After', '900');
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
import { registerOAuthRoutes }        from './routes/oauthRoutes.js';
import { registerScanRoutes }         from './routes/scanRoutes.js';
import { registerImapScanRoutes }     from './routes/imapScanRoutes.js';
import { registerSubscriptionRoutes } from './routes/subscriptionRoutes.js';
import { registerAccountRoutes }      from './routes/accountRoutes.js';
import { registerParseRoutes }        from './routes/parseRoutes.js';

registerOAuthRoutes(server);
registerScanRoutes(server);
registerImapScanRoutes(server);
registerSubscriptionRoutes(server);
registerAccountRoutes(server);
registerParseRoutes(server);

server.get('/', async () => ({ status: 'ok' }));
server.get('/health', async () => ({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    if (QUEUE_ENABLED) {
      const { startWorker } = await import('./services/scanQueue.js');
      startWorker(server.log);
      server.log.info('BullMQ Worker started');
    }

    await server.listen({ port: PORT, host: '0.0.0.0' });
    server.log.info(`Server running on :${PORT} [queue=${QUEUE_ENABLED}]`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
