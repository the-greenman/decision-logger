#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

docker compose down --remove-orphans
docker compose -f docker-compose.whisper.yml down --remove-orphans

echo "Stack stopped (api/db/transcription/whisper)."
