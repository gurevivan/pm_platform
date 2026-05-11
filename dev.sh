#!/usr/bin/env bash
# Одна команда: миграции + API (8000) + фронт (5173). Ctrl+C — остановка всего.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT/backend"
./.venv/bin/python manage.py migrate --noinput
./.venv/bin/python manage.py runserver &
DJANGO_PID=$!

cleanup() {
  kill "$DJANGO_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT/frontend"
npm run dev
