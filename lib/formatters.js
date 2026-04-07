// lib/formatters.js

export function fmtMoney(amount, currency = "USD", opts = {}) {
    const n = Number(amount);
    const safe = Number.isFinite(n) ? n : 0;
    const cur = String(currency || "USD").toUpperCase();
  
    try {
      // Keeps currency ALWAYS visible (Tier 2 requirement)
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
        currencyDisplay: "symbol",
        maximumFractionDigits: opts.maxFractionDigits ?? 2,
        minimumFractionDigits: opts.minFractionDigits ?? 2,
      }).format(safe);
    } catch {
      // fallback (still shows currency)
      return `${safe.toFixed(2)} ${cur}`;
    }
  }
  
  export function cadenceToSuffix(cadence) {
    const c = String(cadence || "").toLowerCase();
  
    // normalize common cases
    if (c.includes("year") || c === "yr" || c === "annual" || c === "annually") return "/yr";
    if (c.includes("week") || c === "wk" || c === "weekly") return "/wk";
    if (c.includes("quarter") || c === "qtr" || c === "quarterly") return "/qtr";
    if (c.includes("day") || c === "daily") return "/day";
    if (c.includes("month") || c === "mo" || c === "monthly") return "/mo";
  
    // unknown cadence still gets a prefix so it’s never blank
    return c ? `/${c}` : "/mo";
  }
  
  export function fmtDateShort(d) {
    if (!d) return "—";
    const dt = new Date(String(d));
    if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  
    try {
      // “Jan 24”
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return String(d).slice(0, 10);
    }
  }
  