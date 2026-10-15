#!/bin/bash
# Screenshot every Leasing Desk screen at 1440 and 1280 wide, with seeded data, in a real (headless) Chromium.
#   tests/desk_capture.sh before     → audit/before/*.png + audit/before/capture.json
#   tests/desk_capture.sh after      → audit/after/…
# capture.json holds console errors, keyboard focus data, and the exact Preview & Copy HTML per template
# (compare two runs with: node tests/compare_emails.js audit/before audit/after).
# Needs the Playwright CLI (npm install -g @playwright/cli) and `npm install` in the project root.
set -euo pipefail
PHASE="${1:?usage: tests/desk_capture.sh before|after}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audit/$PHASE"
mkdir -p "$OUT"
[ -d "$ROOT/node_modules/xlsx" ] || (cd "$ROOT" && npm install)
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=desk-capture
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open --config="$ROOT/tests/cli.config.json" >/dev/null
SCRIPT="$(sed -e "s#__ROOT__#$ROOT#g" -e "s#__OUT__#$OUT#g" "$ROOT/tests/desk_capture.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/capture.json"
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(`${r.shots} screenshots · ${Object.keys(r.emails).length} email templates captured · ${r.errors.length} console/page errors`);
  r.errors.forEach(e => console.log("  ! " + e));
' "$OUT/capture.json"
