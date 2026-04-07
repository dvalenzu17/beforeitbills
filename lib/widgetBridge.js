// lib/widgetBridge.js
//
// Formats subscription data and pushes it to the platform's widget store.
// Android → filesDir/widget_data.json (read by SubsWidgetProvider)
// iOS     → App Group UserDefaults     (read by SubsWidget WidgetKit extension)
//
// Call updateWidgetData(subs, currency) after every sync / mutation.

import { Platform } from 'react-native';

const TAG = '[widgetBridge]';

// Lazy-import the native module so the app doesn't crash if it isn't linked
function getNativeModule() {
  try {
    return require('../modules/widget-bridge/index');
  } catch {
    return null;
  }
}

/**
 * Push fresh subscription data to the widget.
 *
 * @param {Array}  subs      Full subs array from the Zustand store
 * @param {string} currency  User's display currency (e.g. "USD")
 */
export async function updateWidgetData(subs, currency = 'USD') {
  try {
    const payload = buildPayload(subs, currency);
    const json = JSON.stringify(payload);
    const mod = getNativeModule();
    if (!mod) return;

    await mod.updateWidgetData(json);

    // iOS: tell WidgetKit to reload timelines so the widget refreshes immediately
    if (Platform.OS === 'ios') {
      await mod.reloadWidgetTimelines().catch(() => {});
    }
  } catch (e) {
    if (__DEV__) console.warn(TAG, 'updateWidgetData error:', e?.message);
  }
}

// ── Payload builder ───────────────────────────────────────────────────────

function buildPayload(subs, currency) {
  const active = Array.isArray(subs)
    ? subs.filter((s) => s?.active !== false && !s?.isSuggested)
    : [];

  // Sort by next renewal date ascending
  const sorted = [...active].sort((a, b) => {
    const da = toDate(a.nextRenewal);
    const db = toDate(b.nextRenewal);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  const upcoming = sorted.slice(0, 5).map((s) => ({
    id: String(s.id ?? ''),
    name: String(s.merchant ?? s.name ?? ''),
    amount: formatAmount(s.amount, currency),
    daysUntil: daysUntil(s.nextRenewal),
  }));

  return {
    upcoming,
    monthlyTotal: formatAmount(computeMonthlyTotal(active), currency),
    currency,
    updatedAt: new Date().toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(dateStr) {
  const d = toDate(dateStr);
  if (!d) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((d - now) / 86_400_000));
}

function computeMonthlyTotal(subs) {
  return subs.reduce((sum, s) => {
    const amount = Number(s?.amount) || 0;
    const monthly = normalizeToMonthly(amount, s?.cadence);
    return sum + monthly;
  }, 0);
}

function normalizeToMonthly(amount, cadence) {
  switch (cadence) {
    case 'yearly':    return amount / 12;
    case 'quarterly': return amount / 3;
    case 'weekly':    return amount * 4.33;
    case 'daily':     return amount * 30;
    default:          return amount; // monthly
  }
}

function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}
