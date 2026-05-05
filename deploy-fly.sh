#!/usr/bin/env bash
set -euo pipefail

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

if [ -z "${CURSOR_API_KEY:-}" ]; then
  echo "Error: CURSOR_API_KEY not set. Add it to .env.local or export it."
  exit 1
fi

if ! command -v flyctl >/dev/null 2>&1; then
  echo "Error: flyctl not found. Install from https://fly.io/docs/flyctl/install/."
  exit 1
fi

if ! flyctl auth whoami >/dev/null 2>&1; then
  echo "Error: flyctl is not logged in. Run: flyctl auth login"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found. Install Docker to build locally."
  exit 1
fi

if [ -z "${DOCKER_HOST:-}" ]; then
  DOCKER_HOST="$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
  if [ -n "$DOCKER_HOST" ] && [ "$DOCKER_HOST" != "<no value>" ]; then
    export DOCKER_HOST
  fi
fi

CURSOR_MODEL="${CURSOR_MODEL:-composer-2}"
APP_NAME="cursor-sdk-portfolio"

if ! flyctl status --app "$APP_NAME" >/dev/null 2>&1; then
  echo "Creating Fly app $APP_NAME..."
  flyctl apps create "$APP_NAME"
fi

echo "Deploying $APP_NAME to Fly.io (linux/amd64)..."
DOCKER_DEFAULT_PLATFORM=linux/amd64 \
  flyctl deploy \
    --config fly.toml \
    --local-only \
    --build-arg CURSOR_API_KEY="$CURSOR_API_KEY" \
    --build-arg CURSOR_MODEL="$CURSOR_MODEL" \
    "$@"
