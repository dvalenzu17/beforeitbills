# BeforeItBills — Backend

Express → **Fastify** rewrite. Modular route structure under `src/`.

## Stack
- **Fastify 4** — HTTP framework
- **Supabase** — Auth (JWT verify) + service-role writes
- **pg** — Raw PostgreSQL pool for scan/subscription writes
- **imapflow** — IMAP scanning (Yahoo, Outlook, iCloud)
- **BullMQ** — Async scan jobs (optional, requires Redis)

## Run

```bash
cd backend
cp .env.example .env
# fill in all required values
npm install
npm run dev
```

## Required env vars

See `.env.example`. All vars marked required must be set or the server refuses to start.

## Entry points

| Script | What |
|---|---|
| `npm run dev` | New Fastify server (`src/server.js`) — use this |
| `npm run dev:legacy` | Old Express monolith (`index.js`) — kept until Tier 10 cutover |

## Route modules (added per tier)

| Tier | File | Routes |
|---|---|---|
| 5 | `src/routes/oauthRoutes.js` | `POST /oauth/google/exchange`, `GET /auth/google`, `GET /auth/google/callback` |
| 7 | `src/routes/scanRoutes.js` | `POST /scan`, `GET /scan/:jobId/status` |
| 8 | `src/routes/imapScanRoutes.js` | `POST /scan/imap/verify`, `POST /scan/imap` |
| 9 | `src/routes/subscriptionRoutes.js` | `GET /subscriptions`, `PATCH /subscriptions/:id`, `POST /subscriptions/:id/feedback` |
| 10 | `src/routes/accountRoutes.js` | `DELETE /account/delete` |
| 11 | Queue mode | `QUEUE_ENABLED=true` → `GET /scan/:jobId/events` (SSE) |

## Required Supabase tables

Run the SQL migrations in `../supabase/migrations/` in your Supabase SQL editor.
