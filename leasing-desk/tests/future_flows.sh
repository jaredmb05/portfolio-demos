#!/bin/bash
# Future Move-Ins checks in a real (headless) Chromium: auto-capture at 45 days, no duplicates, due counts,
# manual add, Contacted / Reopen, the Outlook .ics file, and Delete.
#   tests/future_flows.sh        → prints PASS/FAIL per step; details in audit/flows/future_flows.json
# Needs the Playwright CLI (npm install -g @playwright/cli) and `npm install` in the project root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audit/flows"
mkdir -p "$OUT"
[ -d "$ROOT/node_modules/xlsx" ] || (cd "$ROOT" && npm install)
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=future-flows
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open --config="$ROOT/tests/cli.config.json" >/dev/null
SCRIPT="$(sed -e "s#__ROOT__#$ROOT#g" "$ROOT/tests/future_flows.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/future_flows.json"
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  let r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (typeof r === "string") r = JSON.parse(r);
  r.steps.forEach(s => console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.step}${s.detail ? "  — " + s.detail : ""}`));
  console.log(`\n${r.passed} passed · ${r.failed} failed · ${r.errors.length} console/page errors`);
  r.errors.forEach(e => console.log("  ! " + e));
  process.exit(r.failed || r.errors.length ? 1 : 0);
' "$OUT/future_flows.json"
