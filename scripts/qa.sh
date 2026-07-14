#!/usr/bin/env bash
# qa gate: run before pushing a feature or calling work done
set -euo pipefail
cd "$(dirname "$0")/.."

PY=".venv/bin/python"
[ -x "$PY" ] || PY="python3"

echo "== pytest"
"$PY" -m pytest tests/ -q

echo "== eslint"
npm run -s lint

echo "== long dash check"
# owner rule: no em dashes in code, copy or docs
EMDASH="$(printf '\xe2\x80\x94')"
if grep -rn "$EMDASH" app components lib api tests supabase README.md AGENTS.md Handoff.md 2>/dev/null; then
  echo "found long dashes, replace them with short ones"
  exit 1
fi
echo "clean"

echo "== backend boot"
"$PY" -m uvicorn api.index:app --port 8017 &
UV=$!
trap 'kill $UV 2>/dev/null' EXIT
curl -sf --retry 10 --retry-delay 1 --retry-connrefused http://127.0.0.1:8017/api/py/health >/dev/null
echo "health ok"

echo "== next build"
npm run -s build >/dev/null
echo "build ok"

echo
echo "qa passed"
