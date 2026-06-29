// Pure, dependency-free reminder-targeting logic shared by the notification
// engine. Kept import-free (and CommonJS) so it can be unit-tested in plain
// Node without a framework, while still importable from the ESM app bundle.
//
// This is the exact surface that previously caused silent failures:
//  - the engine read only `nextRenewal`, while the UI read a fallback chain, so
//    subs whose date lived in another field showed a countdown but never fired.
//  - trials were never targeted by the renewal engine at all.

/**
 * Resolve a subscription's next date using the SAME fallback chain the UI uses
 * in getRecurring()/the widget, so the scheduler can't disagree with the screen.
 */
function resolveSubNextDate(s) {
  return (
    s?.nextRenewal ??
    s?.next_renewal ??
    s?.next_renewal_at ??
    s?.nextDate ??
    s?.renewalDate ??
    s?.renewal_date ??
    null
  );
}

/** A sub is cancelled/inactive and should never produce reminders. */
function isCancelledSub(s) {
  if (s?.active === false) return true;
  const status = String(s?.status ?? "").toLowerCase();
  return status === "cancelled" || status === "canceled";
}

/**
 * Decide whether a subscription should produce reminders and off which date.
 * Trials remind off the trial-end date; everything else off the next renewal.
 * @returns {{ kind: 'trial'|'renewal', baseRaw: string|Date }|null} null = skip
 */
function resolveReminderTarget(s) {
  if (isCancelledSub(s)) return null;

  const trialEndRaw = s?.trial_end ?? s?.trialEnd ?? null;
  const isTrial = !!(s?.is_trial || s?.isTrial || trialEndRaw);
  if (isTrial && trialEndRaw) return { kind: "trial", baseRaw: trialEndRaw };

  const baseRaw = resolveSubNextDate(s);
  if (!baseRaw) return null;
  return { kind: "renewal", baseRaw };
}

module.exports = { resolveSubNextDate, isCancelledSub, resolveReminderTarget };
