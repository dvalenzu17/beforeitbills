// lib/recurring/status.js

/**
 * Canonical recurring model helpers.
 * Goal: normalize all your mixed fields into one consistent filter logic.
 */

export function getRecurringKind(item) {
    const k = String(item?.kind || item?.type || "").toLowerCase();
    if (k === "bill") return "bill";
    if (k === "subscription" || k === "sub") return "subscription";
  
    // Heuristics: bills usually have dueDay/nextDue; subs have cadence/nextRenewal
    if (item?.nextDue || item?.dueDay) return "bill";
    return "subscription";
  }
  
  export function getRecurringState(item) {
    // paused / inactive / active normalizer
    // Priority: explicit paused > inactive > active
    const paused =
      item?.paused === true ||
      String(item?.status || "").toLowerCase() === "paused";
  
    if (paused) return "paused";
  
    const activeField = item?.active;
    if (activeField === false) return "inactive";
  
    const status = String(item?.status || "").toLowerCase();
    if (status === "inactive" || status === "canceled" || status === "archived") return "inactive";
  
    return "active";
  }
  
  export function isTrial(item) {
    // Support multiple naming conventions
    return !!(item?.is_trial || item?.trial || item?.isTrial);
  }
  
  export function getRecurringTags(item) {
    const tags = [];
  
    if (isTrial(item)) tags.push("trial");
  
    if (getRecurringKind(item) === "bill") {
      if (item?.autopay) tags.push("autopay");
      if (item?.variable) tags.push("variable");
    }
  
    if (item?.shared) tags.push("shared");
  
    return tags;
  }
  
  /**
   * Filter keys you can support in UI:
   * - "all"
   * - "active"
   * - "paused"
   * - "inactive"
   * - "trials"
   * - "bills"
   * - "subs"
   */
  export function matchesFilter(item, filter) {
    const f = String(filter || "all").toLowerCase();
  
    if (f === "all") return true;
  
    const kind = getRecurringKind(item);
    const state = getRecurringState(item);
  
    if (f === "bills") return kind === "bill";
    if (f === "subs" || f === "subscriptions") return kind === "subscription";
  
    if (f === "active") return state === "active";
    if (f === "paused") return state === "paused";
    if (f === "inactive") return state === "inactive";
  
    if (f === "trials") return kind === "subscription" && isTrial(item) && state !== "inactive";
  
    return true;
  }
  
  /**
   * Optional helper for UI badges.
   * Keep badges consistent across list/detail/insights.
   */
  export function getBadges(item) {
    const kind = getRecurringKind(item);
    const state = getRecurringState(item);
    const tags = getRecurringTags(item);
  
    const badges = [];
  
    // state badge
    if (state === "paused") badges.push({ key: "paused", label: "Paused" });
    if (state === "inactive") badges.push({ key: "inactive", label: "Inactive" });
  
    // kind badge (only if you actually show both mixed in one list)
    if (kind === "bill") badges.push({ key: "bill", label: "Bill" });
  
    // tag badges
    for (const t of tags) {
      if (t === "trial") badges.push({ key: "trial", label: "Trial" });
      if (t === "autopay") badges.push({ key: "autopay", label: "Autopay" });
      if (t === "variable") badges.push({ key: "variable", label: "Variable" });
      if (t === "shared") badges.push({ key: "shared", label: "Shared" });
    }
  
    return badges;
  }
  