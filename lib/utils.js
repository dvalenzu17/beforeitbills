// lib/utils.js
// Utilities: money math, dates, cadence normalization, fuzzy match, CSV tiny parser
// Pure JavaScript (no TypeScript assertions)

export const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];

/** Normalize any cadence-like string to one of: weekly|biweekly|monthly|quarterly|yearly */
export function normalizeCadence(input) {
  if (!input) return "monthly";
  const v = String(input).toLowerCase().trim();
  // biweekly must be checked before weekly (and matches fortnightly variants)
  if (v.startsWith("biweek") || v.startsWith("bi-week") || v.startsWith("fortnight")) return "biweekly";
  if (v.startsWith("week")) return "weekly";
  if (v.startsWith("month")) return "monthly";
  if (v.startsWith("quarter")) return "quarterly";
  if (v.startsWith("year") || v.startsWith("annual")) return "yearly";
  // fallback
  return CADENCES.includes(v) ? v : "monthly";
}

/** Add days to a Date without time drift */
export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Add months to a Date safely (billing style) */
export function addMonths(date, months) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const targetMonth = d.getUTCMonth() + months;
  d.setUTCMonth(targetMonth);
  // handle 31→30/28 edge cases by rolling back if month overflowed
  while (d.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

/** Add years safely */
export function addYears(date, years) {
  const d = new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
  // Feb 29 edge-case: roll back to Feb 28
  if (d.getUTCMonth() !== new Date(date).getUTCMonth()) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

/** Step a date by cadence */
export function stepByCadence(date, cadence) {
  const c = normalizeCadence(cadence);
  if (c === "weekly") return addDays(date, 7);
  if (c === "biweekly") return addDays(date, 14);
  if (c === "monthly") return addMonths(date, 1);
  if (c === "quarterly") return addMonths(date, 3);
  if (c === "yearly") return addYears(date, 1);
  return addMonths(date, 1);
}

export function daysUntil(date) {
  if (!date) return Infinity;
  const now = new Date();
  const d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d1 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((d1 - d0) / (1000 * 60 * 60 * 24));
}

export function formatMoney(amount, currency = "USD") {
  const v = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

/** Simple string similarity */
export function similarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 1;
  // token overlap score
  const A = new Set(a.split(/[^a-z0-9]+/).filter(Boolean));
  const B = new Set(b.split(/[^a-z0-9]+/).filter(Boolean));
  const inter = [...A].filter(x => B.has(x)).length;
  const denom = Math.max(A.size, B.size, 1);
  return inter / denom;
}

/** Fuzzy merchant -> subscription match */
export function matchSubscriptionByMerchant(subs, merchant) {
  let best = null;
  let bestScore = 0;
  const m = (merchant || "").toString();
  subs.forEach(s => {
    const name = s?.name || "";
    const prov = s?.provider || "";
    const score = Math.max(similarity(name, m), similarity(prov, m));
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  return bestScore >= 0.45 ? best : null;
}

/** Lightweight CSV parser: handles commas and quoted fields, no newlines in quotes (MVP) */
export function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' ) {
        if (inQ && line[i + 1] === '"') {
          cur += '"'; i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(c => c.trim());
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  const rows = lines.slice(1).map(parseLine).map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i]; });
    return obj;
  });
  return { headers, rows };
}

/** Try to pull a date and amount/currency from a CSV row with typical bank headers */
export function extractTxn(row) {
  // Common header variants
  const date = row.date || row.posted || row["transaction date"] || row["posted date"] || row["fecha"] || row["fecha transaccion"];
  const desc = row.description || row.merchant || row.payee || row["merchant name"] || row["descripcion"] || row["detalle"];
  const amount = row.amount || row["debit"] || row["credit"] || row["importe"] || row["monto"];
  const currency = row.currency || row["divisa"] || "USD";
  let cents = 0;
  if (typeof amount === "string") {
    const norm = amount.replace(/[^0-9\.\-]/g, "");
    cents = Math.round(parseFloat(norm || "0") * 100);
  } else {
    cents = Math.round(Number(amount || 0) * 100);
  }
  const dt = date ? new Date(date) : null;
  return {
    date: dt && !Number.isNaN(dt.valueOf()) ? dt : new Date(),
    raw_merchant: desc || "Unknown",
    amount_cents: cents,
    currency: (currency || "USD").toUpperCase()
  };
}
