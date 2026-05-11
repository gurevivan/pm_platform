#!/bin/sh
set -e

echo "Ожидание PostgreSQL на $POSTGRES_HOST:$POSTGRES_PORT..."
until python - <<'EOF'
import psycopg2, sys, os
try:
    psycopg2.connect(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
    )
    sys.exit(0)
except Exception:
    sys.exit(1)
EOF
do
    echo "  ...PostgreSQL ещё не готов, повтор через 2 секунды"
    sleep 2
done
echo "PostgreSQL готов."

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 60 \
    --access-logfile - \
    --error-logfile -
