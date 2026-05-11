#!/usr/bin/env bash
# setup.sh — установка и первый запуск PM Platform
# Использование: bash setup.sh
# Требования: Docker (версия 20.10 или новее)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/backend/.env"
ENV_EXAMPLE="$ROOT/backend/.env.example"

# ── Цвета ────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
die()  { printf "${RED}[✗]${NC} %s\n" "$1"; exit 1; }

echo ""
echo "================================================="
echo "        PM Platform — установка и запуск"
echo "================================================="
echo ""

# ── 1. Проверка Docker ───────────────────────────────────────────
command -v docker &>/dev/null || die "Docker не найден. Установите: https://docs.docker.com/get-docker/"
docker info &>/dev/null        || die "Docker не запущен. Запустите Docker Desktop или: sudo systemctl start docker"
ok "Docker работает"

# ── 2. Автозапуск Docker при перезагрузке сервера ────────────────
if command -v systemctl &>/dev/null && systemctl list-units --type=service &>/dev/null 2>&1; then
    if sudo systemctl enable docker &>/dev/null 2>&1; then
        ok "Docker настроен на автозапуск при перезагрузке"
    else
        warn "Не удалось настроить автозапуск Docker (нужен sudo). Запустите вручную: sudo systemctl enable docker"
    fi
fi

# ── 3. Создание файла .env ───────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    warn "Файл backend/.env уже существует — пропускаем создание"
else
    [ -f "$ENV_EXAMPLE" ] || die "Файл backend/.env.example не найден. Убедитесь, что вы в корне проекта."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    ok "Создан файл backend/.env из шаблона"
fi

# ── 4. Генерация SECRET_KEY ──────────────────────────────────────
CURRENT_KEY=$(grep "^DJANGO_SECRET_KEY=" "$ENV_FILE" | cut -d'=' -f2- || true)
if [ "$CURRENT_KEY" = "change-me-generate-with-setup-sh" ] || [ -z "$CURRENT_KEY" ]; then
    if command -v python3 &>/dev/null; then
        NEW_KEY=$(python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'!@#%^&*(-_=+)') for _ in range(64)))")
    elif command -v openssl &>/dev/null; then
        NEW_KEY=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
    else
        die "Нужен Python3 или openssl для генерации SECRET_KEY"
    fi
    TMP=$(mktemp)
    grep -v "^DJANGO_SECRET_KEY=" "$ENV_FILE" > "$TMP"
    echo "DJANGO_SECRET_KEY=$NEW_KEY" >> "$TMP"
    mv "$TMP" "$ENV_FILE"
    ok "Сгенерирован новый SECRET_KEY"
else
    warn "SECRET_KEY уже задан — пропускаем"
fi

# ── 5. Создание Docker-сети и volumes ────────────────────────────
docker network create pm_net 2>/dev/null && ok "Создана Docker-сеть pm_net" || warn "Сеть pm_net уже существует"
docker volume create pm_pg     > /dev/null && ok "Создан volume pm_pg (база данных)"      || warn "Volume pm_pg уже существует"
docker volume create pm_static > /dev/null && ok "Создан volume pm_static (статика)"      || warn "Volume pm_static уже существует"
docker volume create pm_media  > /dev/null && ok "Создан volume pm_media (загруженные файлы)" || warn "Volume pm_media уже существует"

# ── 6. PostgreSQL ────────────────────────────────────────────────
echo ""
echo "Запуск базы данных..."
if docker inspect pm_db &>/dev/null 2>&1; then
    warn "Контейнер pm_db уже существует — пропускаем создание"
    docker start pm_db &>/dev/null || true
else
    docker run -d \
        --name pm_db \
        --network pm_net \
        --restart always \
        -e POSTGRES_DB=pm_platform \
        -e POSTGRES_USER=pm \
        -e POSTGRES_PASSWORD=pm \
        -v pm_pg:/var/lib/postgresql/data \
        postgres:16-alpine > /dev/null
    ok "Контейнер pm_db запущен"
fi

# ── 7. Backend (Django + gunicorn) ───────────────────────────────
echo ""
echo "Сборка backend (первый раз займёт 2-3 минуты)..."
docker build -t pm_backend "$ROOT/backend"
ok "Образ pm_backend собран"

if docker inspect pm_backend_app &>/dev/null 2>&1; then
    warn "Контейнер pm_backend_app уже существует — пересоздаём"
    docker stop pm_backend_app &>/dev/null || true
    docker rm   pm_backend_app &>/dev/null || true
fi
docker run -d \
    --name pm_backend_app \
    --network pm_net \
    --restart always \
    --env-file "$ENV_FILE" \
    -v pm_static:/app/staticfiles \
    -v pm_media:/app/media \
    pm_backend > /dev/null
ok "Контейнер pm_backend_app запущен"

# ── 8. Frontend (React + nginx) ──────────────────────────────────
echo ""
echo "Сборка frontend (первый раз займёт 2-4 минуты)..."
docker build -t pm_frontend "$ROOT/frontend"
ok "Образ pm_frontend собран"

if docker inspect pm_frontend_app &>/dev/null 2>&1; then
    warn "Контейнер pm_frontend_app уже существует — пересоздаём"
    docker stop pm_frontend_app &>/dev/null || true
    docker rm   pm_frontend_app &>/dev/null || true
fi
docker run -d \
    --name pm_frontend_app \
    --network pm_net \
    --restart always \
    -p 80:80 \
    -v pm_static:/vol/static:ro \
    -v pm_media:/vol/media:ro \
    pm_frontend > /dev/null
ok "Контейнер pm_frontend_app запущен"

# ── 9. Ожидание готовности ───────────────────────────────────────
echo ""
echo "Ожидание запуска сервисов (миграции БД, сборка статики)..."
MAX=120; ELAPSED=0
until docker exec pm_backend_app python manage.py showmigrations --check > /dev/null 2>&1; do
    [ $ELAPSED -ge $MAX ] && { warn "Запуск занимает дольше обычного. Проверьте: docker logs pm_backend_app"; break; }
    printf "."; sleep 3; ELAPSED=$((ELAPSED+3))
done
echo ""

# ── 10. Итог ─────────────────────────────────────────────────────
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo ""
echo "================================================="
echo "  Готово! Приложение запущено."
echo "================================================="
echo ""
echo "  Откройте в браузере:"
echo "    http://localhost       (если запущено на этом компьютере)"
echo "    http://$IP   (если запущено на сервере)"
echo ""
echo "  Создать администратора:"
echo "    docker exec -it pm_backend_app python manage.py createsuperuser"
echo ""
echo "  Управление:"
echo "    Остановить всё:    docker stop pm_frontend_app pm_backend_app pm_db"
echo "    Запустить снова:   docker start pm_db pm_backend_app pm_frontend_app"
echo "    Логи backend:      docker logs -f pm_backend_app"
echo "    Логи frontend:     docker logs -f pm_frontend_app"
echo ""
echo "  Резервное копирование:"
echo "    bash backup.sh"
echo ""
