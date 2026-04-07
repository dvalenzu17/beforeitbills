// lib/dateMath.js
// Date math utilities built for recurring payments.
// Pure functions: easy to test, no React / no storage.

export function toISODate(date) {
  if (!date) return null;
  if (typeof date === 'string') return date;
  if (!(date instanceof Date) || isNaN(date)) return null;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

// Returns ISO date (YYYY-MM-DD) for the next due date.
// Handles month overflow (e.g. Feb 31 -> Feb 28/29) and "already passed" logic.
export function computeBillNextDue(bill, now = new Date()) {
  const day = clamp(bill?.dueDay ?? 1, 1, 31);
  const y = now.getFullYear();
  const m = now.getMonth();

  const cand = new Date(y, m, day);

  // If day overflows (e.g., Feb 31), JS rolls into next month.
  // Pull back to last day of the intended month.
  if (cand.getMonth() !== m) {
    const last = new Date(y, m + 1, 0);
    return toISODate(last);
  }

  // Compare to today's date at midnight to avoid time-of-day flakiness.
  const today = new Date(y, m, now.getDate());
  if (cand < today) {
    const next = new Date(y, m + 1, day);
    // Overflow again? Pull back to last day of next month.
    if (next.getMonth() !== (m + 1) % 12) {
      const lastNext = new Date(y, m + 2, 0);
      return toISODate(lastNext);
    }
    return toISODate(next);
  }

  return toISODate(cand);
}

export function parseISODate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}
