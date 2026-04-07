# BeforeItBills (BIB)

## What This Is
A subscription tracking and recurring charge detection app (React Native / Expo).
Core value: identify subscriptions before they bill, with a clean consumer experience.

## Stack
- Frontend: React Native + Expo Router (SDK 54)
- DB: Supabase (PostgreSQL) — direct queries via MCP
- State: Zustand stores
- Payments: RevenueCat
- Backend: Node.js on Render (`/backend`)
- Monitoring: Sentry + PostHog
- i18n: i18next (EN, ES, PT, FR)
- Git: Conventional Commits, feature branches only, never commit to main

## Repo Structure
- /app — all screens (Expo Router file-based routing)
- /components — UI component library
- /lib — stores, utilities, clients
- /backend — email import API
- /locales — i18n translation files
- /assets — images and icons

## Rules
- NEVER introduce a temp fix. Find the root cause.
- ALWAYS run tests before marking a task done.
- Commit after each logical unit. Use: feat/fix/refactor/test/chore
- False positives are worse than false negatives. When in doubt, don't flag.
- Every UI string MUST go through i18n (no hardcoded English in JSX).
- Never show raw backend error messages to users. Sanitize first.
- No empty catch blocks — at minimum log with context.

## How to Verify Changes
```bash
npx expo start          # smoke test
npm run no-placebo      # ci checks
```

## Task Management
See .claude/todo.md for current sprint state (level-based progression).
After any correction, update .claude/lessons.md.

@.claude/lessons.md

---

## App Quality Scale

We track app quality on a 0–100 scale. Current level: **62/100**.
Every PR should move the needle. Check .claude/todo.md for what unlocks the next level.

| Range | Label | What it means |
|-------|-------|---------------|
| 0–20 | Vibe coded | Crashes, hardcoded credentials, no auth |
| 20–40 | Demo-able | Happy path works, breaks on edge cases |
| 40–60 | Functional beta | Real users can use it but feel friction |
| 60–75 | Soft launch ready | No broken corners, graceful errors, i18n complete |
| 75–88 | App Store polished | Smooth, skeletons everywhere, no dead-ends |
| 88–95 | Top charts | Perf profiled, a11y audited, full analytics funnel |
| 95–100 | Instagram tier | Offline-first, physics animations, zero loading states |
