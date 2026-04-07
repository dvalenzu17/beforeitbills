# BIB — Sprint Board

## Sprint Levels 62→100: Complete ✓
_All previous sprint tasks done. Entering post-launch feature phase._

---

## TIER 1 — Kills retention without these

> These are the gaps that cost downloads, cause uninstalls, and block App Store top charts.
> Build in order.

- [x] **Multi-email account support** — `lib/emailImportStore.js`, `app/account/connect-email/`
      Connect multiple inboxes (Gmail + Yahoo/Outlook/iCloud/IMAP). Each account scannable independently.
      IMAP creds stored in `expo-secure-store`. Migration for existing single-account users on hydrate.
      _commit fdb54e3_

- [x] **Biometric app lock** — `lib/biometricLock.js`, `app/_layout.js`, `app/account/biometric-lock.js`, `app/account/settings.js`
      Face ID / Touch ID on app open. AppState listener locks on background.
      Lock overlay uses Feather icon (fixed from emoji). Settings row → `/account/biometric-lock`.
      Requires successful auth before enabling to prove user can unlock. Fails open on error.
      _audit fix: replaced 🔒 emoji with Feather "lock" icon in overlay_

- [x] **Home screen + lock screen widgets** — `modules/widget-bridge/`, `android/`, `ios-widget/`, `plugins/withIosWidget.js`
      Android: AppWidgetProvider reads widget_data.json from filesDir. XML layout, 4×2 cells.
      iOS: WidgetKit extension (Small/Medium/Large) reads from App Group UserDefaults.
      Config plugin adds WidgetKit target during `expo prebuild`. Data pushed after every syncNow.
      ⚠️ REQUIRES `expo prebuild` + native rebuild to appear — won't show in Expo Go.

- [x] **Swipe actions on list rows** — `app/recurring.js`
      Swipe left → Edit (blue). Swipe right → Archive (amber) + Delete (red, confirm alert).
      Haptic feedback on open. Archive triggers CelebrationSheet when savedEntry returned.

- [x] **Pull-to-refresh** — `app/(tabs)/index.js`, `app/(tabs)/insights.js`, `app/recurring.js`
      Custom BiBRefreshControl + BiBRefreshBanner (rotating dashed ring + credit-card icon).
      Brand-colored native RefreshControl + animated 58dp banner slides in above content.

- [x] **Natural language add** — `app/add-recurring.js`, `lib/parseSubscription.js`, `backend/src/routes/parseRoutes.js`
      "Quick add" input at top of the main add-recurring screen (all entry points).
      Auth-protected POST /parse-subscription on backend. Uses OpenAI gpt-4.1-mini.
      Pre-fills form via RecurringForm `headerContent` + `key` re-mount pattern.
      "Clear" button resets to blank form. Green "✓ Fields pre-filled" confirmation.
      ⚠️ Requires OPENAI_API_KEY set on Render backend. Returns 503 gracefully if not set.
      _audit fix: was only on /manual-add (unreachable from main flow), moved to /add-recurring_

- [x] **Rich push notifications with actions** — `lib/notificationsEngine.js`, `app/_layout.js`, `lib/store.js`
      3-button category: View (navigates to sub/bill), Snooze 1 day, Done (marks handled).
      Copy: "Netflix — renewing tomorrow · $15.99 · Jan 15"
      Android: HIGH channel + brand color. Scheduled on every syncNow.

- [x] **Custom reminder time picker** — `app/account/notifications.js`
      Inline spinner on iOS (expands below row), system dialog on Android.
      Time shown as "9:00 AM" with chevron. Saved to store `timeOfDay`. All hardcoded "9 AM" removed.

---

## TIER 2 — What separates good apps from great ones

- [x] **Spend forecasting** — `app/(tabs)/insights.js`
      12-month forward projection bar chart. Annual total shown: "At this rate: $X/yr".
      `computeSpendForMonth()` correctly handles monthly/weekly (always), quarterly (every 3 months),
      yearly (once/year) by checking renewal month alignment. `ForecastCard` with tap-to-inspect bars.

- [x] **Month-over-month comparison** — `app/(tabs)/insights.js`
      6-month history bar chart. Delta badge: "+12% vs last month" / red-green coloring.
      `MonthTrendCard` uses same `computeSpendForMonth()` with negative offsets for past months.
      Current month highlighted; tapping any bar shows month name + spend.

- [x] **Savings tracker** — `lib/store.js`, `app/(tabs)/index.js`
      `savings: { totalSaved, entries[] }` persisted to AsyncStorage. `recordSaving()` auto-called
      when `updateSub/Bill({ active: false })`. Monthly-equivalent stored (yearly÷12, quarterly÷3, weekly×52÷12).
      Home screen green card only shown when totalSaved > 0.

- [x] **Confetti / celebration moments** — `components/CelebrationSheet.js`
      60-particle moti confetti + spring bottom sheet: "You just saved $14.99/mo · $179.88/yr".
      Fires on: swipe-archive in recurring.js, archive/delete in recurring/[kind]/[id].js.
      _audit fixes: removed double updateSub call in onSubmit (was recording savings twice);
      confirmDelete now archives first (captures savedEntry) then hard-deletes so celebration fires_

- [x] **Global search** — `app/search.js`
      Full-screen search (autofocus) reachable via search icon in home hero + recurring header.
      Searches subs + bills via `getRecurring()`. Results show brand avatar, kind badge, amount.
      Tap → navigates to `/recurring/[kind]/[id]`. Empty state + no-results state both handled.

- [x] **Long-press context menus** — `components/ContextMenuSheet.js`
      Bottom sheet triggered by long press (400ms delay) across home screen upcoming list + recurring list.
      Actions: Edit, Archive, Cancel subscription (subs only), Share (native), Delete (recurring only).
      Archive triggers CelebrationSheet if savedEntry returned. Haptic on open.

- [x] **Conflict resolution UI** — `lib/store.js`, `components/ConflictResolutionSheet.js`, `app/_layout.js`
      `mergeSubsLWW` now returns `{ merged, conflicts }`. A conflict is detected when remote wins LWW
      but local `updatedAt > lastSyncedAt` AND key fields (amount/merchant/cadence) differ.
      `ConflictResolutionSheet` shows side-by-side: "This device" vs "Other device" with amount + relative time.
      "Keep mine" re-upserts local version to cloud. "Use theirs" accepts remote (already applied). "Skip" dismisses.
      Sheet lives in `_layout.js` behind auth+lock guard. All 4 locales. Conflicts deduplicated across syncs.

---

## TIER 3 — Platform-level polish

- [x] **Apple Sign In** — `app/(auth)/sign-in.js`
      **App Store requirement** — required when any third-party OAuth is offered.
      `expo-apple-authentication` (already installed). SHA-256 nonce via `expo-crypto`.
      Button uses `AppleAuthenticationButton` (App Store compliant). iOS-only, hidden on Android.
      Persists display name from first sign-in (Apple omits it after). Dark/light button style follows theme.
      `ERR_REQUEST_CANCELED` silently ignored (user dismissed sheet). Plugin added to `app.config.js`.
      ⚠️ REQUIRES `expo prebuild` + native rebuild — entitlement must be enabled in Apple Developer portal.

- [x] **Siri / Google Assistant shortcuts** — `lib/shortcuts.js`, `app/_layout.js`, `app/account/settings.js`
      Home-screen quick actions (iOS 3D Touch / Android long-press): Add Subscription, View Spending, Scan Inbox.
      `expo-quick-actions` with try/catch fallback. Listener + cold-start handler wired in `_layout.js`.
      Settings shows green dot when active. All 4 locales. Add `expo-quick-actions` to plugins in `app.config.js`.
      ⚠️ REQUIRES `expo prebuild` + native rebuild to appear — won't show in Expo Go.

- [x] **Share sheet extension** — `ios-share-extension/`, `plugins/withShareExtension.js`, `modules/widget-bridge/`, `app/_layout.js`, `app/add-recurring.js`
      iOS Share Extension appears in share sheet for text, URLs, and web pages.
      `ShareViewController.swift`: minimal branded overlay → extracts text/URL → writes JSON to
      App Group UserDefaults (`bib_pending_share`) → auto-dismisses.
      `WidgetBridgeModule.swift`: added `getPendingShare()` + `clearPendingShare()` (reuses existing App Group).
      `_layout.js`: AppState listener checks for pending share on foreground + cold-start → navigates to
      `/add-recurring?shareText=...`.
      `add-recurring.js`: `shareText` param auto-triggers NL parse on mount (reuses `/parse-subscription` endpoint).
      ⚠️ REQUIRES `expo prebuild` + native rebuild. App Group must be enabled in Apple Developer portal.

- [ ] **iPad / tablet layout**
      Currently renders as stretched single-column on iPad.
      Two-column master/detail with `useWindowDimensions`.

- [x] **Drag to reorder** — `app/recurring.js`, `lib/store.js`
      "Reorder" chip (≡) in filter bar activates drag mode. In drag mode: `DraggableFlatList` replaces
      `ScrollView`, each row shows ≡ handle (long-press activates drag), swipe disabled for clean gestures.
      `ScaleDecorator` for lift animation. `sortOrder: []` in store, persisted to AsyncStorage via `setSortOrder`.
      First activation seeds order from current filtered list. `onDragEnd` saves new key order.
      Non-drag sorts (amount/next/name) unaffected. All 4 locales.

---

## TIER 4 — Growth and monetization

- [ ] **Annual plan "Save X%" badge** — `components/PaywallSheet.js`
- [ ] **Family plan**
- [ ] **Referral program** — `components/ReferralSheet.js` (exists — is logic live?)
- [ ] **Winback flow** — `lib/notify.js`, backend (zero winback on trial expiry)
- [ ] **Free tier ad monetization** — `components/AdSlotCard.js` (exists but unused)
- [ ] **Spend benchmarking** — `app/(tabs)/insights.js`, backend

---

## TIER 5 — Security and trust

- [ ] **Apple privacy nutrition label** (App Store requirement)
- [ ] **Certificate pinning** — `lib/supabase.js` (`react-native-ssl-pinning`)
- [ ] **App lock timeout** — `app/_layout.js` (lock after N min background, separate from biometric)
- [ ] **Data deletion end-to-end** — `app/account/settings.js`, backend (GDPR/CCPA)

---

## Completed
_Previous sprint items (levels 62→100) — all done._
_See git log for commit hashes._
