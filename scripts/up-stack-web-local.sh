#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_TRANSCRIPTION_PORT="${COMPOSE_TRANSCRIPTION_PORT:-8788}"
TRANSCRIPTION_URL="http://localhost:${COMPOSE_TRANSCRIPTION_PORT}"

cd "$ROOT_DIR"

docker compose -f docker-compose.whisper.yml up -d whisper
docker compose -f docker-compose.ollama.yml up -d ollama

bash ./scripts/up-stack.sh

OLLAMA_PORT="${OLLAMA_HOST_PORT:-11434}"
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:${OLLAMA_PORT}/api/version" >/dev/null 2>&1; then
    echo "Ollama is ready at http://localhost:${OLLAMA_PORT}"
    break
  fi
  sleep 1
done

TRANSCRIPTION_PROVIDER=local \
WHISPER_LOCAL_URL=http://whisper:9000 \
  docker compose up --build -d transcription

for _ in $(seq 1 30); do
  if curl -sf "$TRANSCRIPTION_URL/health" >/dev/null 2>&1; then
    echo "Transcription (local whisper) is ready at $TRANSCRIPTION_URL"
    exit 0
  fi
  sleep 1
done

echo "Transcription service did not become ready at $TRANSCRIPTION_URL within the expected time" >&2
exit 1
