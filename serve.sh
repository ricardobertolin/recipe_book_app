#!/usr/bin/env sh
# Serve this folder over http and open it.
# Recipe Book cannot run from file:// because browsers block ES modules
# and service workers there.

set -e
PORT="${PORT:-8765}"
cd "$(dirname "$0")"

open_browser() {
  sleep 1
  if   command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT/"
  elif command -v open     >/dev/null 2>&1; then open "http://localhost:$PORT/"
  fi
}

echo "Serving on http://localhost:$PORT/   (ctrl-c to stop)"

if   command -v python3 >/dev/null 2>&1; then open_browser & exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python  >/dev/null 2>&1; then open_browser & exec python  -m http.server "$PORT" --bind 127.0.0.1
elif command -v npx     >/dev/null 2>&1; then open_browser & exec npx --yes serve -l "$PORT"
else
  echo "Could not find Python or Node. Use any static file server in this folder."
  exit 1
fi
