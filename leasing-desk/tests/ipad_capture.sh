#!/bin/bash
# Screenshot every Tour Companion (iPad) screen in WebKit (Safari's engine) with iPad touch emulation, portrait 820×1180 and
# landscape 1180×820, with seeded data.
#   tests/ipad_capture.sh before     → audit/ipad/before/*.png + capture.json
#   tests/ipad_capture.sh after      → audit/ipad/after/…
# capture.json holds console errors, touch targets under 44×44, and text below WCAG AA contrast, per screen.
# Needs the Playwright CLI (npm install -g @playwright/cli) with WebKit (playwright-cli install-browser webkit).
set -euo pipefail
PHASE="${1:?usage: tests/ipad_capture.sh before|after}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audit/ipad/$PHASE"
mkdir -p "$OUT"
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=ipad-capture
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open --browser=webkit --device="iPad (gen 11)" --config="$ROOT/tests/cli.config.json" >/dev/null
SCRIPT="$(sed -e "s#__ROOT__#$ROOT#g" -e "s#__OUT__#$OUT#g" "$ROOT/tests/ipad_capture.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/capture.json"
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(`${r.shots} screenshots · ${r.errors.length} console/page errors`);
  r.errors.forEach(e => console.log("  ! " + e));
' "$OUT/capture.json"
