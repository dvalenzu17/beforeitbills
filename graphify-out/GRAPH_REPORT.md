# Graph Report - .  (2026-05-06)

## Corpus Check
- Large corpus: 283 files · ~232,888 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1139 nodes · 2264 edges · 104 communities (92 shown, 12 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 201 edges (avg confidence: 0.8)
- Token cost: 100,491 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Date Utils & Tab Navigation|Date Utils & Tab Navigation]]
- [[_COMMUNITY_Email Connect & Account Screens|Email Connect & Account Screens]]
- [[_COMMUNITY_Brand Resolution|Brand Resolution]]
- [[_COMMUNITY_Auth & Account Core|Auth & Account Core]]
- [[_COMMUNITY_Dev Tools & Scan Onboarding|Dev Tools & Scan Onboarding]]
- [[_COMMUNITY_Account Settings Screens|Account Settings Screens]]
- [[_COMMUNITY_Settings UI Components|Settings UI Components]]
- [[_COMMUNITY_Account Info Screens|Account Info Screens]]
- [[_COMMUNITY_Subscription Optimizer|Subscription Optimizer]]
- [[_COMMUNITY_iOS Widget|iOS Widget]]
- [[_COMMUNITY_Add Subscription Flow|Add Subscription Flow]]
- [[_COMMUNITY_Notification Engine|Notification Engine]]
- [[_COMMUNITY_Paywall & Skeleton UI|Paywall & Skeleton UI]]
- [[_COMMUNITY_App Config & CICD|App Config & CI/CD]]
- [[_COMMUNITY_Price Alert System|Price Alert System]]
- [[_COMMUNITY_Gmail Backend Services|Gmail Backend Services]]
- [[_COMMUNITY_Insights Tab Charts|Insights Tab Charts]]
- [[_COMMUNITY_Email Parsing Core|Email Parsing Core]]
- [[_COMMUNITY_CSV Import & Calendar|CSV Import & Calendar]]
- [[_COMMUNITY_Backend Auth & Routes|Backend Auth & Routes]]
- [[_COMMUNITY_Bill Splitting & Cancel|Bill Splitting & Cancel]]
- [[_COMMUNITY_Onboarding Flow|Onboarding Flow]]
- [[_COMMUNITY_Email Import API Client|Email Import API Client]]
- [[_COMMUNITY_Export & Import UI|Export & Import UI]]
- [[_COMMUNITY_Backend Scan & DB|Backend Scan & DB]]
- [[_COMMUNITY_Scan Queue System|Scan Queue System]]
- [[_COMMUNITY_Subscription Detection Engine|Subscription Detection Engine]]
- [[_COMMUNITY_Error Handling & Diagnostics|Error Handling & Diagnostics]]
- [[_COMMUNITY_Backend Infrastructure|Backend Infrastructure]]
- [[_COMMUNITY_Android Launcher Icons|Android Launcher Icons]]
- [[_COMMUNITY_Calendar View|Calendar View]]
- [[_COMMUNITY_ML Model & Widget Bridge|ML Model & Widget Bridge]]
- [[_COMMUNITY_Cancel Center|Cancel Center]]
- [[_COMMUNITY_Notification Settings|Notification Settings]]
- [[_COMMUNITY_Cash Flow Analysis|Cash Flow Analysis]]
- [[_COMMUNITY_IMAP Backend|IMAP Backend]]
- [[_COMMUNITY_Email Parser|Email Parser]]
- [[_COMMUNITY_iOS Share Extension|iOS Share Extension]]
- [[_COMMUNITY_In-App Ads|In-App Ads]]
- [[_COMMUNITY_Streak Tracking|Streak Tracking]]
- [[_COMMUNITY_iOS Widget Plugin|iOS Widget Plugin]]
- [[_COMMUNITY_Recurring Status Tags|Recurring Status Tags]]
- [[_COMMUNITY_Share Extension Plugin|Share Extension Plugin]]
- [[_COMMUNITY_Brand Assets|Brand Assets]]
- [[_COMMUNITY_Android Density Variants|Android Density Variants]]
- [[_COMMUNITY_Android MainActivity|Android MainActivity]]
- [[_COMMUNITY_Global Search|Global Search]]
- [[_COMMUNITY_Gmail OAuth Client|Gmail OAuth Client]]
- [[_COMMUNITY_Instant Value Score|Instant Value Score]]
- [[_COMMUNITY_Push Notification Scheduler|Push Notification Scheduler]]
- [[_COMMUNITY_Recap Sheet UI|Recap Sheet UI]]
- [[_COMMUNITY_Price Alert Logic|Price Alert Logic]]
- [[_COMMUNITY_Email Verify & Sub Form|Email Verify & Sub Form]]
- [[_COMMUNITY_Monthly Recap Prompt|Monthly Recap Prompt]]
- [[_COMMUNITY_Auth API & Merchant Confirm|Auth API & Merchant Confirm]]
- [[_COMMUNITY_Android Widget Bridge|Android Widget Bridge]]
- [[_COMMUNITY_Android MainApplication|Android MainApplication]]
- [[_COMMUNITY_Auth Callback & Gate|Auth Callback & Gate]]
- [[_COMMUNITY_Conflict Resolution UI|Conflict Resolution UI]]
- [[_COMMUNITY_Base UI Atoms|Base UI Atoms]]
- [[_COMMUNITY_Email Candidate Card|Email Candidate Card]]
- [[_COMMUNITY_Cancel Playbooks|Cancel Playbooks]]
- [[_COMMUNITY_Scan Progress Client|Scan Progress Client]]
- [[_COMMUNITY_i18n Placeholder Scripts|i18n Placeholder Scripts]]
- [[_COMMUNITY_Recurring Detail View|Recurring Detail View]]
- [[_COMMUNITY_iOS Widget Bundle|iOS Widget Bundle]]
- [[_COMMUNITY_Subscription Categories|Subscription Categories]]

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 236 edges
2. `TEST_CHECKLIST.md â€” UI Test Checklist` - 46 edges
3. `formatMoney()` - 35 edges
4. `detectRecurringSubscriptions()` - 17 edges
5. `A()` - 15 edges
6. `gmailScanHandler()` - 14 edges
7. `track()` - 13 edges
8. `Expo App Config (expo-config-raw.txt)` - 13 edges
9. `Screen()` - 12 edges
10. `HeaderRow()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `AddRecurring()` --calls--> `useTheme()`  [INFERRED]
  app/add-recurring.js → lib/theme.js
- `Step()` --calls--> `useTheme()`  [INFERRED]
  app/cancel-center.js → lib/theme.js
- `Cards()` --calls--> `useTheme()`  [INFERRED]
  app/cards.js → lib/theme.js
- `ImportMail()` --calls--> `useTheme()`  [INFERRED]
  app/import-mail.js → lib/theme.js
- `Optimize()` --calls--> `useTheme()`  [INFERRED]
  app/optimize.js → lib/theme.js

## Hyperedges (group relationships)
- **iOS Build Pipeline (Maestro Tests + Dev Client + Release)** — codemagic_ios_maestro_workflow, codemagic_ios_dev_client_workflow, codemagic_ios_release_workflow, codemagic_yaml [EXTRACTED 1.00]
- **Backend Route Registration in server.js** — backend_server_js, backend_oauth_routes, backend_scan_routes, backend_imap_scan_routes, backend_subscription_routes, backend_account_routes [INFERRED 0.95]
- **BeforeItBills App Bundle IDs (main + extensions)** — bundle_id_main, bundle_id_share_ext, bundle_id_widget, app_beforeitbills [EXTRACTED 1.00]
- **Expo Config Plugins** — expo_web_browser_plugin, sentry_plugin, expo_localization_plugin, expo_secure_store_plugin, expo_notifications_plugin, expo_config [EXTRACTED 1.00]
- **BeforeItBills Brand Asset Set** — beforeitbillslogo_appicon, splash_splashscreen, notificationicon_icon, profilejpg_placeholder [INFERRED 0.85]
- **Android Multi-Density Icon Assets** — icon_notification_icon, icon_splashscreen_logo, density_hdpi, density_mdpi, density_xhdpi, density_xxhdpi, density_xxxhdpi [EXTRACTED 1.00]
- **Android Density Variants â€” ic_launcher** — mipmap_mdpi_ic_launcher, mipmap_hdpi_ic_launcher, mipmap_xhdpi_ic_launcher, mipmap_xxhdpi_ic_launcher, mipmap_xxxhdpi_ic_launcher, ic_launcher_adaptive_icon [EXTRACTED 1.00]
- **Android Density Variants â€” ic_launcher_foreground** — mipmap_mdpi_ic_launcher_foreground, mipmap_hdpi_ic_launcher_foreground, mipmap_xhdpi_ic_launcher_foreground, mipmap_xxhdpi_ic_launcher_foreground, mipmap_xxxhdpi_ic_launcher_foreground, ic_launcher_foreground_layer [EXTRACTED 1.00]

## Communities (104 total, 12 thin omitted)

### Community 0 - "Date Utils & Tab Navigation"
Cohesion: 0.06
Nodes (32): clamp(), computeBillNextDue(), monthKey(), parseISODate(), toISODate(), ensureNotificationReady(), initNotificationHandler(), nextLocal9am() (+24 more)

### Community 1 - "Email Connect & Account Screens"
Cohesion: 0.05
Nodes (34): WhatsNew(), InsightsRoot(), Amount(), Button(), EmptyState(), GradientButton(), HomeSection(), RowBar() (+26 more)

### Community 2 - "Brand Resolution"
Cohesion: 0.06
Nodes (26): BrandPage(), pickDomain(), pickName(), Chip(), getAmount(), getCurrency(), getNextDate(), getStatus() (+18 more)

### Community 3 - "Auth & Account Core"
Cohesion: 0.06
Nodes (18): Account(), RootIndex(), connectGoogleGmail(), LoginScreen(), ReferralSheet(), ScanProgressCard(), ScanSummaryCard(), ConnectedEmail() (+10 more)

### Community 4 - "Dev Tools & Scan Onboarding"
Cohesion: 0.06
Nodes (21): generateDemoUser(), randomFrom(), DevTools(), addDays(), buildDemoRecurring(), clampDay(), iso(), getEmailsRemaining() (+13 more)

### Community 5 - "Account Settings Screens"
Cohesion: 0.05
Nodes (46): About Screen (account/about.js), Biometric Lock Screen (account/biometric-lock.js), Connected Accounts Screen (account/connected.js), Diagnostics Screen (account/diagnostics.js), Export Screen (account/export.js), Help Screen (account/help.js), Legals Screen (account/legals.js), Notifications Screen (account/notifications.js) (+38 more)

### Community 6 - "Settings UI Components"
Cohesion: 0.07
Nodes (23): SettingsScreen(), BiometricLockOverlay(), ErrorBoundary, LanguagePicker(), bootstrapI18n(), ensureI18n(), getAppLanguage(), normalizeLang() (+15 more)

### Community 7 - "Account Info Screens"
Cohesion: 0.08
Nodes (15): About(), BiometricLockScreen(), Help(), Legals(), PersonalInfo(), Security(), ProgressiveScan(), ConfidenceBreakdownSheet() (+7 more)

### Community 8 - "Subscription Optimizer"
Cohesion: 0.07
Nodes (13): cadenceFactor(), groupKeyForDuplicates(), guessDomainFromMerchant(), monthlyCost(), norm(), Optimize(), shareDivisor(), BrandAvatar() (+5 more)

### Community 9 - "iOS Widget"
Cohesion: 0.09
Nodes (28): Codable, Identifiable, BIBInsightsWidget, BIBOverviewWidget, BIBUpcomingWidget, BrandDot, Color, InsightsWidgetView (+20 more)

### Community 10 - "Add Subscription Flow"
Cohesion: 0.11
Nodes (17): AddRecurring(), formatISO(), ManualAdd(), colorFromString(), fetchBrandfetch(), googleFaviconUrl(), inferDomain(), logoDevUrl() (+9 more)

### Community 11 - "Notification Engine"
Cohesion: 0.15
Nodes (30): applyQuietHours(), atTime(), buildBillCopy(), buildRenewalCopy(), buildUpcoming(), clearScheduledSublyticsReminders(), dateMinutes(), ensureNotificationCategory() (+22 more)

### Community 12 - "Paywall & Skeleton UI"
Cohesion: 0.09
Nodes (14): hasTrial(), PaywallSheet(), priceStr(), Skeleton(), getPurchasesModule(), canUseNativePurchases(), configurePurchases(), getCustomerInfo() (+6 more)

### Community 13 - "App Config & CI/CD"
Cohesion: 0.09
Nodes (25): Android Package: com.dvalenzu17.sublytics, BeforeItBills App, App Store Connect Integration, bib_env Codemagic Environment Group, Brandfetch API Key, Bundle ID: com.beforeitbills.app, Bundle ID: com.beforeitbills.app.ShareExtension, Bundle ID: com.beforeitbills.app.SubsWidget (+17 more)

### Community 14 - "Price Alert System"
Cohesion: 0.11
Nodes (12): DeltaPill(), PriceAlerts(), ContextMenuSheet(), GradientHeader(), monthLabel(), MonthlyDigestCard(), formatMoney(), ChartCarousel() (+4 more)

### Community 15 - "Gmail Backend Services"
Cohesion: 0.15
Nodes (11): getGmailTokens(), updateGmailAccessToken(), decryptCredential(), encryptCredential(), fetchMessage(), getValidAccessToken(), gmailFetch(), listMessages() (+3 more)

### Community 16 - "Insights Tab Charts"
Cohesion: 0.13
Nodes (14): arcPath(), cadenceFactor(), computeSpendForMonth(), createSmoothPath(), daysUntil(), FeatureCard(), InsightRow(), Insights() (+6 more)

### Community 17 - "Email Parsing Core"
Cohesion: 0.21
Nodes (18): applyBrandMap(), brandFromDomain(), decryptToken(), deduplicateWithin24h(), encryptToken(), estimateRenewalDate(), extractSenderDomain(), fetchJson() (+10 more)

### Community 18 - "CSV Import & Calendar"
Cohesion: 0.18
Nodes (10): computeNextRenewal(), projectRenewals(), addDays(), addMonths(), addYears(), extractTxn(), matchSubscriptionByMerchant(), normalizeCadence() (+2 more)

### Community 19 - "Backend Auth & Routes"
Cohesion: 0.16
Nodes (11): deleteAccount(), saveOAuthTokens(), requireUser(), verifyToken(), registerAccountRoutes(), registerImapScanRoutes(), registerOAuthRoutes(), callOpenAI() (+3 more)

### Community 20 - "Bill Splitting & Cancel"
Cohesion: 0.21
Nodes (9): Settle(), CancelPlaybookCard(), ChecklistCard(), arcPath(), DonutChart(), PrettyDonut(), SearchSheet(), SparkLine() (+1 more)

### Community 21 - "Onboarding Flow"
Cohesion: 0.46
Nodes (5): HeaderRow(), MattePanel(), Pill(), Screen(), setOnboardingDone()

### Community 22 - "Email Import API Client"
Cohesion: 0.23
Nodes (9): getAccessToken(), getSubscriptions(), request(), runGmailScan(), runImapScan(), verifyImapCredentials(), cleanMerchantName(), normaliseSub() (+1 more)

### Community 23 - "Export & Import UI"
Cohesion: 0.14
Nodes (6): ExportScreen(), Cards(), ImportMail(), SetupChecklistCard(), CardBase(), Tile()

### Community 24 - "Backend Scan & DB"
Cohesion: 0.24
Nodes (10): batchUpsertSubscriptions(), createScanSession(), getNewScanEvents(), getScanSession(), getSubscriptions(), markStaleSubscriptions(), saveFeedback(), saveScanMetadata() (+2 more)

### Community 25 - "Scan Queue System"
Cohesion: 0.25
Nodes (11): updateScanSession(), writeScanEvent(), cacheKey(), filterUnprocessedIds(), getRedis(), markProcessedIds(), addScanJob(), getQueue() (+3 more)

### Community 26 - "Subscription Detection Engine"
Cohesion: 0.31
Nodes (13): applyBrandMap(), brandFromDomain(), deduplicateWithin24h(), detectRecurringSubscriptions(), estimateRenewalDate(), extractSenderDomain(), llmClassifyIfNeeded(), normalizeMerchant() (+5 more)

### Community 27 - "Error Handling & Diagnostics"
Cohesion: 0.23
Nodes (9): Diagnostics(), GlobalError(), bootstrapAuth(), fetchCurrency(), safeUpsertProfile(), clearErrorLogs(), getErrorLogs(), logError() (+1 more)

### Community 28 - "Backend Infrastructure"
Cohesion: 0.26
Nodes (13): backend/src/routes/accountRoutes.js, BullMQ Async Scan Queue, Fastify HTTP Framework (Backend), backend/src/routes/imapScanRoutes.js, imapflow IMAP Client Library, backend/src/routes/oauthRoutes.js, pg PostgreSQL Pool, Backend README (+5 more)

### Community 29 - "Android Launcher Icons"
Cohesion: 0.17
Nodes (12): Android Adaptive Icon (ic_launcher), Android Adaptive Icon Foreground Layer (ic_launcher_foreground), ic_launcher hdpi (72x72), ic_launcher_foreground hdpi, ic_launcher mdpi (48x48), ic_launcher_foreground mdpi, ic_launcher xhdpi (96x96), ic_launcher_foreground xhdpi (+4 more)

### Community 30 - "Calendar View"
Cohesion: 0.27
Nodes (7): CalendarView(), daysInMonthUTC(), MonthBlock(), pad2(), prettyMonthTitle(), toISODate(), weekdayOfFirstUTC()

### Community 31 - "ML Model & Widget Bridge"
Cohesion: 0.29
Nodes (7): WidgetBridgeModule, Module, extractFeatures(), loadModel(), predictSubscription(), sigmoid(), updateWeights()

### Community 32 - "Cancel Center"
Cohesion: 0.22
Nodes (4): CancelCenter(), norm(), Step(), EmptyStateCard()

### Community 33 - "Notification Settings"
Cohesion: 0.31
Nodes (4): hhmm2date(), hhmm2friendly(), NotificationsScreen(), TimePickerRow()

### Community 34 - "Cash Flow Analysis"
Cohesion: 0.53
Nodes (8): addDays(), cashMonthByCategory(), cashMonthTotalFromRecurring(), endOfMonth(), inRange(), occurrencesInMonth(), startOfMonth(), toDate()

### Community 35 - "IMAP Backend"
Cohesion: 0.46
Nodes (6): getImapCredentials(), saveImapCredentials(), getImapConfig(), sanitizeImapError(), scanImapInbox(), verifyImapCredentials()

### Community 36 - "Email Parser"
Cohesion: 0.39
Nodes (5): fetchJson(), detectCadence(), extractText(), htmlToPlain(), parseGmailMessageBody()

### Community 38 - "In-App Ads"
Cohesion: 0.5
Nodes (6): markAdShown(), readState(), setAdsEnabled(), shouldShowAd(), trackLaunch(), writeState()

### Community 39 - "Streak Tracking"
Cohesion: 0.43
Nodes (6): StreakCard(), loadStreak(), nextMilestone(), tickStreak(), todayStr(), yesterdayStr()

### Community 40 - "iOS Widget Plugin"
Cohesion: 0.32
Nodes (3): ensureExtensionFiles(), getEntitlements(), getInfoPlist()

### Community 41 - "Recurring Status Tags"
Cohesion: 0.67
Nodes (6): getBadges(), getRecurringKind(), getRecurringState(), getRecurringTags(), isTrial(), matchesFilter()

### Community 42 - "Share Extension Plugin"
Cohesion: 0.38
Nodes (3): ensureExtensionFiles(), getEntitlements(), getInfoPlist()

### Community 43 - "Brand Assets"
Cohesion: 0.52
Nodes (7): BeforeItBills App Icon, BeforeItBills Brand Identity, Calendar + Bell Iconography, Brand Color Scheme (Blue-Green Gradient), Notification Icon (Transparent), Default Profile Avatar Placeholder, BeforeItBills Splash Screen

### Community 44 - "Android Density Variants"
Cohesion: 0.52
Nodes (7): HDPI Density Variant, MDPI Density Variant, XHDPI Density Variant, XXHDPI Density Variant, XXXHDPI Density Variant, Android Notification Icon, Android Splash Screen Logo

### Community 46 - "Global Search"
Cohesion: 0.47
Nodes (4): GlobalSearch(), pickDomain(), pickName(), SearchResult()

### Community 47 - "Gmail OAuth Client"
Cohesion: 0.53
Nodes (4): fetchReceipts(), guessCadence(), guessNext(), parseReceipts()

### Community 48 - "Instant Value Score"
Cohesion: 0.6
Nodes (5): computeInstantValue(), guessMonthlyRange(), normMerchant(), pickNextActionDate(), toMonthlyFromAmount()

### Community 49 - "Push Notification Scheduler"
Cohesion: 0.53
Nodes (4): ensureNotificationPermission(), scheduleCancelFollowup(), scheduleRenewalNotifications(), scheduleTrialNotifications()

### Community 51 - "Price Alert Logic"
Cohesion: 0.6
Nodes (4): computeAlerts(), dedupeAlerts(), indexTxBySub(), daysUntil()

### Community 52 - "Email Verify & Sub Form"
Cohesion: 0.5
Nodes (3): ConnectEmailVerify(), inputStyle(), SubscriptionForm()

### Community 53 - "Monthly Recap Prompt"
Cohesion: 0.7
Nodes (4): lastDayOfMonth(), markRecapPrompted(), monthKey(), shouldAutoOpenRecap()

### Community 54 - "Auth API & Merchant Confirm"
Cohesion: 0.5
Nodes (3): apiPost(), getAccessToken(), confirmMerchant()

### Community 58 - "Conflict Resolution UI"
Cohesion: 0.67
Nodes (3): ConflictResolutionSheet(), relativeTime(), SubSummary()

### Community 61 - "Email Candidate Card"
Cohesion: 0.83
Nodes (3): CandidateCard(), formatRelative(), normalizeMerchant()

### Community 64 - "Scan Progress Client"
Cohesion: 0.83
Nodes (3): getProgress(), pollScanProgress(), sleep()

## Ambiguous Edges - Review These
- `Notification Icon (Transparent)` → `Brand Color Scheme (Blue-Green Gradient)`  [AMBIGUOUS]
  assets/notification-icon.png · relation: conceptually_related_to

## Knowledge Gaps
- **68 isolated node(s):** `.maestro/run_tests.sh`, `Expo SDK 54`, `Sentry React Native Expo Plugin`, `expo-web-browser Plugin`, `expo-localization Plugin` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Notification Icon (Transparent)` and `Brand Color Scheme (Blue-Green Gradient)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `useTheme()` connect `Email Connect & Account Screens` to `Date Utils & Tab Navigation`, `Brand Resolution`, `Auth & Account Core`, `Dev Tools & Scan Onboarding`, `Settings UI Components`, `Account Info Screens`, `Subscription Optimizer`, `Add Subscription Flow`, `Paywall & Skeleton UI`, `Price Alert System`, `Insights Tab Charts`, `Bill Splitting & Cancel`, `Onboarding Flow`, `Export & Import UI`, `Error Handling & Diagnostics`, `Calendar View`, `Cancel Center`, `Notification Settings`, `Streak Tracking`, `Global Search`, `Recap Sheet UI`, `Email Verify & Sub Form`, `Auth Callback & Gate`, `Conflict Resolution UI`, `Base UI Atoms`, `Email Candidate Card`, `Recurring Detail View`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `CandidateCard()` connect `Email Candidate Card` to `Email Connect & Account Screens`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 134 inferred relationships involving `useTheme()` (e.g. with `AddRecurring()` and `BrandPage()`) actually correct?**
  _`useTheme()` has 134 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `formatMoney()` (e.g. with `CalendarView()` and `DeltaPill()`) actually correct?**
  _`formatMoney()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `A()` (e.g. with `Settle()` and `CancelPlaybookCard()`) actually correct?**
  _`A()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `.maestro/run_tests.sh`, `Expo SDK 54`, `Sentry React Native Expo Plugin` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._