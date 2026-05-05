# BeforeItBills — Test Checklist

> Run before every TestFlight / App Store submission.
> Device: physical iPhone (iOS 16+). Simulator cannot test Apple Sign In, RevenueCat IAP, biometrics, or widgets.
>
> Items marked **[DEV ONLY]** require a development build — either because they deliberately trigger errors (polluting prod Sentry/PostHog if done in TestFlight), require network simulation/proxying, or need Hermes/Flipper profiling tools only available with a dev client.

---

## 1. Authentication

### Apple Sign In
> **Prerequisite**: Supabase Dashboard → Auth → Providers → Apple → "Bundle ID" must be set to `com.beforeitbills.app`. Without this, sign-in fails with `Unacceptable audience in id_token`.

- [x] ~~First-time sign in — Apple sheet appears, name + email granted, user lands on onboarding~~ *(untestable — Apple only allows first-time flow once per Apple ID; return sign-in verified)*
- [x] ~~First-time sign in — user hides email (relay address)~~ *(untestable — requires a fresh Apple ID)*
- [x] ~~First-time sign in — user denies name/email sharing~~ *(untestable — requires a fresh Apple ID)*
- [x] Return sign in — Apple sheet completes quickly, user goes straight to home (no onboarding repeat)
- [ ] User taps Cancel on Apple sheet — no error alert, no loading state stuck
- [x] ~~Apple Sign In on a device with no iCloud account configured — graceful error message~~ *(untestable on development device)*

### Google Sign In
> **Prerequisite**: Supabase Dashboard → Auth → Providers → Google → "Additional Authorized Client IDs" must include `577544895857-igb9t8cbphcfao6idjjot8u81h3nbp4t.apps.googleusercontent.com` (the iOS client ID). Without this, sign-in fails with `Unacceptable audience in id_token`. Client ID falls back to the hardcoded value from `app.config.js` if `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is not set in `.env`.

- [ ] First-time Google sign in — OAuth browser opens, redirects back, lands on onboarding
- [ ] Return Google sign in — lands on home
- [ ] User cancels Google OAuth browser — no crash, no stuck loading
- [ ] Gmail permission denied during onboarding — scan-setup shows correct fallback (IMAP option)

### Email / Password
- [x] Sign up with new email — confirmation email received (if email confirm is on in Supabase)
- [x] Sign in with correct credentials — succeeds
- [x] Sign in with wrong password — shows sanitized error, not raw Supabase message
- [x] Sign up with already-registered email — shows appropriate message
- [x] Password field toggles visibility
- [x] Forgot password flow (if implemented)

### Session
- [x] Kill app and reopen — user stays signed in (session persists)
- [x] Token expiry — app silently refreshes, user never sees a sign-in screen mid-session
- [x] Sign out — clears all local state, returns to sign-in screen

---

## 2. Onboarding

- [x] Onboarding only shown on first sign-in, never on return visits
- [x] All 4 steps complete without error on a fresh account
- [x] Back navigation between onboarding steps works
- [x] ~~Skipping Gmail permission and going IMAP route — scan-setup shows IMAP form~~ *(Gmail permissions not requested during onboarding by design)*
- [x] Completing onboarding with no email connected — lands on home with empty state, not crash

---

## 3. Email Scanning — Gmail

- [x] ~~Grant Gmail permission during onboarding → scan starts automatically~~ *(Gmail permissions not requested during onboarding by design)*
- [x] Scan completes — subscriptions appear on home screen
- [x] Scan with inbox that has no billing emails — empty state shown, no crash
- [x] Scan with very large inbox (1000+ emails) — progress card shows, no timeout crash
- [x] Re-scan from home / account — works after initial scan
- [x] Gmail token expires mid-scan — handled gracefully (re-auth prompt or error)
- [x] Revoke Gmail access from Google account settings externally → app shows reconnect prompt

---

## 4. Email Scanning — IMAP

- [ ] Yahoo: correct host/port auto-filled, scan succeeds
- [ ] Outlook: correct host/port, scan succeeds
- [ ] iCloud: app-specific password required — UI explains this, link to appleid.apple.com works
- [ ] Wrong password — verify step shows clear error, not raw server message
- [ ] Wrong host — verify step fails gracefully
- [ ] IMAP scan with 2FA account without app password — clear error messaging
- [ ] Disconnect IMAP account — removes credentials, stops future scans

---

## 5. Subscriptions — Home Screen

- [ ] Subscriptions sorted by next renewal date ascending
- [ ] Urgent badge (≤7 days) shown on correct items
- [ ] Amount displayed in user's currency (not always USD)
- [ ] Subscription with no next renewal date — handled (shown last or excluded)
- [ ] Subscription with yearly cadence — monthly equivalent shown correctly (÷12)
- [ ] Subscription with weekly cadence — monthly equivalent shown correctly (×4.33)
- [ ] Pull-to-refresh triggers re-sync
- [ ] Empty state (no subscriptions) — shown correctly, not blank screen
- [ ] More than 20 subscriptions — list scrolls, no layout breakage

---

## 6. Subscription Detail

- [ ] Tap subscription → detail screen opens with correct data
- [ ] Status change: Confirmed / Cancelled / Ignored — persists after closing
- [ ] Cancel action — confirmation prompt before status change
- [ ] Website link opens in browser (in-app or Safari)
- [ ] Brand logo loads (logo.dev / Brandfetch)
- [ ] Brand logo fails to load → falls back to initials avatar gracefully
- [ ] Subscription with no amount — shown as $0.00 or hidden, not crash
- [ ] Subscription with multi-currency amount — displayed correctly

---

## 7. Manual Add / Edit

- [ ] Add subscription manually — appears in list immediately
- [ ] Add bill manually — appears in list immediately
- [ ] Edit existing subscription — all fields save correctly
- [ ] Delete subscription — removed from list, not recoverable (confirm prompt shown)
- [ ] Adding duplicate merchant — no crash
- [ ] Amount field: decimal input, currency symbol shown, no double negative

---

## 8. Insights Tab

- [ ] Monthly spend bar chart renders without error
- [ ] Category breakdown donut chart renders
- [ ] Month selector / navigation works
- [ ] Yearly projection shown correctly
- [ ] Insights with 0 active subscriptions — empty state, not crash or divide-by-zero

---

## 9. Recap Tab

- [ ] Recap sheet opens and displays summary
- [ ] Sharing recap (screenshot / share sheet) works

---

## 10. Account Tab

- [ ] Profile name and email displayed correctly
- [ ] Edit display name — saves and reflects immediately
- [ ] Profile photo: camera pick, library pick, crop — saves correctly
- [ ] Connected email accounts shown
- [ ] Disconnect email — removes from list, stops scan

### Settings
- [ ] Notifications toggle — enabling requests permission, disabling cancels scheduled notifications
- [ ] Notification permission denied in OS settings — app shows correct explanation with link to Settings
- [ ] Language picker — changing language updates all visible strings immediately
- [ ] Biometric lock enable — FaceID/TouchID prompt shown
- [ ] Biometric lock — app locks when backgrounded, unlock required on return
- [ ] Biometric lock on device without biometric hardware — toggle hidden or disabled
- [ ] Export data — generates CSV, share sheet opens

### Delete Account
- [ ] Delete account flow — confirmation prompt, account deleted, redirected to sign-in
- [ ] Delete account — all subscriptions and bills removed from DB
- [ ] Delete account — auth user deleted from Supabase

---

## 11. Upgrade / Paywall (RevenueCat)

- [ ] Free user — paywall appears when hitting subscription limit
- [ ] Paywall: annual plan selected by default
- [ ] Paywall: toggle between annual and monthly — price updates
- [ ] Paywall: tap Subscribe — IAP sheet appears
- [ ] Successful purchase — isPro flips to true, paywall dismissed, features unlocked
- [ ] Purchase cancelled — no stuck loading state
- [ ] Purchase failed (e.g. no payment method) — sanitized error shown
- [ ] Restore purchases — restores previous Pro entitlement
- [ ] Restore purchases with no prior purchase — shows "nothing to restore" message
- [ ] Pro user opens paywall — not shown (or shows "already subscribed" state)
- [ ] Free trial: 7-day trial text shown correctly, subscription starts after trial
- [ ] Subscription cancelled in App Store settings → isPro flips to false on next app open

---

## 12. Price Alerts

- [ ] Price alert created — appears in alerts list
- [ ] Alert triggers when price changes
- [ ] Alert dismissed — removed from list
- [ ] Price alerts screen with no alerts — empty state shown

---

## 13. Notifications

- [ ] Renewal notification scheduled correctly (X days before renewal)
- [ ] Notification tapped — opens correct subscription detail
- [ ] Notifications disabled in OS → no crash on app open
- [ ] Notification scheduled for past date — not shown (handled gracefully)
- [ ] iOS 26: `setNotificationHandler` not called at module-eval time — no TurboModule crash

---

## 14. iOS Widgets

### Widget data
- [ ] After scan completes — widget updates within ~1 minute (WidgetKit reload called)
- [ ] Widget shows correct monthly total
- [ ] Widget shows correct next renewal item and date
- [ ] Widget with 0 subscriptions — placeholder / empty state, no crash
- [ ] Widget data persists after app is force-quit (written to App Group UserDefaults)

### Spend Overview widget
- [ ] Small: monthly total, active count, mini color bar all correct
- [ ] Medium: spend on left, 3-item list on right
- [ ] Large: header + mini chart + 5-item list

### Upcoming Renewals widget
- [ ] Small: next renewal name, amount in rose, urgency bar
- [ ] Medium: 2×2 grid of next 4 items
- [ ] Large: timeline with spine dots, urgent items in rose

### Spend Insights widget
- [ ] Small: urgent count in rose, brand dots for urgent items
- [ ] Medium: 6-month bar chart, current month bar highlighted in rose

### Widget edge cases
- [ ] Widget on dark wallpaper — dark glass background looks correct
- [ ] All 3 widget kinds appear in iOS widget picker with correct names
- [ ] Widget with subscription names >15 chars — text truncates, no overflow

---

## 15. Share Extension

- [ ] Share a URL from Safari → extension appears in share sheet
- [ ] Shared URL is picked up by main app on next open
- [ ] Share extension with no active session — handled gracefully (no crash)

---

## 16. Deep Links

- [ ] `beforeitbills://` scheme opens app from another app
- [ ] OAuth callback `beforeitbills://redirect` completes Google sign-in flow

---

## 17. New Architecture (Hermes / TurboModules)

- [ ] App launches without crash on iOS 16
- [ ] App launches without crash on iOS 26 (void TurboModule patch active)
- [ ] Reanimated animations (onboarding, paywall, sheets) render correctly
- [ ] Moti animations run without dropped frames
- [ ] `react-native-purchases` loads correctly (no "module not found" error)
- [ ] RevenueCat purchase flow completes on New Arch

---

## 18. Offline / Network

- [ ] App opens with no network — home screen shows cached data, no crash
- [ ] Scan triggered offline — clear error, not silent failure
- [ ] **[DEV ONLY]** Network returns mid-scan — scan resumes or restarts cleanly (requires network condition simulation via Settings > Airplane mode toggle or Charles Proxy; hard to time reliably in TestFlight)
- [ ] **[DEV ONLY]** Supabase queries fail — sanitized error shown, not raw message (simulate by pointing `EXPO_PUBLIC_SUPABASE_URL` to a dead host in a dev build)
- [ ] **[DEV ONLY]** Backend unreachable (Render sleeping) — retry or clear error (simulate by setting `EXPO_PUBLIC_BACKEND_URL` to unreachable host in dev build)

---

## 19. Localization (i18n)

- [ ] English — all strings present, no `[missing translation]`
- [ ] Spanish (es) — all strings present
- [ ] Portuguese (pt) — all strings present
- [ ] French (fr) — all strings present
- [ ] Long strings (German-length) don't break layout — check buttons, labels, cards
- [ ] Currency displays correctly for each locale
- [ ] Date formats correct per locale (May 3 vs 3 mai vs 3 de mayo)

---

## 20. Analytics & Crash Reporting

- [ ] **[DEV ONLY]** PostHog events fire on key actions (sign in, scan, purchase) — verify in PostHog debug mode (TestFlight events hit prod, hard to isolate)
- [ ] **[DEV ONLY]** Sentry captures errors — trigger a known error and confirm it appears in Sentry (do not trigger deliberate crashes in TestFlight builds)
- [ ] **[DEV ONLY]** No PII (email, name, token) in Sentry breadcrumbs or PostHog properties — inspect via Sentry debug view / PostHog event inspector

---

## 21. Performance

- [ ] Home screen renders in <500ms after sign-in
- [ ] Subscription list with 50+ items scrolls at 60fps
- [ ] Scan with 500+ emails completes without memory warning
- [ ] **[DEV ONLY]** No memory leak after navigating back and forth between screens 10 times — profile with Hermes memory inspector or Flipper (unavailable in TestFlight)

---

## 22. App Store submission

- [ ] Build number incremented from last submission
- [ ] Privacy manifest present and correct (UserDefaults, FileTimestamp, SystemBootTime, DiskSpace)
- [ ] No private API usage (`UIWebView`, etc.)
- [ ] App Group capability present on main app + SubsWidget + ShareExtension provisioning profiles
- [ ] All 3 extension bundle IDs (`ShareExtension`, `SubsWidget`) included in archive
- [ ] Export compliance: `NSUsesNonExemptEncryption = false` in Info.plist ✓ (already set)
- [ ] Screenshots prepared for all required device sizes
- [ ] App Privacy labels in App Store Connect match actual data usage
