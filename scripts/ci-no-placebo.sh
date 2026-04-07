#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

echo "🔎 Running placebo UI gate in: $ROOT"

# 1) Empty onPress handlers (unless explicitly allowed)
# Allowlist tag: ALLOW_EMPTY_ONPRESS (for modal backdrops swallowing taps)
EMPTY_ONPRESS=$(rg -n --hidden --glob '!**/node_modules/**' \
  'onPress=\{\(\)\s*=>\s*\{\s*\}\}' "$ROOT" || true)

if [[ -n "$EMPTY_ONPRESS" ]]; then
  # Filter allowlist
  VIOLATIONS=$(echo "$EMPTY_ONPRESS" | rg -v 'ALLOW_EMPTY_ONPRESS' || true)
  if [[ -n "$VIOLATIONS" ]]; then
    echo "❌ Found EMPTY onPress handlers (no placebo UI allowed):"
    echo "$VIOLATIONS"
    exit 1
  fi
fi

# 2) User-visible placeholder strings (Later / (v1) / TODO) inside quotes
PLACEHOLDER_STRINGS=$(rg -n --hidden --glob '!**/node_modules/**' \
  '["'\'`][^"'\'`]*(Later|\(v1\)|TODO)[^"'\'`]*["'\'`]' "$ROOT" || true)

if [[ -n "$PLACEHOLDER_STRINGS" ]]; then
  echo "❌ Found placeholder UI strings (Later / (v1) / TODO):"
  echo "$PLACEHOLDER_STRINGS"
  echo "Fix: remove placeholder text or replace with real behavior."
  exit 1
fi

# 3) Placeholder alerts that admit they’re fake
PLACEHOLDER_ALERTS=$(rg -n --hidden --glob '!**/node_modules/**' \
  'Alert\.alert\([^)]*(Later|\(v1\)|TODO)' "$ROOT" || true)

if [[ -n "$PLACEHOLDER_ALERTS" ]]; then
  echo "❌ Found placeholder Alert.alert calls:"
  echo "$PLACEHOLDER_ALERTS"
  exit 1
fi

echo "✅ Placebo UI gate passed."
