#!/bin/bash
# Checks the in-browser demo the way a visitor gets it: apps/ served by a plain static server (Python's, no npm, no .env),
# a fresh browser, and every request outside that server blocked. Needs the Playwright CLI (npm install -g @playwright/cli).
#   tests/demo_check.sh            → prints PASS/FAIL per step; exits non-zero on any failure, error or outside request
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8765}"; BASE="http://127.0.0.1:$PORT/"
OUT="$ROOT/audit/demo"; mkdir -p "$OUT"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/apps" >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null "$BASE" && break; sleep 0.1; done
cd "$OUT"   # the CLI writes its .playwright-cli/ scratch folder here (audit/ is git-ignored)
SESSION=demo-check
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
playwright-cli -s=$SESSION open >/dev/null
playwright-cli -s=$SESSION --raw run-code "$(sed -e "s#__BASE__#$BASE#g" "$ROOT/tests/demo_check.js")" > "$OUT/demo_check.json"
playwright-cli -s=$SESSION close >/dev/null 2>&1 || true
node -e '
  let r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (typeof r === "string") r = JSON.parse(r);
  r.steps.forEach(s => console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.step}${s.detail ? "  — " + s.detail : ""}`));
  console.log(`\n${r.passed} passed · ${r.failed} failed · ${r.errors.length} console/page errors · ${r.blocked.length} outside requests`);
  r.errors.forEach(e => console.log("  ! " + e)); r.blocked.forEach(u => console.log("  ✗ " + u));
  process.exit(r.failed || r.errors.length || r.blocked.length ? 1 : 0);
' "$OUT/demo_check.json"
