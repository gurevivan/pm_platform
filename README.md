# PM Platform

Система управления проектами: задачи, Kanban-доска, диаграмма Ганта, чат, управление командой.

---

## Что нужно установить

Для запуска приложения нужен только **Docker** — всё остальное (Python, Node.js, PostgreSQL) он установит автоматически внутри контейнеров.

### Установка Docker

| Система | Ссылка |
|---|---|
| Windows / macOS | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Ubuntu / Debian | `sudo apt-get update && sudo apt-get install -y docker.io && sudo systemctl enable --now docker` |
| Другой Linux | [Инструкция](https://docs.docker.com/engine/install/) |

Проверьте установку:
```bash
docker --version
```
Должно показать что-то вроде: `Docker version 24.0.0, build abc123`

> **Windows / macOS**: после установки откройте Docker Desktop и дождитесь, пока значок в трее перестанет крутиться (это означает, что Docker запущен).

---

## Установка и запуск

### Шаг 1 — скачать проект

```bash
git clone https://github.com/gurevivan/pm_platform.git
cd pm_platform
```

> Если git не установлен: скачайте [архив проекта](https://github.com/gurevivan/pm_platform/archive/refs/heads/main.zip), распакуйте и перейдите в папку.

### Шаг 2 — запустить установку

```bash
bash setup.sh
```

Скрипт автоматически:
- Создаст файл настроек `backend/.env`
- Сгенерирует секретный ключ
- Скачает и соберёт все Docker-образы (первый раз займёт **3–7 минут**)
- Запустит базу данных, backend и frontend
- Настроит автоматический запуск при перезагрузке сервера

### Шаг 3 — открыть приложение

После завершения setup.sh откройте браузер:

- **Локальный компьютер**: http://localhost
- **Удалённый сервер**: http://IP-АДРЕС-СЕРВЕРА

---

## Первый вход — создание администратора

После первого запуска создайте учётную запись администратора:

```bash
docker exec -it pm_backend_app python manage.py createsuperuser
```

Введите имя пользователя, email и пароль. После этого можно войти в приложение.

Панель администратора (управление пользователями, ролями): http://localhost/admin/

---

## Управление

### Остановить приложение
```bash
docker stop pm_frontend_app pm_backend_app pm_db
```

### Запустить снова (после остановки)
```bash
docker start pm_db pm_backend_app pm_frontend_app
```

### Перезапустить (например, после изменения настроек)
```bash
docker restart pm_backend_app pm_frontend_app
```

### Просмотр логов
```bash
# Логи backend (Django)
docker logs -f pm_backend_app

# Логи frontend (nginx)
docker logs -f pm_frontend_app

# Логи базы данных
docker logs -f pm_db
```
Нажмите `Ctrl+C` для выхода из просмотра логов.

### Проверить статус контейнеров
```bash
docker ps
```
Все три контейнера должны быть в статусе `Up`.

---

## Обновление до новой версии

```bash
# 1. Скачать обновления
git pull

# 2. Пересобрать образы и перезапустить
docker stop pm_backend_app pm_frontend_app
docker rm   pm_backend_app pm_frontend_app
docker rmi  pm_backend pm_frontend

bash setup.sh
```

> Данные в базе данных и загруженные файлы при обновлении **не удаляются** — они хранятся в Docker volumes.

---

## Резервное копирование

### Создать резервную копию

```bash
bash backup.sh
```

Создаёт папку в `backups/` с датой и временем. Содержит:
- `db.sql.gz` — база данных
- `media.tar.gz` — загруженные файлы (вложения в чат, аватары и т.д.)
- `env.bak` — файл настроек

Последние 7 копий хранятся автоматически, старые удаляются.

### Восстановить из резервной копии

```bash
bash restore.sh ./backups/2024-01-15_143022
```

Замените дату на нужную. Список всех копий:
```bash
ls backups/
```

---

## Настройка для удалённого сервера

Если приложение запущено не на вашем компьютере, а на сервере, нужно указать его IP-адрес в настройках.

### Узнать IP-адрес сервера

```bash
hostname -I
```

### Изменить файл настроек

Откройте файл `backend/.env` и замените `localhost` на IP-адрес:

```env
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100
CORS_ALLOWED_ORIGINS=http://192.168.1.100
CSRF_TRUSTED_ORIGINS=http://192.168.1.100
```

### Перезапустить backend

```bash
docker restart pm_backend_app
```

После этого приложение будет доступно по адресу `http://192.168.1.100`.

---

## Частые ошибки и решения

| Ошибка | Причина | Решение |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker не запущен | `sudo systemctl start docker` (Linux) или откройте Docker Desktop |
| `port is already allocated` | Порт 80 занят другой программой | Остановите nginx/apache: `sudo systemctl stop nginx` |
| `no such file: backend/.env` | Не создан файл настроек | Запустите `bash setup.sh` |
| Белый экран в браузере | Frontend ещё собирается | Подождите 1-2 минуты и обновите страницу |
| `502 Bad Gateway` | Backend ещё запускается | Подождите 1-2 минуты (идут миграции БД) |
| `Invalid HTTP_HOST header` | IP не добавлен в ALLOWED_HOSTS | Добавьте IP в `backend/.env` (см. раздел выше) |
| Забыли пароль администратора | — | `docker exec -it pm_backend_app python manage.py changepassword admin` |

### Просмотр подробных ошибок

```bash
docker logs pm_backend_app
```

---

## Структура проекта

```
pm_platform/
├── backend/          # Django REST API (Python)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── .env.example  # шаблон настроек
│   └── requirements.txt
├── frontend/         # React + TypeScript (Vite)
│   ├── Dockerfile
│   └── nginx.conf
├── setup.sh          # установка и первый запуск
├── backup.sh         # резервное копирование
├── restore.sh        # восстановление из копии
└── backups/          # папка с резервными копиями (создаётся автоматически)
```

---

## Локальная разработка (без Docker)

Для разработки используйте `dev.sh` — он запускает Django и Vite напрямую:

```bash
# Требования: Python 3.12+, Node.js 20+
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# Отредактируйте .env: DJANGO_DEBUG=1, USE_POSTGRES=0 (SQLite)
cd ..
bash dev.sh
```

Приложение будет доступно на http://localhost:5173
