#!/bin/sh
# Starts the dev server if needed and screenshots the given preview screens.
# Usage: tests/tools/shots.sh <out-dir> <screen> [<screen>…]
set -e
OUT="$1"; shift
PORT=3111
mkdir -p "$OUT"
if ! curl -s -o /dev/null "localhost:$PORT/login"; then
  npx next dev --port "$PORT" > "$OUT/dev.log" 2>&1 &
  echo $! > "$OUT/dev.pid"
  for _ in $(seq 1 80); do
    curl -s -o /dev/null "localhost:$PORT/login" && break
    sleep 0.5
  done
fi
node tests/tools/screenshot.mjs "http://localhost:$PORT" "$OUT" "$@"
