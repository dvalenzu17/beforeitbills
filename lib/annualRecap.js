// lib/annualRecap.js
//
// Year-in-subscriptions ("Wrapped") data layer. Pure functions only — no UI.
// The December launch UI just renders computeAnnualRecap(...) / getAnnualRecap().
//
// Everything is derived from data the app already has on-device:
//   - subs   (merchant, amount, currency, cadence, category, createdAt, active)
//   - savings ({ totalSaved, entries: [{ name, monthlyAmount, savedAt, ... }] })

import { useStore } from "./store";

// Monthly-equivalent amount for any cadence (mirrors store.monthlyFactor).
function toMonthly(amount, cadence) {
  const n = Number(amount) || 0;
  const c = String(cadence || "monthly").toLowerCase();
  if (c.includes("year") || c.includes("annual")) return n / 12;
  if (c.includes("quarter")) return n / 3;
  if (c.includes("biweek") || c.includes("bi-week") || c.includes("fortnight")) return n * 2.1725;
  if (c.includes("week")) return n * 4.345;
  return n;
}

function yearOf(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.getUTCFullYear();
}

function isActive(s) {
  if (!s) return false;
  if (s.active === false) return false;
  if (String(s.status || "").toLowerCase().includes("cancel")) return false;
  return true;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Compute the year-in-subscriptions recap.
 *
 * @param {{ subs?: array, savings?: object, year?: number }} input
 * @returns {{
 *   year, currency,
 *   monthlyTotal, annualTotal, activeCount,
 *   biggest: { merchant, monthly, yearly } | null,
 *   byCategory: Array<{ category, monthly, yearly, count }>,
 *   topCategory: string | null,
 *   newThisYear: { count, merchants: string[] },
 *   oldest: { merchant, since, months } | null,
 *   cancellations: { count, monthlySaved, annualizedSaved },
 *   headline: string
 * }}
 */
export function computeAnnualRecap({ subs = [], savings = {}, year } = {}) {
  const Y = Number.isFinite(year) ? year : new Date().getUTCFullYear();

  const active = (subs || []).filter(isActive).filter((s) => !!s?.merchant);

  // Dominant currency among active subs (fallback USD).
  const curCounts = {};
  for (const s of active) {
    const c = (s.currency || "USD").toUpperCase();
    curCounts[c] = (curCounts[c] || 0) + 1;
  }
  const currency =
    Object.entries(curCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";

  // Totals.
  const monthlyTotal = round2(
    active.reduce((sum, s) => sum + toMonthly(s.amount, s.cadence), 0)
  );
  const annualTotal = round2(monthlyTotal * 12);

  // Biggest line (monthly-equivalent).
  let biggest = null;
  for (const s of active) {
    const m = toMonthly(s.amount, s.cadence);
    if (!biggest || m > biggest.monthly) {
      biggest = { merchant: s.merchant, monthly: round2(m), yearly: round2(m * 12) };
    }
  }

  // Category breakdown.
  const catMap = new Map();
  for (const s of active) {
    const key = s.category || "Other";
    const m = toMonthly(s.amount, s.cadence);
    const prev = catMap.get(key) || { category: key, monthly: 0, count: 0 };
    prev.monthly += m;
    prev.count += 1;
    catMap.set(key, prev);
  }
  const byCategory = Array.from(catMap.values())
    .map((c) => ({ ...c, monthly: round2(c.monthly), yearly: round2(c.monthly * 12) }))
    .sort((a, b) => b.monthly - a.monthly);
  const topCategory = byCategory[0]?.category || null;

  // Added this year.
  const newMerchants = active
    .filter((s) => yearOf(s.createdAt) === Y)
    .map((s) => s.merchant);

  // Longest-held active subscription.
  let oldest = null;
  for (const s of active) {
    const created = s.createdAt ? new Date(s.createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    if (!oldest || created < oldest._date) {
      const months = Math.max(
        0,
        Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      );
      oldest = { merchant: s.merchant, since: created.toISOString().slice(0, 10), months, _date: created };
    }
  }
  if (oldest) delete oldest._date;

  // Cancellations / savings booked this year.
  const entries = Array.isArray(savings?.entries) ? savings.entries : [];
  const cancelledThisYear = entries.filter((e) => yearOf(e.savedAt) === Y);
  const monthlySaved = round2(
    cancelledThisYear.reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)
  );

  const headline =
    active.length === 0
      ? `No active subscriptions tracked in ${Y} yet.`
      : `In ${Y} you spent about ${annualTotal} ${currency} across ${active.length} subscriptions.`;

  return {
    year: Y,
    currency,
    monthlyTotal,
    annualTotal,
    activeCount: active.length,
    biggest,
    byCategory,
    topCategory,
    newThisYear: { count: newMerchants.length, merchants: newMerchants },
    oldest,
    cancellations: {
      count: cancelledThisYear.length,
      monthlySaved,
      annualizedSaved: round2(monthlySaved * 12),
    },
    headline,
  };
}

/**
 * Convenience: compute the recap from current store state (safe outside React).
 * The December UI can call this directly.
 */
export function getAnnualRecap(year) {
  const st = useStore.getState?.() || {};
  return computeAnnualRecap({ subs: st.subs, savings: st.savings, year });
}
