#!/bin/bash
# Did a change move anything on the Desk at desktop or iPad width?  (production D40)
#   tests/desk_same_layout.sh            → this folder's Desk (the working tree) vs HEAD
#   tests/desk_same_layout.sh <git-ref>  → vs that commit, branch or tag
# The ref's apps/ folder is extracted with `git archive` into audit/same-layout/ (git-ignored); nothing is checked out and
# the working tree isn't touched. Compares every element's position, size and computed style at 1440, 1280 and 768 wide in
# 25 screen states (see tests/desk_same_layout.js). Prints "75 of 75 screen states identical" and exits 0, or lists the first
# difference per screen state and exits 1. Use it for a change that should only touch phones (the phone layer) or nothing
# visible. Needs the Playwright CLI (npm install -g @playwright/cli).
set -euo pipefail
REF="${1:-HEAD}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHA="$(git -C "$ROOT" rev-parse --verify --short "$REF^{commit}")"
OUT="$ROOT/audit/same-layout"; OLD="$OUT/ref-$SHA"
rm -rf "$OLD"; mkdir -p "$OLD"
git -C "$ROOT" archive "$SHA" apps | tar -x -C "$OLD"
cd "$OUT"   # the CLI's scratch folder goes here (audit/ is git-ignored)
SESSION=desk-same-layout
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open --config="$ROOT/tests/cli.config.json" >/dev/null
SCRIPT="$(sed -e "s#__OLD__#$OLD#g" -e "s#__NEW__#$ROOT#g" "$ROOT/tests/desk_same_layout.js")"
playwright-cli -s=$SESSION --raw run-code "$SCRIPT" > "$OUT/result.json" || true
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  let r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (typeof r === "string") r = JSON.parse(r);
  console.log(`${process.argv[2]} vs this folder: ${r.identicalStates} of ${r.statesCompared} screen states identical (${r.elements} elements compared)`);
  r.details.forEach(d => console.log("  ≠ " + d));
  r.errors.forEach(e => console.log("  ! " + e));
  if (r.differentStates || r.errors.length || !r.statesCompared) process.exitCode = 1;
' "$OUT/result.json" "$REF ($SHA)"
