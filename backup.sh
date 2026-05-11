#!/usr/bin/env bash
# backup.sh — резервное копирование PM Platform
# Использование: bash backup.sh
# Сохраняет: базу данных, загруженные файлы, .env
# Хранит последние 7 резервных копий (старые удаляются автоматически)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$ROOT/backups/$(date +%Y-%m-%d_%H%M%S)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
die()  { printf "${RED}[✗]${NC} %s\n" "$1"; exit 1; }

echo ""
echo "================================================="
echo "      PM Platform — резервное копирование"
echo "================================================="
echo ""

# Проверяем что контейнеры запущены
docker inspect pm_db > /dev/null 2>&1          || die "Контейнер pm_db не найден. Сначала запустите: bash setup.sh"
docker inspect pm_backend_app > /dev/null 2>&1 || die "Контейнер pm_backend_app не найден. Сначала запустите: bash setup.sh"

mkdir -p "$BACKUP_DIR"

# ── 1. База данных ───────────────────────────────────────────────
echo "Копирование базы данных..."
docker exec pm_db pg_dump -U pm pm_platform | gzip > "$BACKUP_DIR/db.sql.gz"
ok "База данных сохранена: $BACKUP_DIR/db.sql.gz"

# ── 2. Медиа-файлы (загруженные пользователями) ─────────────────
echo "Копирование загруженных файлов..."
docker run --rm \
    -v pm_media:/data \
    alpine \
    tar czf - -C /data . > "$BACKUP_DIR/media.tar.gz"
ok "Файлы сохранены: $BACKUP_DIR/media.tar.gz"

# ── 3. Файл .env ────────────────────────────────────────────────
if [ -f "$ROOT/backend/.env" ]; then
    cp "$ROOT/backend/.env" "$BACKUP_DIR/env.bak"
    ok "Настройки сохранены: $BACKUP_DIR/env.bak"
else
    warn "Файл backend/.env не найден — пропускаем"
fi

# ── 4. Удаляем старые резервные копии (оставляем последние 7) ───
OLD_COUNT=$(ls -dt "$ROOT/backups"/*/ 2>/dev/null | wc -l || echo 0)
if [ "$OLD_COUNT" -gt 7 ]; then
    ls -dt "$ROOT/backups"/*/ | tail -n +8 | xargs rm -rf
    ok "Удалены старые резервные копии (сохранены последние 7)"
fi

echo ""
echo "================================================="
echo "  Резервная копия создана:"
echo "  $BACKUP_DIR"
echo ""
echo "  Для восстановления:"
echo "  bash restore.sh $BACKUP_DIR"
echo "================================================="
echo ""
