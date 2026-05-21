// lib/recurringAdapter.js
import { useStore } from "./store";

function toISODate(x) {
  if (!x) return null;
  if (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function createRecurringFromCandidate(candidate, overrides = {}) {
  const s = useStore.getState();

  const kind = overrides.kind ?? candidate.kind ?? "subscription";

  const merchant =
    String(overrides.merchant ?? overrides.name ?? candidate.merchant ?? "").trim() ||
    "Recurring Expense";

  const amount = Number(overrides.amount ?? candidate.amount ?? 0) || 0;
  const cadence = overrides.cadence ?? candidate.cadenceGuess ?? "monthly";

  // Leave null if unknown - do NOT fall back to today's date.
  // The form will require the user to pick a real date.
  const nextRenewal =
    toISODate(overrides.nextRenewal ?? overrides.nextDate ?? candidate.nextDateGuess) ?? null;

  const sharedCount =
    Number(overrides.sharedCount ?? candidate.sharedCount ?? candidate.shared_count ?? 1) || 1;
  const shared = (overrides.shared ?? candidate.shared ?? false) || sharedCount > 1;

  const payload =
    kind === "bill"
      ? {
          kind: "bill",
          name: merchant,
          merchant,
          amount,
          currency: overrides.currency ?? candidate.currency ?? "USD",
          nextDue:
            toISODate(overrides.nextDue ?? overrides.nextDate ?? candidate.nextDateGuess) ?? null,
          shared,
          sharedCount,
          source: "email_import",
          active: true,
        }
      : {
          kind: "subscription",
          merchant,
          amount,
          currency: overrides.currency ?? candidate.currency ?? "USD",
          cadence,
          nextRenewal,
          shared,
          sharedCount,
          source: "email_import",
          active: true,
        };

  const fn = s.addRecurring;

  if (!fn)
    throw new Error(
      "addRecurring not found on store. Check store.js exports."
    );

  const res = await fn(payload);

  return res;
}