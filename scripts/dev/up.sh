#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "==> Checking local dependencies"
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm --prefix frontend install
fi

if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  npm --prefix backend install
fi

echo "==> Starting MongoDB + Backend"
docker-compose up -d mongodb backend

echo "==> Waiting for backend health..."
ATTEMPTS=40
SLEEP_SECONDS=2
for i in $(seq 1 "$ATTEMPTS"); do
  if curl -fsS "http://localhost:5000/api/health" >/dev/null 2>&1; then
    echo "Backend is healthy."
    break
  fi

  if [ "$i" -eq "$ATTEMPTS" ]; then
    echo "Backend did not become healthy in time."
    docker-compose logs --tail=120 backend
    exit 1
  fi

  sleep "$SLEEP_SECONDS"
done

echo "==> Starting frontend dev server"
echo "Frontend: http://localhost:3000"
echo "Backend : http://localhost:5000"
npm --prefix frontend run dev
