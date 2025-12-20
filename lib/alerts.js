// lib/alerts.js
// Derive alerts from subscriptions + transactions: renewals, trial end, price hike

import { daysUntil } from "./utils";

const RENEWAL_WINDOWS = [14, 7, 3, 1];   // days before renewal to alert
const TRIAL_WINDOWS   = [7, 3, 1];

export function computeAlerts(subs = [], transactions = []) {
  const txBySub = indexTxBySub(transactions);
  const out = [];

  subs.forEach(sub => {
    if (!sub) return;
    const id = sub.id || sub._id || sub.name;
    const next = sub.nextRenewalDate ? new Date(sub.nextRenewalDate) : null;
    const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : null;

    // 1) Upcoming renewals
    if (next instanceof Date && !isNaN(next)) {
      const d = daysUntil(next);
      if (RENEWAL_WINDOWS.includes(d)) {
        out.push({
          id: `ren-${id}-${d}`,
          type: "renewal",
          scheduledFor: new Date(),
          message: `${sub.name} renews in ${d} day${d === 1 ? "" : "s"} on ${next.toDateString()}.`,
          subId: id,
          channel: "push",
          meta: { days: d, next }
        });
      }
    }

    // 2) Trial endings
    if (trialEnd instanceof Date && !isNaN(trialEnd)) {
      const d = daysUntil(trialEnd);
      if (TRIAL_WINDOWS.includes(d)) {
        out.push({
          id: `trial-${id}-${d}`,
          type: "trial_end",
          scheduledFor: new Date(),
          message: `${sub.name} free trial ends in ${d} day${d === 1 ? "" : "s"} on ${trialEnd.toDateString()}.`,
          subId: id,
          channel: "push",
          meta: { days: d, trialEnd }
        });
      }
    }

    // 3) Price hike heuristic
    const tx = txBySub[id] || [];
    if (tx.length >= 3) {
      const sorted = [...tx].sort((a, b) => new Date(a.date) - new Date(b.date));
      const recent = sorted.slice(-1)[0];
      const prev = sorted.slice(0, -1);
      const avgPrev = Math.round(prev.reduce((s, t) => s + Math.abs(t.amount_cents || 0), 0) / prev.length);
      const latest = Math.abs(recent.amount_cents || 0);
      if (avgPrev > 0 && latest >= Math.round(avgPrev * 1.12)) { // >=12% jump
        out.push({
          id: `price-${id}-${recent.date}`,
          type: "price_hike",
          scheduledFor: new Date(),
          message: `${sub.name} looks more expensive this cycle (${latest/100} vs ~${(avgPrev/100).toFixed(2)}).`,
          subId: id,
          channel: "push",
          meta: { latest, avgPrev }
        });
      }
    }
  });

  return dedupeAlerts(out);
}

function indexTxBySub(transactions) {
  const map = {};
  transactions.forEach(t => {
    const key = t.subscription_id || t.subscriptionId || t.subId || null;
    if (!key) return;
    (map[key] ||= []).push(t);
  });
  return map;
}

function dedupeAlerts(list) {
  const seen = new Set();
  const out = [];
  for (const a of list) {
    const k = `${a.type}|${a.subId}|${a.meta?.days ?? ""}|${a.meta?.latest ?? ""}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}
