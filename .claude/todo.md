# BIB — Retention + Engagement Feature Suite

## Migrations applied to Supabase ✓
- retention_suite (profiles, subscriptions, push_tokens index)
- retention_price_history (subscription_price_history)
- retention_trials (subscription_trials)
- retention_events_extend (metadata + created_at on subscription_events, indexes)
- retention_dormancy (dormancy_scores, subscriptions.dormancy_score)
- retention_user_links (user_links, shared_subscription_suggestions)
- retention_notifications (notifications table)
- retention_profiles_streak (profiles: streak_count, streak_last_updated, streak_broken_at, timezone)

## CRITICAL FIX needed in existing code
- [ ] subscription_events dedup: replace `ON CONFLICT DO NOTHING` with check-then-insert
  (unique index on date_trunc is not possible in PG with timestamptz — handled app-side)
  Files: backgroundScanner.js, priceChangeDetector.js, anniversaryDigest.js

---

## Phase 2 — New Features (implement in order)

### A. Fix subscription_events dedup (backgroundScanner + priceChangeDetector + anniversaryDigest)
- [ ] Extract `hasRecentEvent(pool, subscriptionId, eventType, windowDays)` helper
- [ ] Replace all ON CONFLICT calls with check-then-insert using the helper

### B. Dormancy Scoring
- [ ] `src/services/dormancyScorer.js`
  - `listNonBillingEmails(accessToken, domain, daysBack=90)` — Gmail query from:domain, filter out billing subjects
  - `applyRecencyWeights(emails)` — inline recency decay: <7d=1.0, <30d=0.6, <60d=0.3, else=0.1
  - `computeDormancyScore(weightedCount)` → 0-100: 0 signals=90-100, 1-3=50-89, 4+=0-49
  - `scoreDormancyForUser(userId, logger)` — for each active sub with sender_domain, call Gmail, compute score
  - `updateDormancyScores(userId, logger)` — upsert into dormancy_scores + set subscriptions.dormancy_score
  - Called from backgroundScanner.runBackgroundScanForUser after each scan
  - Skip if no Gmail connection (IMAP accounts can't query by domain easily)

### C. Shared Subscription Detection
- [ ] `src/services/sharedSubscriptionDetector.js`
  - FAMILY_PLAN_PRICES static map: Spotify($16.99), Netflix($22.99), Apple One($25.95), YouTube Premium($22.99), etc.
  - `detectSharedSubscriptions(userIdA, userIdB, logger)` — compare active subs, find overlaps
  - `processLinkedPairs(logger)` — query accepted user_links, run detection for each pair
  - Called from backgroundScanner daily
- [ ] `src/routes/userLinkRoutes.js`
  - `POST /users/link` — invite by email (lookup user_id from profiles), create pending link
  - `POST /users/link/:id/accept` — accept a pending link (requires auth as user_id_b)
  - `GET /users/links` — list my links

### D. Notification Dispatcher (centralized)
- [ ] `src/services/notificationDispatcher.js`
  - Tier classification: immediate vs digest
    - Immediate: price_increase, trial_ending (≤3d), rebilling, annual_renewal (≤7d), new_subscription
    - Digest: dormant, shared_subscription, price_decrease, annual_renewal (>7d), trial_ending (>3d)
  - `createNotification(pool, userId, type, payload)` — insert into notifications table
    - Dedup: check for existing unread notification of same type+subscriptionId within 7 days
  - `dispatchImmediate(userId, type, payload, logger)` — create notification + send push immediately
  - `dispatchDigest(userId, type, payload)` — create notification, digest_included=false (awaiting weekly send)
  - `sendWeeklyDigest(logger)` — Monday 9am UTC cron
    - Per user: find all unread digest notifications from last 7 days
    - If any: push "Your weekly BIB update: {n} things to review"
    - Mark digest_included=true on all included notifications
  - `GET /notifications` route — list notifications for user (most recent 50)
  - `PATCH /notifications/:id/read` route — mark as read

### E. On-This-Day Card
- [ ] `src/services/onThisDay.js`
  - `getOnThisDay(userId)` — query subscriptions + subscription_price_history for ±1 day window 365 days ago
  - Returns: { subsOneYearAgo, monthlySpendThen, monthlySpendNow, netChange, priceIncreases }
- [ ] `GET /on-this-day` route (retentionRoutes.js)
- [ ] Frontend: `components/OnThisDayCard.js` — dismissible card above creep score
  - "One year ago you were paying ${then}/mo. You're now paying ${now}/mo."
  - Dismissible — store dismissed date in AsyncStorage (don't show again same calendar day)
  - Show only if user has been on BIB ≥1 year (first_scan_at ≤ 364 days ago)

### F. Weekly Digest Screen
- [ ] `app/digest.js` — Digest screen
  - Fetch `GET /notifications?tier=digest&days=7`
  - Group by type
  - Tappable items → navigate to relevant subscription
  - Empty state: "Nothing to review this week"
- [ ] Add Digest link to `app/(tabs)/index.js` home screen (small "See digest" link)

### G. Guardian Streak
- [ ] `src/services/streakService.js`
  - `updateStreak(userId, logger)` — called after every background scan
    - If streak_last_updated is within 8 days: increment streak_count, update streak_last_updated
    - If >8 days elapsed: set streak_broken_at=today, streak_count=0
    - If first scan: streak_count=1, streak_last_updated=today
  - `GET /streak` route in retentionRoutes.js
- [ ] Frontend: streak indicator on home screen
  - "{n} week streak" with shield icon (Feather "shield")
  - Broken state: "Your protection lapsed — reconnect to restart"
  - Milestone toasts at 4wk/12wk/52wk stored in AsyncStorage

---

## Commit plan
- fix(events): replace ON CONFLICT dedup with check-then-insert
- feat(dormancy): dormancy scoring per subscription
- feat(shared-subs): shared subscription detection + user links
- feat(notifications): centralized notification dispatcher
- feat(on-this-day): on-this-day backend + frontend card
- feat(digest): weekly digest cron + digest screen
- feat(streak): guardian streak mechanic

---

## Lessons to follow
1. `>= 2 occurrences` before flagging recurring
2. No non-ASCII quote chars in JS strings
3. Always init arrays as `[]` not `null`; guard `.some()/.filter()/.map()/.reduce()` with `?.` or `(val || []).method()`
