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

  const monthlyTotal = computeMonthlyTotal(active);
  const urgentCount = sorted.filter((s) => daysUntil(s.nextRenewal) <= 7).length;

  const upcoming = sorted.slice(0, 8).map((s) => {
    const name = String(s.merchant ?? s.name ?? '');
    const amount = Number(s.amount) || 0;
    const days = daysUntil(s.nextRenewal);
    return {
      id: String(s.id ?? ''),
      name,
      amount,
      amountFormatted: formatAmount(amount, currency),
      daysUntil: days,
      nextDate: formatNextDate(s.nextRenewal),
      color: getBrandColor(name),
    };
  });

  return {
    upcoming,
    monthlyTotal,
    monthlyTotalFormatted: formatAmount(monthlyTotal, currency),
    yearlyTotal: monthlyTotal * 12,
    urgentCount,
    activeCount: active.length,
    // Placeholder chart: zeros for past 5 months, current for this month.
    // Replace with real history when available.
    chartMonths: [0, 0, 0, 0, 0, monthlyTotal],
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

function formatNextDate(dateStr) {
  const d = toDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// ── Brand colors ──────────────────────────────────────────────────────────
// Known brand color overrides keyed by normalized name (lowercase, no spaces/punct).
// Falls back to a deterministic palette color derived from the name.

const BRAND_COLORS = {
  netflix:        '#E50914',
  spotify:        '#1DB954',
  icloud:         '#0071E3',
  applemusic:     '#FC3C44',
  appletv:        '#555555',
  notion:         '#444444',
  '1password':    '#1A8FE3',
  figma:          '#A259FF',
  adobe:          '#FF0000',
  adobecc:        '#FF0000',
  github:         '#24292E',
  dropbox:        '#0061FF',
  slack:          '#4A154B',
  zoom:           '#2D8CFF',
  youtube:        '#FF0000',
  youtubepremium: '#FF0000',
  disney:         '#113CCF',
  disneyplus:     '#113CCF',
  hulu:           '#1CE783',
  amazonprime:    '#FF9900',
  max:            '#002BE7',
  hbo:            '#002BE7',
  paramount:      '#0064FF',
  peacock:        '#000000',
  twitch:         '#9146FF',
  duolingo:       '#58CC02',
  headspace:      '#F47D31',
  calm:           '#3F5EFB',
  chatgpt:        '#10A37F',
  openai:         '#10A37F',
  cursor:         '#A855F7',
  linear:         '#5E6AD2',
  notion:         '#333333',
  todoist:        '#DB4035',
  evernote:       '#14CC45',
  bear:           '#F7A400',
  microsoft365:   '#D83B01',
  office365:      '#D83B01',
  onedrive:       '#0078D4',
  googledrive:    '#4285F4',
  googleone:      '#4285F4',
  playstation:    '#003791',
  xbox:           '#107C10',
  nintendo:       '#E60012',
  steam:          '#1B2838',
  epicgames:      '#2D2D2D',
  nordvpn:        '#4687FF',
  expressvpn:     '#DA3940',
  dashlane:       '#004B50',
  lastpass:       '#CC2028',
  malwarebytes:   '#00A3E0',
};

const FALLBACK_PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F59E0B', '#10B981', '#3B82F6', '#14B8A6',
];

function normalizeBrandKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9+]/g, '');
}

function getBrandColor(name) {
  const key = normalizeBrandKey(name);
  if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  // Partial match
  for (const [brand, color] of Object.entries(BRAND_COLORS)) {
    if (key.length >= 3 && key.includes(brand)) return color;
    if (brand.length >= 3 && brand.includes(key)) return color;
  }
  // Deterministic fallback from name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}
