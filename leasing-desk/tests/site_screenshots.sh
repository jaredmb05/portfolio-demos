#!/bin/bash
# Saves the README / site screenshots of the in-browser demo to docs/screenshots/ (1440 px wide PNGs).
# Serves apps/ with Python's static server; needs the Playwright CLI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8766}"; BASE="http://127.0.0.1:$PORT/"; OUT="$ROOT/docs/screenshots"
mkdir -p "$OUT" "$ROOT/audit/site"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/apps" >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null "$BASE" && break; sleep 0.1; done
cd "$ROOT/audit/site"   # the CLI's scratch folder (git-ignored)
playwright-cli -s=site-shots close >/dev/null 2>&1 || true
playwright-cli -s=site-shots open >/dev/null
playwright-cli -s=site-shots --raw run-code "$(sed -e "s#__BASE__#$BASE#g" -e "s#__OUT__#$OUT#g" "$ROOT/tests/site_screenshots.js")"
playwright-cli -s=site-shots close >/dev/null 2>&1 || true
ls -1 "$OUT"
