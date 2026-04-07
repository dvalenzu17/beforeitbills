// lib/cashflow.js
// Cash-based month totals: count charges that occur inside the current calendar month.
// Yearly/quarterly only count if billed this month (no amortizing).

function toDate(d) {
    if (!d) return null;
    const s = String(d).slice(0, 10);
    const dt = new Date(`${s}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  
  function startOfMonth(ref = new Date()) {
    return new Date(ref.getFullYear(), ref.getMonth(), 1);
  }
  
  function endOfMonth(ref = new Date()) {
    // last day 23:59:59.999
    return new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  
  function inRange(d, a, b) {
    return d && d >= a && d <= b;
  }
  
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  
  function occurrencesInMonth({ nextDate, cadence, monthRef }) {
    const start = startOfMonth(monthRef);
    const end = endOfMonth(monthRef);
    const first = toDate(nextDate);
    if (!first) return 0;
  
    const c = String(cadence || "monthly").toLowerCase();
  
    // yearly / quarterly / monthly: single charge if the next billing date sits in this month
    if (c === "yearly" || c === "annual" || c === "quarterly" || c === "monthly") {
      return inRange(first, start, end) ? 1 : 0;
    }
  
    // weekly: count every 7 days starting at nextDate within the same month
    if (c === "weekly") {
      if (first > end) return 0;
  
      let count = 0;
      let cur = first;
      while (cur <= end) {
        if (cur >= start) count += 1;
        cur = addDays(cur, 7);
        // safety
        if (count > 10_000) break;
      }
      return count;
    }
  
    // default fallback: treat as monthly
    return inRange(first, start, end) ? 1 : 0;
  }
  
  /**
   * Use this for Home where you already have normalized recurring items:
   * { effectiveAmount, nextDate, cadence }
   */
  export function cashMonthTotalFromRecurring(recurring = [], monthRef = new Date()) {
    let sum = 0;
  
    for (const x of recurring || []) {
      const amt = Number(x.effectiveAmount) || 0;
      if (!amt) continue;
  
      const occ = occurrencesInMonth({
        nextDate: x.nextDate,
        cadence: x.cadence,
        monthRef,
      });
  
      sum += amt * occ;
    }
  
    return sum;
  }
  
  /**
   * Use this for Insights if you want per-category from raw subs/bills.
   * Expects:
   * subs: { amount, cadence, nextRenewal, category, shared, sharedCount }
   * bills:{ amount, nextDue, category, shared, sharedCount }
   */
  export function cashMonthByCategory({ subs = [], bills = [], monthRef = new Date(), shareDivisor }) {
    const m = {};
    const start = startOfMonth(monthRef);
    const end = endOfMonth(monthRef);
  
    function bump(label, value) {
      const key = label || "Other";
      m[key] = m[key] || { label: key, value: 0 };
      m[key].value += value;
    }
  
    for (const s of subs || []) {
      const next = toDate(s.nextRenewal);
      if (!next) continue;
  
      const divisor = shareDivisor ? shareDivisor(s) : 1;
      const amt = (Number(s.amount) || 0) / divisor;
      if (!amt) continue;
  
      const occ = occurrencesInMonth({
        nextDate: s.nextRenewal,
        cadence: s.cadence,
        monthRef,
      });
  
      if (occ > 0) bump(s.category || "Subscriptions", amt * occ);
    }
  
    for (const b of bills || []) {
      const next = toDate(b.nextDue);
      if (!next) continue;
  
      // bills are treated as "one charge on nextDue"
      if (!inRange(next, start, end)) continue;
  
      const divisor = shareDivisor ? shareDivisor(b) : 1;
      const amt = (Number(b.amount) || 0) / divisor;
      if (!amt) continue;
  
      bump(b.category || "Bills", amt);
    }
  
    return Object.values(m).sort((a, b) => b.value - a.value);
  }
  