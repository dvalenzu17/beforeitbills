// scripts/audit-confirm-flows.js
// Usage: node scripts/audit-confirm-flows.js
// Scans your repo for "Confirm" flows that should have visible feedback + undo.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "components", "lib"];
const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(p);
    } else {
      if (!EXT.has(path.extname(p))) continue;
      const text = fs.readFileSync(p, "utf8");
      hits.push({ file: p, text });
    }
  }
}

for (const d of TARGET_DIRS) walk(path.join(ROOT, d));

function find(pattern) {
  const out = [];
  for (const h of hits) {
    if (pattern.test(h.text)) out.push(h.file);
  }
  return out;
}

// 1) Confirm buttons
const confirmButtons = find(/title\s*=\s*["']Confirm["']/);

// 2) UndoToast usage
const undoToastUsers = find(/UndoToast/);

// 3) deleteRecurring in store
const hasDeleteRecurring = hits.some(
  (h) => /lib\/store\.(js|ts)x?$/.test(h.file) && /deleteRecurring\s*:\s*async/.test(h.text)
);

// 4) Confirm handlers that don't show feedback (heuristic)
const confirmNoFeedback = [];
for (const h of hits) {
  if (!/Confirm/.test(h.text)) continue;
  // If it has a confirmCandidate-ish function but no UndoToast / toast / Alert, flag it
  const hasConfirmFn = /function\s+\w*confirm\w*\s*\(|const\s+\w*confirm\w*\s*=/.test(h.text);
  if (!hasConfirmFn) continue;

  const hasFeedback =
    /UndoToast/.test(h.text) ||
    /showUndo\s*\(/.test(h.text) ||
    /Toast/.test(h.text) ||
    /Alert\.alert/.test(h.text);

  if (!hasFeedback) confirmNoFeedback.push(h.file);
}

console.log("\n=== Confirm Flow Audit ===\n");
console.log("Confirm buttons:", confirmButtons.length ? confirmButtons : "none");
console.log("\nUndoToast used in:", undoToastUsers.length ? undoToastUsers : "none");
console.log("\nstore.deleteRecurring present:", hasDeleteRecurring ? "YES ✅" : "NO ❌");

if (confirmNoFeedback.length) {
  console.log("\n⚠️ Potential confirm flows missing feedback:");
  for (const f of new Set(confirmNoFeedback)) console.log(" -", f);
} else {
  console.log("\nNo obvious confirm flows missing feedback ✅");
}

console.log("\nNext steps:");
console.log(" - Any screen with Confirm should show a toast AND support undo.");
console.log(" - If you see a file flagged above, add UndoToast (or your global toast) + undo callback.\n");
