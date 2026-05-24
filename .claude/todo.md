# BIB — Retention Feature Suite

## Status: IN PROGRESS — Feature 1 (Background Monitoring)

---

## Architecture Overview

- **Background jobs**: `node-cron` on the Fastify backend (no BullMQ dependency — stays lightweight)
- **Push delivery**: Expo Push HTTP API (`https://exp.host/--/api/v2/push/send`) via `fetch` — no extra SDK
- **Push tokens**: already stored in `push_tokens` (Supabase) by `lib/push.js`
- **DB**: direct pg pool, all queries scoped by `user_id`
- **New services**: `pushService.js`, `backgroundScanner.js`, `priceChangeDetector.js`, `trialDetector.js`
- **Frontend additions**: creep score card on home screen only (Feature 6); all other features are backend-only

---

## Feature 1 — Background Email Monitoring (FOUNDATION)

### DB migrations (new file: `20260523_retention.sql`)
- [ ] Add `last_background_scan_at TIMESTAMPTZ` to `profiles` table
- [ ] Add `first_scan_at TIMESTAMPTZ` to `profiles` table (used by Feature 7)
- [ ] Ensure `push_tokens` table has: `id`, `user_id`, `token`, `device`, `created_at` — check & add if missing
- [ ] Create index: `profiles(last_background_scan_at)` for efficient job queries

### Backend: `src/services/pushService.js` (new)
- [ ] `sendPush(tokens[], title, body, data)` — POST to Expo Push API, batch up to 100
- [ ] `getUserPushTokens(userId)` — fetch all tokens for a user from push_tokens
- [ ] `sendPushToUser(userId, title, body, data)` — convenience wrapper
- [ ] Handle `DeviceNotRegistered` receipts by deleting stale tokens
- [ ] Never throw — log errors, return `{sent, failed}` counts

### Backend: `src/services/backgroundScanner.js` (new)
- [ ] `runBackgroundScanForUser(userId, logger)` — re-uses existing Gmail + IMAP scan logic
  - Fetch user's gmail_connections + imap_credentials
  - For Gmail: call `getValidAccessToken` then scan only emails newer than `last_background_scan_at`
  - For IMAP: use stored encrypted creds, scan with `daysBack` = days since last scan (max 7)
  - Call `batchUpsertSubscriptions` + `markStaleSubscriptions`
  - Update `profiles.last_background_scan_at = now()`
  - Save scan metadata
- [ ] `scheduleBackgroundScans(logger)` — node-cron every 6 hours (`0 */6 * * *`)
  - Query all users from profiles where connected (have gmail_connections OR imap_credentials)
  - Run `runBackgroundScanForUser` for each, catch per-user errors (don't abort batch)
  - After scan: call price change detection, trial detection, renewal warnings, rebilling detection
- [ ] Export `scheduleBackgroundScans` — called from `server.js` on startup

### Backend: wire into `server.js`
- [ ] Import and call `scheduleBackgroundScans(server.log)` on startup (unconditional, no flag needed)
- [ ] Keep QUEUE_ENABLED path unchanged

### New push notifications (triggered from background scanner)
- [ ] On new subscription detected (not in DB before): push "New subscription found — {merchant} ${amount}/mo"
- [ ] Idempotency: only push once per new merchant per user (check if merchant existed before upsert)

### Test checklist
- [ ] Manual trigger: `POST /scan/background` (admin-only or dev-only endpoint) to test without waiting 6h
- [ ] Confirm running twice on same emails doesn't duplicate subscriptions (upsert key is user_id+merchant)
- [ ] Confirm `last_background_scan_at` advances each run

### Commit: `feat(monitoring): background email scanning + push infrastructure`

---

## Feature 2 — Price Change Detection

### DB migrations (same file: `20260523_retention.sql`)
- [ ] Create `subscription_price_history` table:
  ```sql
  id BIGSERIAL PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
  ```
- [ ] Index: `(subscription_id, detected_at DESC)`

### Backend: `src/services/priceChangeDetector.js` (new)
- [ ] `recordPriceHistory(subscriptionId, userId, amount, currency)` — insert row
- [ ] `detectPriceChange(userId, merchant, newAmount, currency)`:
  - Lookup subscription id from `subscriptions` by (user_id, merchant)
  - Fetch latest row from `subscription_price_history` for this subscription
  - If no history: insert baseline, return null
  - If amount changed: insert new row, return `{direction: 'increase'|'decrease', oldAmount, newAmount, delta}`
  - If no change: return null
- [ ] `processPriceChanges(userId, detectedSubs, logger)` — called after each background scan
  - For each detected sub: call `detectPriceChange`
  - On increase: push notification "📈 {merchant} increased from ${old} to ${new}"
  - On decrease: record silently (surfaced in digest — Feature 7)

### Test checklist
- [ ] Insert a sub with $9.99, simulate re-scan at $11.99 → confirm push fires
- [ ] Re-scan at $11.99 again → confirm no duplicate push (history row already at $11.99)
- [ ] Decrease: no push, but new history row recorded

### Commit: `feat(price-change): price change detection and alerts`

---

## Feature 3 — Free Trial Countdown

### DB migrations (same file)
- [ ] Create `subscription_trials` table:
  ```sql
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant TEXT NOT NULL,
  trial_end_date DATE NOT NULL,
  amount_after_trial NUMERIC,
  currency TEXT DEFAULT 'USD',
  notified_3day BOOLEAN DEFAULT false,
  notified_1day BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, merchant, trial_end_date)
  ```

### Backend: `src/services/trialDetector.js` (new)
- [ ] `classifyTrialEmail(subject, body)` — rule-based, returns `{isTrial, trialEndDate, amountAfterTrial}` or null
  - Subject/body patterns: "free trial", "trial ends", "won't be charged until", "trial period", "your trial"
  - Date extraction: look for patterns like "June 3", "03/06/2026", "in 14 days", "on May 30"
  - Amount extraction: reuse `parseAmount` from subscriptionEngine
  - Return null if confidence is low (no date found)
- [ ] `processTrialEmails(userId, emails, logger)` — called from background scanner
  - Filter emails by trial signals first (cheap check)
  - For matching emails: call `classifyTrialEmail`
  - Upsert into `subscription_trials` (conflict: user_id+merchant+trial_end_date → ignore)
  - Do not create a trial record if user already has an active confirmed subscription for this merchant
- [ ] `checkTrialNotifications(logger)` — called from daily cron (node-cron `0 9 * * *`)
  - Query trials where `trial_end_date = today + 3` AND `notified_3day = false`
  - Send push: "Your {merchant} trial ends in 3 days. You'll be charged ${amount}/mo."
  - Mark `notified_3day = true`
  - Same for 1 day remaining

### Test checklist
- [ ] Email with "free trial ends June 3" → trial record created with correct date
- [ ] Trial already paying (has confirmed sub) → no trial record
- [ ] 3 days before end → push fires; run again → no duplicate

### Commit: `feat(trials): free trial detection and countdown notifications`

---

## Feature 4 — Annual Renewal Early Warning

### DB migrations (same file)
- [ ] Add `annual_renewal_date DATE` column to `subscriptions`

### Backend: extend `backgroundScanner.js` / `priceChangeDetector.js`
- [ ] In `batchUpsertSubscriptions` or post-scan hook: detect yearly cadence (billing_interval = 'yearly')
- [ ] `computeNextAnnualRenewal(lastSeenAt, renewalDate)` — returns next occurrence within 12 months
- [ ] After background scan: update `annual_renewal_date` for all yearly subscriptions
- [ ] `checkAnnualRenewalWarnings(logger)` — node-cron `0 9 * * *`
  - Query `subscriptions` where `billing_interval = 'yearly'`
    AND `annual_renewal_date BETWEEN now() AND now() + 14 days`
    AND `is_active = true`
  - Push: "Adobe Creative Cloud renews annually on {date} — ${amount}. Still using it?"
  - Deduplicate: track sent warnings per subscription per renewal cycle (use `subscription_events` table)

### `subscription_events` table (new, for dedup tracking)
- [ ] Add to migration:
  ```sql
  id BIGSERIAL PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,  -- 'annual_warning', 'rebilling', 'price_increase', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscription_id, event_type, DATE_TRUNC('month', created_at))
  ```

### Test checklist
- [ ] Yearly sub with renewal 10 days out → push fires
- [ ] Run again same day → no duplicate (subscription_events dedup)
- [ ] Monthly sub → not affected

### Commit: `feat(annual-renewal): annual subscription renewal warnings`

---

## Feature 5 — Cancelled but Re-billed Detection

### Logic (no new tables — uses existing `subscriptions.is_active`)
- [ ] In `backgroundScanner.js` post-scan: before calling `batchUpsertSubscriptions`, snapshot which merchants are currently `is_active = false` for this user
- [ ] After upsert: check if any previously-inactive merchant now has `is_active = true` again
- [ ] If yes AND the subscription has been inactive for 60+ days (check `last_seen_at`): fire push
  - Push: "You're being charged by {merchant} again — you may have forgotten to cancel."
  - Record in `subscription_events` with event_type = 'rebilling'

### Test checklist
- [ ] Merchant inactive 65+ days, re-detected in scan → push fires
- [ ] Merchant inactive 30 days, re-detected → no push (under 60-day threshold)
- [ ] Same re-billing event → no duplicate push (subscription_events dedup)

### Commit: `feat(rebilling): cancelled but re-billed subscription detection`

---

## Feature 6 — Subscription Creep Score

### DB migrations (same file)
- [ ] Add `baseline_monthly_spend NUMERIC` to `profiles` table
- [ ] Add `current_creep_score NUMERIC` to `profiles` table (cached, recomputed each scan)

### Backend: `src/services/creepScore.js` (new)
- [ ] `computeMonthlyTotal(userId)` — sum of active confirmed subscriptions normalized to monthly
  - monthly: amount × 1
  - weekly: amount × 52 / 12
  - quarterly: amount / 3
  - yearly: amount / 12
- [ ] `updateCreepScore(userId, logger)` — called after every background scan
  - If `baseline_monthly_spend` is null: set it to current total (first scan)
  - Compute score = (current / baseline) × 100, round to integer
  - Update `profiles.current_creep_score`
- [ ] `GET /creep-score` route — returns `{score, baseline, current, label}`
  - label: "On track" (≤100), "Growing" (101–120), "High" (>120)

### Frontend: `app/(tabs)/index.js`
- [ ] Fetch `GET /creep-score` after syncNow
- [ ] Show creep score card below hero section (only when `first_scan_at` is set)
  - Green card (≤100): "Your subscription spend is stable"
  - Amber card (101–120): "Your subscription spend is X% higher than when you started"
  - Red card (>120): "Your subscription spend is X% higher than when you started"
- [ ] Guard array methods per lessons.md: always `(val || []).method()`

### Test checklist
- [ ] First scan: baseline set, score = 100
- [ ] Add subscription: score increases
- [ ] Cancel subscription: score decreases
- [ ] Score displayed correctly in all 3 tiers

### Commit: `feat(creep-score): subscription creep score tracking and home screen indicator`

---

## Feature 7 — Yearly Subscription Audit Notification

### Logic
- [ ] `checkAnniversaryDigests(logger)` — node-cron `0 9 * * *`
  - Query profiles where `DATE_TRUNC('day', first_scan_at) = DATE_TRUNC('day', now() - interval '1 year')`
  - For each: aggregate from last 12 months:
    - Total spend: sum from `subscription_price_history` detected in last year
    - Price increases: count from `subscription_events` where event_type = 'price_increase'
    - Cancelled: count subscriptions with user_status = 'cancelled' updated in last year
  - Send push: "Your BIB year in review: you paid ${total} in subscriptions. {n} prices increased. You cancelled {m} services."
  - Record in `subscription_events` (event_type = 'anniversary_digest', dedup by year)

### Test checklist
- [ ] User with `first_scan_at` = exactly 1 year ago → digest fires
- [ ] Run again same day → no duplicate

### Commit: `feat(anniversary): yearly subscription audit digest notification`

---

## Implementation Checklist (ordered)

- [ ] Write single migration file `supabase/migrations/20260523_retention.sql`
- [ ] Apply migration to Supabase
- [ ] Feature 1: pushService.js + backgroundScanner.js + server.js wiring + dev trigger endpoint
- [ ] Feature 2: priceChangeDetector.js + integration into background scanner
- [ ] Feature 3: trialDetector.js + daily cron
- [ ] Feature 4: annual renewal logic + subscription_events dedup
- [ ] Feature 5: rebilling detection in background scanner
- [ ] Feature 6: creepScore.js + backend route + frontend card
- [ ] Feature 7: anniversary digest cron

---

## Lessons to follow (from .claude/lessons.md)
1. `>= 2 occurrences` before flagging recurring (already in engine — maintain this)
2. No non-ASCII quote chars in JS strings after edits
3. Always init state as `[]` not `null` for arrays in frontend; guard all `.some()/.filter()/.map()/.reduce()` with `?.` or `(val || []).method()`
