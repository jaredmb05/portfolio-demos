#!/bin/bash
# Click through the iPad part of docs/TESTING.md in WebKit (Safari's engine) with iPad touch emulation and seeded data:
# search, new tour → pick units → remove + Undo → take it → Start → summary → Finish, inspection Start → Finish from
# Today's tours, a tour finished at the Desk while open, Rotation Mark out / back in, calculator, cheat sheet, quiz.
#   tests/ipad_flows.sh        → prints PASS/FAIL per step; details in audit/flows/ipad_flows.json
# Needs the Playwright CLI (npm install -g @playwright/cli) with WebKit (playwright-cli install-browser webkit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audit/flows"
mkdir -p "$OUT"
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=ipad-flows
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open --browser=webkit --device="iPad (gen 11)" --config="$ROOT/tests/cli.config.json" >/dev/null
SCRIPT="$(sed -e "s#__ROOT__#$ROOT#g" -e "s#__OUT__#$OUT#g" "$ROOT/tests/ipad_flows.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/ipad_flows.json"
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  let r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (typeof r === "string") r = JSON.parse(r);
  r.steps.forEach(s => console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.step}${s.detail ? "  — " + s.detail : ""}`));
  console.log(`\n${r.passed} passed · ${r.failed} failed · ${r.errors.length} console/page errors`);
  r.errors.forEach(e => console.log("  ! " + e));
  process.exit(r.failed || r.errors.length ? 1 : 0);
' "$OUT/ipad_flows.json"
