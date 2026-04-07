// lib/instantValue.js
const CADENCE_TO_MONTHLY_MULT = {
    weekly: 4.33,
    biweekly: 2.17,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  };
  
  const DEFAULT_PRIORS = {
    weekly: { min: 3, max: 12 },
    biweekly: { min: 5, max: 20 },
    monthly: { min: 6, max: 30 },
    quarterly: { min: 15, max: 60 },
    yearly: { min: 40, max: 180 },
  };
  
  // Lightweight priors (optional) — you can expand later into a “merchant graph”
  const MERCHANT_PRIORS = {
    netflix: { monthly: { min: 8, max: 25 } },
    spotify: { monthly: { min: 7, max: 20 } },
    youtube: { monthly: { min: 7, max: 25 } },
    adobe: { monthly: { min: 15, max: 70 } },
    amazon: { monthly: { min: 8, max: 25 } },
    apple: { monthly: { min: 3, max: 35 } },
  };
  
  function normMerchant(m) {
    return String(m || "").trim().toLowerCase();
  }
  
  function toMonthlyFromAmount(amount, cadence) {
    const a = Number(amount || 0);
    if (!a) return null;
  
    const mult = CADENCE_TO_MONTHLY_MULT[cadence] ?? 1; // default monthly
    return a * mult;
  }
  
  function guessMonthlyRange(candidate) {
    const cadence = candidate?.cadenceGuess || "monthly";
    const merchantKey = normMerchant(candidate?.merchant);
  
    // If amount exists, derive monthly and give +-25% range.
    const monthly = toMonthlyFromAmount(candidate?.amount, cadence);
    if (monthly != null) {
      return { min: monthly * 0.8, max: monthly * 1.2 };
    }
  
    // Merchant prior if known
    const pri = MERCHANT_PRIORS[merchantKey]?.monthly;
    if (pri) return pri;
  
    // Default cadence prior
    return DEFAULT_PRIORS[cadence] || DEFAULT_PRIORS.monthly;
  }
  
  function pickNextActionDate(candidates) {
    // Prefer explicit nextDateGuess; otherwise approximate from evidence date + cadence
    const now = Date.now();
    let best = null;
  
    for (const c of candidates) {
      const nd = c?.nextDateGuess;
      if (nd && /^\d{4}-\d{2}-\d{2}$/.test(nd)) {
        const ms = new Date(nd).getTime();
        if (ms > now && (!best || ms < best)) best = ms;
      }
    }
  
    if (best) return new Date(best).toISOString().slice(0, 10);
    return null;
  }
  
  export function computeInstantValue(allCandidates) {
    const candidates = (allCandidates || [])
      .filter((c) => (Number(c?.confidence || 0) >= 55)) // “good enough” for instant value
      .slice(0, 80);
  
    let minMonthly = 0;
    let maxMonthly = 0;
  
    const top = [];
    const needsConfirm = candidates.filter((c) => c?.needsConfirm).length;
  
    for (const c of candidates) {
      const conf = Math.max(0.35, Math.min(1, Number(c?.confidence || 60) / 100));
      const r = guessMonthlyRange(c);
  
      // Weight by confidence (partial scans = fuzzier)
      minMonthly += (r.min * conf);
      maxMonthly += (r.max * conf);
  
      top.push({
        merchant: c?.merchant || "Unknown",
        confidence: Number(c?.confidence || 0),
        cadenceGuess: c?.cadenceGuess || null,
        amount: c?.amount || null,
      });
    }
  
    top.sort((a, b) => b.confidence - a.confidence);
    const topMerchants = top.slice(0, 5);
  
    const nextActionDate = pickNextActionDate(candidates);
  
    return {
      monthlyMin: Math.round(minMonthly),
      monthlyMax: Math.round(Math.max(minMonthly, maxMonthly)),
      nextActionDate, // YYYY-MM-DD or null
      needsConfirmCount: needsConfirm,
      totalCandidates: candidates.length,
      topMerchants,
    };
  }
  