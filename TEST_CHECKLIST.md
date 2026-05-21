

### Main Tabs

#### Home (`(tabs)/index.js`)
- [x] Greeting shows correct time-of-day ("Good morning/afternoon/evening, Name")
- [X] Monthly digest card shows total spend and upcoming amount
- [X] Savings tracker banner visible when there are cancellable subs; X button dismisses it
- [X] Upcoming renewals section shows items sorted by date; urgent badge (≤7 days) present
- [X] Upcoming empty state: "Scan inbox" button → navigates to `/account/connect-email`
- [X] "Add manually" in empty state → navigates to add flow
- [X] Optimize button in digest → navigates to `/optimize`
- [X] View all button → navigates to `/subs` or `/bills`
- [X] Pull-to-refresh syncs data without crash
- [X] Share button (icon only) → native share sheet opens with "BeforeItBills ·" prefix

#### Insights (`(tabs)/insights.js`)
- [X] Monthly spend bar chart renders with correct values
- [X] Category breakdown renders (donut or bar)
- [X] Month/period selector navigates backward and forward
- [x] Tapping a chart segment or category shows breakdown detail
- [x] Yearly projection figure present and non-zero when subs exist
- [x] Empty account: no crash, meaningful empty state shown
- [X] Numbers match what's shown on home screen (same data source)

#### Recap (`(tabs)/recap.js`)
- [ ] Recap card shows current month name and spend summary
- [ ] Recommendations section shows suggestions (or "no data yet" state)
- [ ] Tapping a recommendation opens correct action (cancel-center or downgrade)
- [ ] Share/export recap works
- [ ] Empty account: empty state shown, not a blank screen

#### Account (`(tabs)/account.js`)
- [X] Profile photo, display name, email all shown correctly
- [X] All menu rows visible and tappable (no invisible rows off-screen)
- [X] Plan badge shows "Free" or "Pro" correctly
- [X] Sign out button visible and functional (prompts confirmation, clears session, returns to sign-in)

---

### Account Sub-screens

#### Personal (`account/personal.js`)
- [X] Name field pre-filled with current display name
- [X] Edit name → save → name updates on account tab immediately
- [X] Profile photo: tap → action sheet with Camera / Library / Remove options
- [X] Camera pick: photo taken → preview shown → save persists after app restart
- [X] Library pick: photo chosen → preview shown → save persists after app restart
- [X] Remove photo → reverts to initials avatar
- [X] Avatar persists after force-quit and reopen

#### Security (`account/security.js`)
- [X] Screen loads without error
- [X] Change password (if email/password auth): old password required, new password validated
- [X] Delete account section visible; tapping Delete shows multi-step confirmation
- [X] Delete account: all data removed, auth user deleted, redirected to sign-in

#### Notifications (`account/notifications.js`)
- [X] Renewal reminder toggle: enabling requests OS notification permission if not granted
- [X] Permission denied in OS → toggle reflects denied state, explanation shown with link to Settings
- [X] Days-before picker changes notification lead time; value persists
- [X] Toggling off: future notifications cancelled (verify via Settings > Notifications)

#### Connected Accounts (`account/connected.js`)
- [ ] Lists all connected email accounts (Gmail or IMAP)
- [ ] Each account shows provider icon, address, last scan date
- [ ] "Scan now" re-triggers scan for that account
- [ ] Disconnect: confirmation prompt → account removed from list
- [ ] No connected accounts: empty state with "Connect email" button

#### Settings (`account/settings.js`)
- [ ] Language picker shows current language; changing it updates all visible strings
- [ ] Theme toggle (if present) switches light/dark
- [ ] All settings rows navigate to correct sub-screens

#### Connect Email — Index (`account/connect-email/index.js`)
- [ ] Gmail option visible; tapping initiates OAuth flow
- [ ] IMAP option visible; tapping opens IMAP form
- [ ] Already-connected state: shows current connection, not another connect form

#### Connect Email — Edit (`account/connect-email/edit.js`)
- [ ] Pre-fills existing IMAP credentials (host, port, username — not password)
- [ ] Editing and saving updates the stored credentials
- [ ] Cancel discards changes

#### Connect Email — Verify (`account/connect-email/verify.js`)
- [ ] Test connection button triggers verification request
- [ ] Success: green indicator and proceed button shown
- [ ] Wrong password: clear error message, not raw IMAP error
- [ ] Wrong host/port: clear error message

#### Connect Email — Activity (`account/connect-email/activity.js`)
- [ ] Lists past scans with date, email count, subscriptions found
- [ ] Empty state if no scans yet
- [ ] Rows are scrollable; no layout overflow with long email addresses

#### Connect Email — Review (`account/connect-email/review.js`)
- [ ] Lists subscriptions detected in last scan for review
- [ ] Accept / Dismiss actions work and remove row from list
- [ ] "Accept all" or "Dismiss all" (if present) functions correctly
- [ ] Empty state when all items reviewed

#### Connect Email — Connected (`account/connect-email/connected.js`)
- [ ] Success state shows connected email address
- [ ] "Scan now" or "Done" button navigates correctly

#### Upgrade (`account/upgrade.js`)
- [ ] Paywall renders with plan options and pricing
- [ ] Toggle between annual and monthly updates displayed price
- [ ] Subscribe button → IAP sheet appears (physical device required)
- [ ] Pro user: shows "already subscribed" state, not active subscribe button
- [ ] Close/dismiss navigates back without crash

#### Biometric Lock (`account/biometric-lock.js`)
- [ ] Toggle FaceID/TouchID: system permission prompt shown
- [ ] Enable: backgrounding app and returning requires biometric unlock
- [ ] Disable: app resumes without lock prompt
- [ ] Device without Face ID: toggle hidden or shows graceful "not available" message

#### Export (`account/export.js`)
- [ ] Tap Export → CSV/JSON generated
- [ ] Share sheet opens with file attachment
- [ ] Empty account: export produces file with headers only, no crash
- [ ] File contains all subs and bills (spot-check a known item)

#### Help (`account/help.js`)
- [ ] FAQ or help content renders
- [ ] Links/buttons navigate to correct destinations (external browser or in-app)
- [ ] No broken layout with long text content

#### About (`account/about.js`)
- [ ] App version displayed
- [ ] Build number visible
- [ ] Website / social links open in browser

#### Legals (`account/legals.js`)
- [ ] Privacy Policy text renders (or opens external URL)
- [ ] Terms of Service text renders (or opens external URL)
- [ ] No raw HTML tags visible in text

#### What's New (`account/whats-new.js`)
- [ ] Release notes render in order (newest first)
- [ ] Scrollable list with no overflow
- [ ] Close/back navigation works

#### Diagnostics (`account/diagnostics.js`)
- [ ] Session info shown (user ID, plan, connected accounts)
- [ ] "Copy to clipboard" button works
- [ ] Device/OS info displayed
- [ ] No credentials (tokens, passwords) shown in plain text

#### Dev Tools (`dev-tools/index.js`) **[DEV ONLY]**
- [ ] State inspector shows live SUBS / BILLS / AUTH / PLAN counts
- [ ] Preset: New User → clears all state, opens onboarding
- [ ] Preset: Empty Account → clears subs/bills, opens home with empty state
- [ ] Preset: Full Account → seeds realistic data, opens home with populated state
- [ ] Preset: Heavy Account → seeds 20+ subs and 8 bills
- [ ] Jump to Screen: all listed routes navigate without crash
- [ ] Sign Out in Danger Zone clears session and returns to sign-in

---

### Subscription & Bill Detail

#### Subscription Detail (`sub/[id].js`)
- [ ] All fields shown: merchant, amount, cadence, next renewal, status
- [ ] Brand logo loads; falls back to initials avatar if unavailable
- [ ] Status change (Confirmed / Cancelled / Ignored) persists after navigating away and returning
- [ ] Edit button → opens edit form with pre-filled values
- [ ] Delete: confirmation prompt → item removed from list
- [ ] Website link opens in browser
- [ ] Shared subscription: share count and per-person amount shown correctly
- [ ] Cancel Center button → navigates to `/cancel-center` with correct params

#### Bill Detail (`bill/[id].js`)
- [ ] All fields shown: merchant, amount, due date, status
- [ ] Edit → saves and reflects on return
- [ ] Delete with confirmation
- [ ] Mark as paid (if available) → status updates

#### Recurring Charge Detail (`recurring/[kind]/[id].js`)
- [ ] Correct kind label shown (subscription vs bill vs other)
- [ ] All amounts and dates accurate
- [ ] Edit and delete work
- [ ] Navigation back returns to correct list

---

### Add Flows

#### Add Entry Point (`add.js`)
- [ ] Shows options: Subscription, Bill, Recurring expense (check what's actually rendered)
- [ ] Each option navigates to correct add form
- [ ] Close/back without adding → no phantom items in list

#### Add Recurring (`add-recurring.js`)
- [ ] Quick-add field: entering a merchant name and tapping parse → fills form fields
- [ ] Parse failure → shows "Couldn't parse — fill in the fields below manually" (not a raw error)
- [ ] Manual form: all fields editable (name, amount, cadence, currency, next renewal)
- [ ] Cadence wheel picker: all options selectable (monthly, yearly, weekly, quarterly)
- [ ] Currency wheel picker: scrolls, selects, value persists when form saved
- [ ] Date picker (iOS): spinning wheel does not close on each scroll tick; Done button confirms
- [ ] Shared toggle: enabling shows "shared with N people" sub-field
- [ ] Save → item appears in recurring list immediately
- [ ] Required field missing → save blocked with validation message

#### Add Bill (`add-bill.js`)
- [ ] All fields present (name, amount, due date, category)
- [ ] Save → item appears in bills list
- [ ] Cancel → no item added
- [ ] Date picker: same Done-button behavior as above

#### Manual Add (`manual-add.js`)
- [ ] Free-form entry works for subscriptions not auto-detected
- [ ] Amount, currency, and cadence all save correctly
- [ ] Back without saving → no item added

---

### Other Screens

#### Search (`search.js`)
- [ ] Type a merchant name → results filter in real time
- [ ] Tap a result → navigates to correct detail screen
- [ ] Clear search → full list restored
- [ ] Search with no results → "no results" empty state, not blank screen
- [ ] Search across both subs and bills (if combined)

#### Subscriptions List (`subs.js`)
- [ ] All subscriptions listed; total shown in header
- [ ] Sort order matches selected sort (default: next renewal)
- [ ] Swipe-to-delete (if implemented) shows confirmation
- [ ] Pull-to-refresh works
- [ ] Empty state shown when no subs

#### Bills List (`bills.js`)
- [ ] All bills listed with amounts and due dates
- [ ] Overdue items visually differentiated (red/badge)
- [ ] Pull-to-refresh works
- [ ] Empty state shown when no bills

#### Recurring List (`recurring.js`)
- [ ] Filter button shows "Filter · N" when filters active
- [ ] Filter panel opens: Type / Status / Sort by / Confidence sections all visible
- [ ] Checkboxes: selecting/deselecting updates the list immediately
- [ ] "Clear (N)" button resets all filters
- [ ] Sort by changes list order
- [ ] Confidence filter: low/med/high filters by ML confidence score
- [ ] Empty filtered result: empty state, not blank screen

#### Brand (`brand.js`)
- [ ] Brand logo, name, and description loaded for known merchants
- [ ] Unknown merchant: fallback initials shown, no crash
- [ ] Cancel / Cancel Center button visible
- [ ] External links (website, support page) open in browser

#### Calendar (`calendar.js`)
- [ ] Month view renders with renewal dots on correct dates
- [ ] Tapping a date shows subscriptions/bills due that day
- [ ] Navigate previous/next month: dots update correctly
- [ ] Today highlighted
- [ ] Empty month: no crash

#### Price Alerts (`price-alerts.js`)
- [ ] Existing alerts listed with merchant and threshold
- [ ] Add alert: merchant selection, price threshold, save
- [ ] Delete alert: removed from list with confirmation
- [ ] Empty state shown when no alerts

#### Cancel Center (`cancel-center.js`)
- [ ] Correct merchant name and price shown (passed via params)
- [ ] Cancellation steps or instructions rendered
- [ ] "Go to website" or external cancel link opens browser
- [ ] Confirm cancelled button → navigates back or updates status

#### Optimize (`optimize.js`)
- [ ] Duplicates section: only shows when 2+ subs in same category (cloud storage, music, etc.)
- [ ] Smart recommendations: empty state says "Complete a monthly recap" when no recap data
- [ ] Annual switch: shows monthly subs with note about potential ~15–20% savings (no fabricated amounts)
- [ ] "Check annual pricing" → navigates to brand screen for that merchant
- [ ] "Pick one to cancel" → navigates to cancel-center
- [ ] Back button navigates correctly

#### Cards (`cards.js`)
- [ ] Lists payment cards/methods linked to subscriptions
- [ ] Tapping a card shows subscriptions charged to it
- [ ] Empty state if no cards detected

#### Import from Mail (`import-mail.js`)
- [ ] Scan/import trigger works and shows progress
- [ ] Detected items listed for review
- [ ] Accept / dismiss per item
- [ ] Error if no email connected: clear message with link to connect email

#### Import CSV (`import-csv.js`)
- [ ] File picker opens for CSV selection
- [ ] Valid CSV: items previewed before import
- [ ] Invalid CSV (wrong format): clear error, not crash
- [ ] Import confirms row count on success

#### Progressive Scan (`progressive-scan.js`)
- [ ] Scan progress shown (count / percentage or animated indicator)
- [ ] Items appear incrementally as scan runs
- [ ] Cancel scan button works
- [ ] Completion: summary shown and navigate-back available

#### Settle (`settle.js`)
- [ ] Shows shared charges owed between users
- [ ] Mark as settled → removes from list or changes status
- [ ] Amounts split correctly for multi-person shares
- [ ] Empty state when nothing to settle

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
