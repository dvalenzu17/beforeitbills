import assert from 'node:assert/strict';
import { computeBillNextDue, parseISODate, toISODate } from '../lib/dateMath.js';

function dt(y, m, d) {
  // m is 1-based for readability
  return new Date(y, m - 1, d);
}

// --- toISODate / parseISODate ---
assert.equal(toISODate(dt(2025, 1, 5)), '2025-01-05');
assert.ok(parseISODate('2024-02-29') instanceof Date);
assert.equal(parseISODate('2024-02-30'), null);

// --- Month-end clamp ---
// Feb non-leap
assert.equal(
  computeBillNextDue({ dueDay: 31 }, dt(2023, 2, 1)),
  '2023-02-28'
);

// Feb leap year
assert.equal(
  computeBillNextDue({ dueDay: 31 }, dt(2024, 2, 1)),
  '2024-02-29'
);

// April has 30
assert.equal(
  computeBillNextDue({ dueDay: 31 }, dt(2025, 4, 10)),
  '2025-04-30'
);

// --- “already passed” logic ---
// Due day earlier than today -> next month
assert.equal(
  computeBillNextDue({ dueDay: 1 }, dt(2025, 12, 31)),
  '2026-01-01'
);

// Due day today -> today
assert.equal(
  computeBillNextDue({ dueDay: 31 }, dt(2025, 1, 31)),
  '2025-01-31'
);

// Due day later this month -> this month
assert.equal(
  computeBillNextDue({ dueDay: 31 }, dt(2025, 1, 30)),
  '2025-01-31'
);

console.log('✅ dateMath tests passed');
