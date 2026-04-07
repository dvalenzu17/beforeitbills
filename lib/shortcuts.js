// lib/shortcuts.js
//
// Cross-platform home-screen quick actions + voice assistant shortcuts.
//
// iOS  → UIApplicationShortcutItem  (3D-Touch / haptic-press on app icon)
// Android → App Shortcuts           (long-press app icon)
//
// Voice:
//   iOS     → user adds any shortcut to Siri via Settings > Siri & Search
//   Android → Google Assistant surfaces App Shortcuts automatically
//
// Requires: expo-quick-actions (install separately — see README)
// Falls back gracefully if the package is not yet installed.

import { Platform } from 'react-native';

// Dynamic import so the JS bundle doesn't crash before `npm install`
let QuickActions = null;
try {
  QuickActions = require('expo-quick-actions').default ?? require('expo-quick-actions');
} catch {
  // package not installed — all exports silently no-op
}

// ── Shortcut IDs ──────────────────────────────────────────────────────────────
export const SHORTCUT_IDS = {
  ADD_SUBSCRIPTION: 'bib_add_subscription',
  VIEW_SPENDING:    'bib_view_spending',
  SCAN_INBOX:       'bib_scan_inbox',
};

// Maps shortcut ID → expo-router pathname to push
export const SHORTCUT_ROUTES = {
  [SHORTCUT_IDS.ADD_SUBSCRIPTION]: '/add-recurring',
  [SHORTCUT_IDS.VIEW_SPENDING]:    '/(tabs)/insights',
  [SHORTCUT_IDS.SCAN_INBOX]:       '/progressive-scan',
};

// ── Item definitions ──────────────────────────────────────────────────────────
//
// iOS icon names: UIApplicationShortcutIconType strings
//   Valid values: compose, play, pause, add, location, search, share,
//   prohibit, contact, home, markLocation, favorite, love, cloud,
//   invitation, confirmation, mail, message, date, time, capturePhoto,
//   captureVideo, task, taskCompleted, alarm, bookmark, shuffle, audio, update
//
// Android: icon is a drawable resource name (added by the config plugin).
//   Falls back to a default system icon if not found.

function makeItems(tt) {
  return [
    {
      id:       SHORTCUT_IDS.ADD_SUBSCRIPTION,
      title:    tt ? tt('shortcuts.addTitle')    : 'Add Subscription',
      subtitle: tt ? tt('shortcuts.addSub')      : 'Track a new recurring charge',
      icon:     Platform.OS === 'ios' ? 'add' : 'ic_shortcut_add',
      params:   { route: SHORTCUT_ROUTES[SHORTCUT_IDS.ADD_SUBSCRIPTION] },
    },
    {
      id:       SHORTCUT_IDS.VIEW_SPENDING,
      title:    tt ? tt('shortcuts.spendingTitle') : 'View Spending',
      subtitle: tt ? tt('shortcuts.spendingSub')   : 'See your monthly burn rate',
      icon:     Platform.OS === 'ios' ? 'compose' : 'ic_shortcut_spending',
      params:   { route: SHORTCUT_ROUTES[SHORTCUT_IDS.VIEW_SPENDING] },
    },
    {
      id:       SHORTCUT_IDS.SCAN_INBOX,
      title:    tt ? tt('shortcuts.scanTitle') : 'Scan Inbox',
      subtitle: tt ? tt('shortcuts.scanSub')   : 'Find subscriptions in your email',
      icon:     Platform.OS === 'ios' ? 'search' : 'ic_shortcut_scan',
      params:   { route: SHORTCUT_ROUTES[SHORTCUT_IDS.SCAN_INBOX] },
    },
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register home-screen quick actions with the OS.
 * Call once after the user is authenticated (or immediately for unauthenticated flows).
 *
 * @param {function} tt — i18next t() function for localised labels (optional)
 */
export function setupShortcuts(tt) {
  if (!QuickActions?.setItems) return;
  try {
    QuickActions.setItems(makeItems(tt));
  } catch (e) {
    if (__DEV__) console.warn('[shortcuts] setItems failed:', e?.message);
  }
}

/**
 * Subscribe to quick-action launches.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 *
 * @param {object} router — expo-router router object
 */
export function addShortcutListener(router) {
  if (!QuickActions?.addListener) return () => {};
  try {
    const sub = QuickActions.addListener((action) => {
      const route = action?.params?.route ?? SHORTCUT_ROUTES[action?.id];
      if (!route) return;
      // Small delay ensures navigation stack is ready before pushing
      setTimeout(() => {
        try { router.push(route); } catch (e) {
          if (__DEV__) console.warn('[shortcuts] navigation failed:', e?.message);
        }
      }, 100);
    });
    return () => sub?.remove?.();
  } catch (e) {
    if (__DEV__) console.warn('[shortcuts] addListener failed:', e?.message);
    return () => {};
  }
}

/**
 * Handle an action that fired while the app was cold-launched.
 * expo-quick-actions surfaces this via QuickActions.initial.
 *
 * @param {object} router
 */
export function handleInitialShortcut(router) {
  if (!QuickActions?.initial) return;
  try {
    const action = QuickActions.initial;
    if (!action) return;
    const route = action?.params?.route ?? SHORTCUT_ROUTES[action?.id];
    if (route) {
      setTimeout(() => {
        try { router.push(route); } catch (e) {
          if (__DEV__) console.warn('[shortcuts] initial navigation failed:', e?.message);
        }
      }, 300);
    }
  } catch (e) {
    if (__DEV__) console.warn('[shortcuts] handleInitial failed:', e?.message);
  }
}

/** True if expo-quick-actions is installed and functional. */
export const shortcutsAvailable = !!QuickActions?.setItems;
