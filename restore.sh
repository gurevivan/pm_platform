#!/usr/bin/env bash
# restore.sh — восстановление PM Platform из резервной копии
# Использование: bash restore.sh ./backups/2024-01-15_143022
# ВНИМАНИЕ: существующие данные будут перезаписаны!

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
die()  { printf "${RED}[✗]${NC} %s\n" "$1"; exit 1; }

# ── Проверка аргументов ──────────────────────────────────────────
[ $# -eq 1 ] || die "Укажите папку резервной копии.\nПример: bash restore.sh ./backups/2024-01-15_143022"

BACKUP_DIR="$1"
[ -d "$BACKUP_DIR" ] || die "Папка не найдена: $BACKUP_DIR"

echo ""
echo "================================================="
echo "     PM Platform — восстановление данных"
echo "================================================="
echo ""
echo "  Папка резервной копии: $BACKUP_DIR"
echo ""
printf "${YELLOW}ВНИМАНИЕ: все текущие данные будут заменены данными из резервной копии!${NC}\n"
echo ""
read -r -p "Продолжить? (введите 'да' для подтверждения): " CONFIRM
[ "$CONFIRM" = "да" ] || { echo "Отменено."; exit 0; }
echo ""

# ── Проверяем контейнеры ─────────────────────────────────────────
docker inspect pm_db > /dev/null 2>&1          || die "Контейнер pm_db не найден. Сначала запустите: bash setup.sh"
docker inspect pm_backend_app > /dev/null 2>&1 || die "Контейнер pm_backend_app не найден. Сначала запустите: bash setup.sh"

# ── 1. Останавливаем backend ─────────────────────────────────────
echo "Остановка backend..."
docker stop pm_backend_app > /dev/null
ok "Backend остановлен"

# ── 2. Восстановление базы данных ───────────────────────────────
if [ -f "$BACKUP_DIR/db.sql.gz" ]; then
    echo "Восстановление базы данных..."
    # Очищаем и восстанавливаем
    docker exec pm_db psql -U pm -c "DROP DATABASE IF EXISTS pm_platform;" > /dev/null 2>&1 || true
    docker exec pm_db psql -U pm -c "CREATE DATABASE pm_platform;" > /dev/null
    gunzip -c "$BACKUP_DIR/db.sql.gz" | docker exec -i pm_db psql -U pm pm_platform > /dev/null
    ok "База данных восстановлена"
else
    warn "Файл db.sql.gz не найден — пропускаем восстановление БД"
fi

# ── 3. Восстановление медиа-файлов ──────────────────────────────
if [ -f "$BACKUP_DIR/media.tar.gz" ]; then
    echo "Восстановление загруженных файлов..."
    docker run --rm \
        -v pm_media:/data \
        alpine \
        sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf - -C /data" \
        < "$BACKUP_DIR/media.tar.gz"
    ok "Загруженные файлы восстановлены"
else
    warn "Файл media.tar.gz не найден — пропускаем восстановление файлов"
fi

# ── 4. Восстановление .env (опционально) ────────────────────────
if [ -f "$BACKUP_DIR/env.bak" ]; then
    echo ""
    read -r -p "Восстановить файл настроек (.env)? (да/нет): " RESTORE_ENV
    if [ "$RESTORE_ENV" = "да" ]; then
        cp "$BACKUP_DIR/env.bak" "$ROOT/backend/.env"
        ok "Файл .env восстановлен"
    else
        warn "Файл .env оставлен без изменений"
    fi
fi

# ── 5. Запускаем backend ─────────────────────────────────────────
echo ""
echo "Запуск backend..."
docker start pm_backend_app > /dev/null
ok "Backend запущен"

echo ""
echo "================================================="
echo "  Восстановление завершено."
echo "  Откройте http://localhost в браузере"
echo "================================================="
echo ""
