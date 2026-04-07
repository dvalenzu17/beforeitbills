// lib/limits.js

export const FREE_RECURRING_LIMIT = 20; // raised for beta

/**
 * Items we should NOT count toward the free limit:
 * - inactive / archived
 * - imported candidates (mail/import suggestions you staged but didn't confirm)
 *
 * We support a bunch of possible flags to be resilient to your evolving schema.
 */
export function isCountableRecurring(item) {
  if (!item) return false;

  // Inactive / archived
  if (item.active === false) return false;
  if (item.archived === true) return false;

  // Imported candidate / suggestion flags (cover a lot of common shapes)
  const importedCandidateFlags = [
    item.importedCandidate,
    item.import_candidate,
    item.isImportedCandidate,
    item.is_candidate,
    item.candidate,
    item.fromImport,
    item.imported,
    item.isImported,
    item.suggested,
    item.isSuggestion,
  ];

  if (importedCandidateFlags.some(Boolean)) return false;

  // Status-based fallback
  const status = String(item.status || item.state || "").toLowerCase().trim();
  if (
    status === "candidate" ||
    status === "imported" ||
    status === "inactive" ||
    status === "archived" ||
    status === "paused" ||
    status === "pause" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "ended" ||
    status === "expired"
  ) {
    return false;
  }

  return true;
}

export function countRecurringForLimit({ subs, bills }) {
  const s = Array.isArray(subs) ? subs : [];
  const b = Array.isArray(bills) ? bills : [];

  const subCount = s.filter(isCountableRecurring).length;
  const billCount = b.filter(isCountableRecurring).length;

  return subCount + billCount;
}

// Back-compat: older screens import this name.
export function getRecurringCount(state) {
  return countRecurringForLimit(state);
}

export function canAddRecurring(state, limit = FREE_RECURRING_LIMIT) {
  const pro = !!state?.pro;
  if (pro) return { ok: true, count: countRecurringForLimit(state), limit, pro: true };

  const count = countRecurringForLimit(state);
  if (count >= limit) return { ok: false, count, limit, pro: false };

  return { ok: true, count, limit, pro: false };
}