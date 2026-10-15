#!/bin/bash
# Click through the Desk part of docs/TESTING.md in a real (headless) Chromium with seeded data:
# Plan tour → queue → Start → Finish → Follow-Ups ✓ Mark sent → Check-In copy + ✓ Mark sent → History Undo,
# wait-estimate buttons, Rotation, Future Move-Ins add + Add to Outlook, and Dropbox Sync now (stubbed Dropbox).
#   tests/desk_flows.sh        → prints PASS/FAIL per step; details in audit/flows/desk_flows.json
# Needs the Playwright CLI (npm install -g @playwright/cli) and `npm install` in the project root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audit/flows"
mkdir -p "$OUT"
[ -d "$ROOT/node_modules/xlsx" ] || (cd "$ROOT" && npm install)
# Dropbox fixtures: a 3-unit showsheet (same layout the parser expects) and a 2-row floor plan master
NODE_PATH="$ROOT/node_modules" node -e '
  const XLSX = require("xlsx"), out = process.argv[1];
  const ss = [["2050 TIDEMARK BLVD"], ["1 BEDROOMS"], ["UNIT","TYPE","VIEW","SQ FT","AVAIL","NOTES","MONTHLY","NET EFF","INCENTIVE"],
    [1812,"1 Bed, 1 Bath W/D","Partial Manhattan Skyline, River",712,"","",4150,3804,"1 Month Free OR 1 Mo. OP"],
    [2203,"1 Bed, 1 Bath W/D Balc","Manhattan Skyline, River",745,"","",4495,4120,"1 Month Free OR 1 Mo. OP"],
    ["2230 TIDEMARK BLVD"], ["STUDIOS"], ["UNIT","TYPE","VIEW","SQ FT","AVAIL","NOTES","MONTHLY","NET EFF","INCENTIVE"],
    [714,"Studio, 1 Bath","Tidemark Harbor",480,"","",3195,2929,"1 Month Free OR 1 Mo. OP"]];
  let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ss), "Inventory");
  XLSX.writeFile(wb, out + "/fixture_showsheet.xlsx");
  const fp = [["Building","Unit","Floor plan link"], ["2050 Tidemark Blvd",1812,"https://www.dropbox.com/scl/fi/zz1/4545_1812.pdf?rlkey=x&dl=0"], ["2230 Tidemark Blvd",714,"https://www.dropbox.com/scl/fi/zz2/4720_714.pdf?rlkey=y&dl=0"]];
  wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fp), "Sheet1");
  XLSX.writeFile(wb, out + "/fixture_floorplans.xlsx");
' "$OUT"
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=desk-flows
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open --config="$ROOT/tests/cli.config.json" >/dev/null
SCRIPT="$(sed -e "s#__ROOT__#$ROOT#g" -e "s#__OUT__#$OUT#g" "$ROOT/tests/desk_flows.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/desk_flows.json"
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  let raw = require("fs").readFileSync(process.argv[1], "utf8"); let r = JSON.parse(raw); if (typeof r === "string") r = JSON.parse(r);
  r.steps.forEach(s => console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.step}${s.detail ? "  — " + s.detail : ""}`));
  console.log(`\n${r.passed} passed · ${r.failed} failed · ${r.errors.length} console/page errors`);
  r.errors.forEach(e => console.log("  ! " + e));
  process.exit(r.failed || r.errors.length ? 1 : 0);
' "$OUT/desk_flows.json"
