#!/bin/bash
# Screenshot every Leasing Desk screen at 1440 and 1280 wide, with seeded data, in a real (headless) Chromium.
#   tests/desk_capture.sh before       → audit/before/*.png + audit/before/capture.json
#   tests/desk_capture.sh after        → audit/after/…
#   tests/desk_capture.sh after phone  → audit/after-phone/…: the same screens on an emulated iPhone 15, 390×844 and 360×780
#                                        (production D40); fails on a control under 44×44 px, one a finger can't reach,
#                                        or a screen wider than the phone
# capture.json holds console errors, keyboard focus data, and the exact Preview & Copy HTML per template
# (compare two runs with: node tests/compare_emails.js audit/before audit/after).
# Needs the Playwright CLI (npm install -g @playwright/cli) and `npm install` in the project root.
set -euo pipefail
PHASE="${1:?usage: tests/desk_capture.sh before|after [phone]}"
PHONE=0; [ "${2:-}" = "phone" ] && PHONE=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audit/$PHASE"; [ "$PHONE" = 1 ] && OUT="$OUT-phone"
mkdir -p "$OUT"
[ -d "$ROOT/node_modules/xlsx" ] || (cd "$ROOT" && npm install)
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=desk-capture
openBrowser() {
  if [ "$PHONE" = 1 ]; then playwright-cli -s=$SESSION open --device="iPhone 15" --config="$ROOT/tests/cli.config.json" >/dev/null
  else playwright-cli -s=$SESSION open --config="$ROOT/tests/cli.config.json" >/dev/null; fi
}
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
openBrowser
SCRIPT="$(sed -e "s#__ROOT__#$ROOT#g" -e "s#__OUT__#$OUT#g" -e "s#__PHONE__#$PHONE#g" "$ROOT/tests/desk_capture.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/capture.json" || true
# The CLI sometimes loses its browser mid-run on back-to-back runs ("Target page … has been closed"); retry once
if head -c 9 "$OUT/capture.json" | grep -q "### Error"; then
  echo "(browser closed mid-run — retrying once)" >&2
  playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
  openBrowser
  playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/capture.json"
fi
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(`${r.shots} screenshots · ${Object.keys(r.emails).length} email templates captured · ${r.errors.length} console/page errors`);
  r.errors.forEach(e => console.log("  ! " + e));
  const un = r.unreachable || [], wide = r.wide || [];
  if (process.argv[2] === "1") console.log(`Phone: ${un.length} controls a finger couldn’t tap (under 44×44 px, covered, or off the screen) · ${wide.length} screens wider than the phone`);
  un.forEach(e => console.log("  x " + e));
  wide.forEach(e => console.log("  ↔ " + e));
  if (un.length || wide.length) process.exitCode = 1;
' "$OUT/capture.json" "$PHONE"
