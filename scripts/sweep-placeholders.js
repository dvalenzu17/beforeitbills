// scripts/sweep-placeholders.js
// Usage: node scripts/sweep-placeholders.js

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "components", "lib"];
const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

const findings = [];

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
      scan(p, text);
    }
  }
}

function add(file, line, type, snippet) {
  findings.push({ file, line, type, snippet: snippet.trim().slice(0, 160) });
}

function scan(file, text) {
  const lines = text.split("\n");

  lines.forEach((l, i) => {
    const lineNo = i + 1;

    // Dead buttons (usually bad; if it's a backdrop swallow-tap, ignore via comment tag)
    if (/onPress=\{\(\)\s*=>\s*\{\s*\}\}/.test(l) && !/ALLOW_EMPTY_ONPRESS/.test(l)) {
      add(file, lineNo, "EMPTY_ONPRESS", l);
    }

    // User-visible placeholder strings
    if (/(["'`].*\bLater\b.*["'`])/.test(l)) add(file, lineNo, "STRING_LATER", l);
    if (/(["'`].*\(v1\).*["'`])/.test(l)) add(file, lineNo, "STRING_V1", l);
    if (/(["'`].*\bTODO\b.*["'`])/.test(l)) add(file, lineNo, "STRING_TODO", l);

    // Placeholder alerts
    if (/Alert\.alert\([^)]*\bLater\b/i.test(l)) add(file, lineNo, "ALERT_LATER", l);
    if (/Alert\.alert\([^)]*\bv1\b/i.test(l)) add(file, lineNo, "ALERT_V1", l);
  });
}

for (const d of TARGET_DIRS) walk(path.join(ROOT, d));

console.log("\n=== Placebo Sweep ===\n");
if (!findings.length) {
  console.log("No obvious dead buttons / placeholder strings found ✅\n");
  process.exit(0);
}

// Print grouped
findings.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
for (const f of findings) {
  console.log(`${f.type}  ${f.file}:${f.line}\n  ${f.snippet}\n`);
}

console.log("Rule:");
console.log(" - If it doesn’t do something visible, remove it or wire it.");
console.log(" - Backdrop pressables can be allowed by adding // ALLOW_EMPTY_ONPRESS on that line.\n");
