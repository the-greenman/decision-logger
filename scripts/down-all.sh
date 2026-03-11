#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_PID_FILE="$ROOT_DIR/.tmp/web-dev.pid"

cd "$ROOT_DIR"

if [[ -f "$WEB_PID_FILE" ]]; then
  WEB_PID="$(cat "$WEB_PID_FILE" 2>/dev/null || true)"
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
    for _ in $(seq 1 10); do
      if ! kill -0 "$WEB_PID" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if kill -0 "$WEB_PID" >/dev/null 2>&1; then
      kill -9 "$WEB_PID" >/dev/null 2>&1 || true
    fi
    echo "Stopped web dev server (pid $WEB_PID)."
  fi
  rm -f "$WEB_PID_FILE"
fi

bash ./scripts/down-stack.sh
