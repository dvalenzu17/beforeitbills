// Standalone unit test for the reminder-targeting logic. No framework needed:
//   node lib/reminderPlan.test.js
// Exits non-zero on failure so it can be wired into CI later.

const assert = require("node:assert");
const { resolveSubNextDate, isCancelledSub, resolveReminderTarget } = require("./reminderPlan");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

// --- resolveSubNextDate: the field-fallback that previously caused silent drops ---
test("reads nextRenewal when present", () => {
  assert.equal(resolveSubNextDate({ nextRenewal: "2026-07-03" }), "2026-07-03");
});

test("falls back to renewal_date (Supabase column shape)", () => {
  assert.equal(resolveSubNextDate({ renewal_date: "2026-07-03" }), "2026-07-03");
});

test("falls back to nextDate (scan-imported shape)", () => {
  assert.equal(resolveSubNextDate({ nextDate: "2026-07-03" }), "2026-07-03");
});

test("prefers nextRenewal over the other aliases", () => {
  assert.equal(
    resolveSubNextDate({ nextRenewal: "2026-07-03", nextDate: "2025-01-01", renewal_date: "2025-02-02" }),
    "2026-07-03"
  );
});

test("returns null when no date field exists", () => {
  assert.equal(resolveSubNextDate({ merchant: "Ghost" }), null);
});

// --- isCancelledSub ---
test("active:false is cancelled", () => {
  assert.equal(isCancelledSub({ active: false }), true);
});

test("status 'cancelled' / 'canceled' is cancelled", () => {
  assert.equal(isCancelledSub({ status: "cancelled" }), true);
  assert.equal(isCancelledSub({ status: "Canceled" }), true);
});

test("a normal active sub is not cancelled", () => {
  assert.equal(isCancelledSub({ active: true, status: "confirmed" }), false);
});

// --- resolveReminderTarget: renewal vs trial vs skip ---
test("renewal sub with renewal_date targets renewal off that date", () => {
  const t = resolveReminderTarget({ id: "1", renewal_date: "2026-07-03" });
  assert.deepEqual(t, { kind: "renewal", baseRaw: "2026-07-03" });
});

test("trial sub targets trial off trial_end (not the renewal date)", () => {
  const t = resolveReminderTarget({ id: "2", trial_end: "2026-07-05", nextRenewal: "2026-08-05" });
  assert.deepEqual(t, { kind: "trial", baseRaw: "2026-07-05" });
});

test("is_trial flag without trial_end falls through to renewal date", () => {
  const t = resolveReminderTarget({ id: "3", is_trial: true, nextDate: "2026-07-10" });
  assert.deepEqual(t, { kind: "renewal", baseRaw: "2026-07-10" });
});

test("cancelled sub is skipped entirely", () => {
  assert.equal(resolveReminderTarget({ id: "4", active: false, nextRenewal: "2026-07-03" }), null);
});

test("sub with no usable date is skipped", () => {
  assert.equal(resolveReminderTarget({ id: "5", merchant: "Ghost" }), null);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);
