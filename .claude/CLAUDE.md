# BeforeItBills (Sublytics) — CLAUDE.md

## What this is

BeforeItBills is a consumer mobile app (iOS + Android) that detects recurring subscription charges in users' email inboxes and presents them in a clean personal finance dashboard. Users connect Gmail via OAuth or Yahoo/Outlook/iCloud via IMAP — the backend scans for billing emails and surfaces what's charging them before the next bill hits.

The repo contains two packages: the React Native frontend (`/`) and a Fastify backend (`/backend`).

---

## Stack

### Frontend
- **Framework**: React Native + Expo SDK 56 (canary), Expo Router (file-based routing)
- **State**: Zustand stores (`lib/store.js` for subscriptions/bills, `lib/onboardingStore.js`, `lib/purchasesStore.js`)
- **Data fetching**: TanStack React Query
- **Auth**: Supabase (`@supabase/supabase-js`) — Google Sign-In OAuth
- **Payments**: RevenueCat (`react-native-purchases`) — IAP subscriptions (free/pro)
- **Animations**: React Native Reanimated, Moti
- **Analytics**: PostHog, Sentry
- **i18n**: i18next (EN, ES, PT, FR — all UI strings must go through i18n)
- **Deep link scheme**: `beforeitbills://`

### Backend (`/backend`)
- **Runtime**: Node.js (ESM, `"type": "module"`), Node ≥ 20
- **Framework**: Fastify 5
- **Database**: PostgreSQL via Supabase (`pg` pool for queries + Supabase admin client for auth ops)
- **Auth**: Supabase JWT — `requireUser()` in `backend/src/lib/auth.js`
- **Queue**: BullMQ + Redis (optional, `QUEUE_ENABLED=true`)
- **NLP parsing**: OpenAI `gpt-4.1-mini` (optional, `POST /parse-subscription`)
- **Deploy target**: Render

---

## Repo structure

```
sublytics/
├── app/                          — Expo Router screens (file-based routing)
│   ├── (auth)/                  — sign-in screen
│   ├── (onboarding)/            — multi-step onboarding flow
│   ├── (tabs)/                  — main tab navigation (home, insights, recap, account)
│   ├── account/                 — settings, connected accounts, biometric lock
│   ├── recurring/               — recurring charge detail + management
│   └── bill/                    — bill detail views
├── components/                   — reusable UI components (60+ files)
├── lib/                          — frontend utilities, stores, API clients
│   ├── store.js                 — main Zustand store (subscriptions, bills, profile)
│   ├── emailImportClient.js     — HTTP client for backend scan/subscription routes
│   ├── emailImportStore.js      — Zustand store for scan state
│   ├── purchases.js             — RevenueCat module loader (native vs mock)
│   ├── purchasesStore.js        — Zustand store for subscription plan state
│   ├── auth/api.js              — auth API helpers
│   ├── auth/googleGmailOAuth.js — Google OAuth flow (expo-auth-session PKCE)
│   ├── scan/service.js          — scan orchestration (trigger + poll)
│   ├── scan/bus.js              — event emitter for scan progress
│   ├── analytics.js             — PostHog event tracking
│   ├── brand/brandResolver.js   — merchant logo/brand resolution
│   ├── notifications.js         — push notification scheduling
│   └── supabase.js              — Supabase client instance
├── locales/                      — i18n translation files (en, es, pt, fr)
├── assets/                       — images, icons, fonts
├── modules/widget-bridge/        — native iOS widget bridge
├── ios-widget/                   — iOS home screen widget (SwiftUI)
├── ios-share-extension/          — iOS share sheet extension
├── backend/                      — Node.js/Fastify API (separate package)
│   ├── src/
│   │   ├── server.js            — Fastify entry point, plugin + route registration
│   │   ├── lib/
│   │   │   ├── auth.js          — requireUser() — verifies Supabase JWT
│   │   │   └── fetchUtil.js     — fetch wrapper with timeout + retries
│   │   ├── db/
│   │   │   └── index.js         — all DB queries (pg pool), scoped by user_id
│   │   ├── routes/
│   │   │   ├── scanRoutes.js        — POST /scan, GET /scan/:jobId/status+events
│   │   │   ├── subscriptionRoutes.js — GET/PATCH /subscriptions, POST /feedback
│   │   │   ├── imapScanRoutes.js    — POST /scan/imap/verify, POST /scan/imap
│   │   │   ├── oauthRoutes.js       — Google OAuth web + PKCE exchange
│   │   │   ├── accountRoutes.js     — DELETE /account/delete
│   │   │   └── parseRoutes.js       — POST /parse-subscription (OpenAI NLP)
│   │   └── services/
│   │       ├── subscriptionEngine.js — core detection logic (do not modify)
│   │       ├── subscriptionModel.js  — logistic regression model (do not modify)
│   │       ├── gmailClient.js        — Gmail API client
│   │       ├── imapClient.js         — IMAP two-pass scan
│   │       ├── emailParser.js        — amount/merchant/currency extraction
│   │       ├── modelFeatures.js      — ML feature vector extraction
│   │       ├── anomalyDetector.js    — Z-score anomaly detection
│   │       ├── scanQueue.js          — BullMQ queue + worker
│   │       ├── crypto.js             — AES-256-GCM credential encryption
│   │       ├── retryUtil.js          — exponential backoff + circuit breaker
│   │       ├── messageCache.js       — processed message ID dedup
│   │       └── dbPool.js             — pg pool singleton
│   └── package.json
├── app.config.js                 — Expo config (bundle ID, plugins, env vars)
├── eas.json                      — EAS Build config
├── package.json                  — frontend dependencies
└── supabase/                     — Supabase migrations + config
```

---

## Auth flow

**Frontend**: User signs in via Google Sign-In → Supabase issues a JWT → stored in session. Every backend request sends `Authorization: Bearer <supabase_access_token>`.

**Backend**: `requireUser(req, reply)` in `backend/src/lib/auth.js` verifies the JWT against `SUPABASE_JWT_SECRET` and returns `{ userId: decoded.sub }`. All DB queries are `WHERE user_id = $1`.

---

## Key data flows

### Scan flow
1. Frontend calls `emailImportClient` → `POST /scan` or `POST /scan/imap`
2. Backend verifies JWT, fetches emails, runs detection engine, upserts subscriptions
3. If `QUEUE_ENABLED`: returns `{ jobId }`, frontend polls `GET /scan/:jobId/events` (SSE)
4. Frontend `scan/service.js` handles polling, updates `emailImportStore`

### Subscription display
- `lib/store.js` is the main Zustand store — holds subscriptions, bills, profile
- Syncs from Supabase directly via `supabase.from('subscriptions').select(...)` on the frontend
- Backend writes; frontend reads directly from Supabase (not via backend API)

### Payments / Pro plan
- RevenueCat manages IAP — `lib/purchases.js` loads native or mock module
- `lib/purchasesStore.js` tracks current entitlement
- `lib/purchases.native.js` has the real RevenueCat integration
- `lib/purchases.mock.js` is used on web/simulator where native module is unavailable

---

## Backend routes

```
POST /scan                        — Trigger Gmail scan
GET  /scan/:jobId/status          — Poll queued job
GET  /scan/:jobId/events          — SSE scan progress stream
GET  /subscriptions               — List subscriptions (?limit=&offset=)
PATCH /subscriptions/:id          — Set user_status (confirmed/cancelled/ignored)
POST /subscriptions/:id/feedback  — ML training feedback label
POST /scan/imap/verify            — Test IMAP credentials
POST /scan/imap                   — Scan IMAP inbox
GET  /auth/google                 — Initiate Google OAuth
GET  /auth/google/callback        — OAuth callback
POST /oauth/google/exchange       — PKCE token exchange (iOS native)
DELETE /account/delete            — Delete all user data + auth user
POST /parse-subscription          — NLP parse free text → subscription fields (OpenAI)
GET  /                            — Health check
GET  /health                      — Health check
```

---

## Backend environment variables

```
PORT=8787
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
TOKEN_ENCRYPTION_KEY=     # 32-byte hex or base64 for AES-256-GCM (crypto.js)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
QUEUE_ENABLED=false
REDIS_URL=
LOG_LEVEL=info
CORS_ORIGINS=             # comma-separated allowed web origins (empty = allow all)
OPENAI_API_KEY=           # optional — enables POST /parse-subscription
OPENAI_MODEL=gpt-4.1-mini
```

## Frontend environment variables (in `.env`, exposed via `app.config.js`)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_BACKEND_URL=         # backend URL (Render)
EXPO_PUBLIC_LOGO_DEV_TOKEN=      # logo.dev API key for brand logos
EXPO_PUBLIC_BRANDFETCH_API_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

---

## Commands

```bash
# Frontend
npx expo start                    # start Expo dev server
npx expo run:ios                  # build + run iOS simulator
npx expo run:android              # build + run Android emulator
npm run no-placebo                # CI checks

# Backend (run from /backend)
npm run dev                       # node --watch src/server.js
npm start                         # node src/server.js
```

---

## iOS-specific

- **Bundle ID**: `com.beforeitbills.app`
- **Deep link scheme**: `beforeitbills://`
- **App groups**: `group.com.beforeitbills.app` (shared with widget + share extension)
- **iOS widget**: `ios-widget/` — SwiftUI, data bridged via `lib/widgetBridge.js`
- **Share extension**: `ios-share-extension/` — `com.beforeitbills.app.ShareExtension`
- **Deployment target**: iOS 16.0

---

## Rules for Claude working in this repo

- **Never hardcode UI strings** — every string visible to the user must go through `i18n.t()`. Add keys to all four locale files (`en`, `es`, `pt`, `fr`).
- **All backend DB queries must be scoped by `user_id`** — never query without a user filter.
- **Never show raw error messages to users** — sanitize all backend errors before display.
- **RevenueCat module**: always use `getPurchasesModule()` from `lib/purchases.js`, never import `react-native-purchases` directly (breaks web/simulator).
- When adding a backend route, register it in `backend/src/server.js`. No route logic in server.js itself.
- When adding a DB function, it goes in `backend/src/db/index.js`.
- `lib/store.js` is the source of truth for frontend subscription state — keep actions in the store, not scattered in components.

> Shared rules (ESM, no credential logging, no modifying detection engine, conventional commits) are in `C:/dev/CLAUDE.md`.

---

## What is NOT in this repo

- B2B API layer (lives in `subscan-api/`)
- Web dashboard
- Stripe webhook handler
- Android widget (iOS only currently)
