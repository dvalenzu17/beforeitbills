// lib/formatters.js

export function fmtMoney(amount, currency, opts) {
  if (currency === undefined) currency = "USD";
  if (opts === undefined) opts = {};
  var n = Number(amount);
  var safe = Number.isFinite(n) ? n : 0;
  var cur = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      currencyDisplay: "symbol",
      maximumFractionDigits: opts.maxFractionDigits !== undefined ? opts.maxFractionDigits : 2,
      minimumFractionDigits: opts.minFractionDigits !== undefined ? opts.minFractionDigits : 2,
    }).format(safe);
  } catch (e) {
    return safe.toFixed(2) + " " + cur;
  }
}

export function cadenceToSuffix(cadence) {
  var c = String(cadence || "").toLowerCase();
  if (c.includes("year") || c === "yr" || c === "annual" || c === "annually") return "/yr";
  if (c.includes("semi")) return "/6mo";
  if (c.includes("quarter") || c === "qtr" || c === "quarterly") return "/qtr";
  if (c.includes("week") || c === "wk" || c === "weekly") return "/wk";
  if (c.includes("day") || c === "daily") return "/day";
  if (c.includes("month") || c === "mo" || c === "monthly") return "/mo";
  return "/mo";
}

export function fmtDateShort(d) {
  if (!d) return "-";
  var dt = new Date(String(d));
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  try {
    return dt.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (e) {
    return String(d).slice(0, 10);
  }
}
