# 🚀 Руководство по развертыванию на VPS

## 📋 Требования к VPS

### Минимальные требования:
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **Диск**: 20 GB SSD
- **ОС**: Ubuntu 22.04 LTS / Debian 11
- **Сеть**: Публичный IP адрес

### Рекомендуемые требования:
- **CPU**: 4 vCPU
- **RAM**: 8 GB
- **Диск**: 40 GB SSD
- **ОС**: Ubuntu 22.04 LTS
- **Сеть**: Публичный IP + домен

### Провайдеры VPS:
- DigitalOcean ($24/месяц)
- Hetzner (€8/месяц)
- Linode ($24/месяц)
- Vultr ($24/месяц)
- Contabo (€8/месяц)

## 🎯 Быстрое развертывание (Docker)

### Шаг 1: Подключение к VPS

```bash
ssh root@your-vps-ip
```

### Шаг 2: Установка Docker

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Проверка
docker --version
docker-compose --version
```

### Шаг 3: Клонирование проекта

```bash
# Установка git
apt install git -y

# Клонирование
cd /opt
git clone https://github.com/your-username/saas-bonus-system.git
cd saas-bonus-system
```

### Шаг 4: Настройка окружения

```bash
# Создание .env.production
cat > .env.production << 'EOF'
# Runtime
NODE_ENV="production"
PORT="3000"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Database
DATABASE_URL="postgresql://bonus_user:STRONG_PASSWORD_HERE@postgres:5432/bonus_system?schema=public"

# Redis
REDIS_URL="redis://redis:6379"
REDIS_HOST="redis"
REDIS_PORT="6379"

# Security
JWT_SECRET="$(openssl rand -base64 32)"
CRON_SECRET="$(openssl rand -base64 32)"

# Grafana + Loki (Monitoring)
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your_grafana_api_key_here
LOKI_URL=http://localhost:3100
EOF
```

### Шаг 5: Docker Compose Production

Создайте `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: bonus_user
      POSTGRES_PASSWORD: STRONG_PASSWORD_HERE
      POSTGRES_DB: bonus_system
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bonus_user -d bonus_system"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    restart: always
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app_network
    volumes:
      - ./public:/app/public:ro
      - ./prisma:/app/prisma:ro

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - certbot_data:/var/www/certbot
    depends_on:
      - app
    networks:
      - app_network

volumes:
  postgres_data:
  redis_data:
  certbot_data:

networks:
  app_network:
    driver: bridge
```

### Шаг 6: Dockerfile для production

Создайте `Dockerfile.production`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json yarn.lock ./
# Установка Yarn через corepack уже активирована в Dockerfile
RUN yarn install --immutable
RUN yarn dlx prisma generate
RUN yarn build
# перенос package*.json и yarn.lock
CMD ["yarn", "start"]
```

### Шаг 7: Nginx конфигурация

Создайте `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream nextjs {
        server app:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 10M;

        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /_next/static {
            proxy_pass http://nextjs;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }

        location /api {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Шаг 8: SSL сертификат (Let's Encrypt)

```bash
# Установка Certbot
apt install certbot python3-certbot-nginx -y

# Получение сертификата
certbot --nginx -d your-domain.com -d www.your-domain.com

# Автоматическое обновление
crontab -e
# Добавьте строку:
0 0 * * * certbot renew --quiet
```

### Шаг 9: Запуск приложения

```bash
# Сборка и запуск
docker-compose -f docker-compose.production.yml up -d --build

# Применение миграций
docker-compose -f docker-compose.production.yml exec app yarn prisma:migrate

# Проверка логов
docker-compose -f docker-compose.production.yml logs -f

# Проверка статуса
docker-compose -f docker-compose.production.yml ps
```

## 📝 Ручное развертывание (без Docker)

### Шаг 1: Подготовка системы

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка необходимых пакетов
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx
```

### Шаг 2: Установка Node.js

```bash
# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Включение Yarn через Corepack и установка PM2
npm install -g corepack pm2
corepack enable && corepack prepare yarn@stable --activate

# Проверка
node --version
yarn --version
```

### Шаг 3: Установка PostgreSQL

```bash
# Установка PostgreSQL
apt install -y postgresql postgresql-contrib

# Настройка
sudo -u postgres psql << EOF
CREATE DATABASE bonus_system;
CREATE USER bonus_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE bonus_system TO bonus_user;
EOF

# Настройка доступа
nano /etc/postgresql/14/main/postgresql.conf
# listen_addresses = 'localhost'

systemctl restart postgresql
```

### Шаг 4: Установка Redis

```bash
# Установка Redis
apt install -y redis-server

# Настройка
nano /etc/redis/redis.conf
# supervised systemd
# maxmemory 256mb
# maxmemory-policy allkeys-lru

systemctl restart redis-server
systemctl enable redis-server
```

### Шаг 5: Настройка приложения

```bash
# Создание пользователя
useradd -m -s /bin/bash nodeapp
su - nodeapp

# Клонирование проекта
cd /home/nodeapp
git clone https://github.com/your-username/saas-bonus-system.git
cd saas-bonus-system

# Установка зависимостей
yarn install

# Настройка окружения
cp env.example.txt .env.production
nano .env.production
# Настройте все переменные

# Сборка
yarn build

# Миграции
yarn prisma:migrate
```

### Шаг 6: PM2 конфигурация

Создайте `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'saas-bonus-system',
    script: 'node_modules/.bin/next',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

Запуск через PM2:

```bash
# Запуск
pm2 start ecosystem.config.js

# Сохранение конфигурации
pm2 save
pm2 startup systemd -u nodeapp --hp /home/nodeapp
```

### Шаг 7: Nginx настройка

```bash
# Создание конфигурации
nano /etc/nginx/sites-available/saas-bonus-system

# Содержимое:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Активация
ln -s /etc/nginx/sites-available/saas-bonus-system /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 🔒 Настройка безопасности

### 1. Firewall (UFW)

```bash
# Установка и настройка
apt install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 2. Fail2ban

```bash
# Установка
apt install -y fail2ban

# Конфигурация
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
nano /etc/fail2ban/jail.local

# Включите:
[sshd]
enabled = true
maxretry = 3
bantime = 3600

systemctl restart fail2ban
```

### 3. Автоматические обновления

```bash
# Установка
apt install -y unattended-upgrades

# Настройка
dpkg-reconfigure --priority=low unattended-upgrades
```

## 📊 Мониторинг

### 1. Системный мониторинг

```bash
# Установка htop
apt install -y htop

# Установка netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### 2. Логирование

```bash
# PM2 логи
pm2 logs

# Nginx логи
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL логи
tail -f /var/log/postgresql/postgresql-*.log
```

### 3. Мониторинг приложения

```bash
# PM2 мониторинг
pm2 monit

# Статус сервисов
systemctl status nginx
systemctl status postgresql
systemctl status redis-server
```

## 🔄 Обновление приложения

### Фактический PM2 deploy этого проекта

Этот раздел является каноническим сценарием для текущего production без Docker.

**Контекст:**
- SSH: `mixa@84.54.56.242`
- Ключ на Windows: `$env:USERPROFILE\.ssh\id_rsa_gupil`
- Проект: `/opt/next-shadcn-dashboard-starter`
- Ветка: `main`
- PM2 app: `bonus-app`
- Health-check: `http://127.0.0.1:3000/api/health`

Явная просьба пользователя выполнить deploy разрешает агенту пройти этот сценарий автономно. `.env` не изменяется автоматически, passphrase/private key не сохраняются.

#### 1. Preflight

```powershell
$sshKey = "$env:USERPROFILE\.ssh\id_rsa_gupil"
ssh -i $sshKey mixa@84.54.56.242 'cd /opt/next-shadcn-dashboard-starter && git status --short --branch && git rev-parse --short HEAD'
```

Сохраните существующие server-side изменения. Не используйте `reset --hard`, `git clean`, force push или автоматический stash. Если изменённый на сервере файл пересекается с релизом, сначала сделайте его резервную копию и примените обновление неразрушающим способом.

#### 2. Обновление кода

```bash
cd /opt/next-shadcn-dashboard-starter
git fetch origin main
git merge --ff-only origin/main
```

Если изменился lockfile, выполните `yarn install --immutable`. Если релиз содержит миграции или изменения Prisma schema:

```bash
npx prisma migrate deploy
npx prisma generate
```

#### 3. Единственная Webpack-сборка на low-memory VPS

Сначала убедитесь, что другая сборка не запущена:

```bash
pgrep -af "next build|yarn.*build" || true
```

Если список пуст, остановите приложение, очистите build output и запустите **ровно одну** фоновую сборку:

```bash
cd /opt/next-shadcn-dashboard-starter
pm2 stop bonus-app
rm -rf .next
mkdir -p logs
nohup env NEXT_PHASE=phase-production-build NODE_OPTIONS=--max-old-space-size=1536 yarn next build --webpack > logs/deploy-build.log 2>&1 &
echo $! > /tmp/bonus-build.pid
```

Контроль процесса:

```bash
BUILD_PID=$(cat /tmp/bonus-build.pid)
ps -p "$BUILD_PID" -o pid,etime,%cpu,%mem,cmd
tail -n 100 logs/deploy-build.log
```

Не запускайте второй build, даже если первый долго находится на compile/type-check этапе. Проверяйте его PID, CPU/RAM и лог. Успех подтверждается завершением процесса с code `0` и появлением build marker:

```bash
test -s .next/BUILD_ID
cat .next/BUILD_ID
```

#### 4. Запуск и smoke-check

Только после успешной сборки:

```bash
pm2 restart bonus-app --update-env
pm2 status bonus-app
curl -fsS http://127.0.0.1:3000/api/health
pm2 logs bonus-app --lines 100 --nostream
```

Проверьте статус `online`, отсутствие restart loop, healthy application/database и отсутствие startup-ошибок Redis/BullMQ/Prisma/Telegram/MAX.

#### 5. Fallback через минимальный Git bundle

Используйте только если сервер не может получить commit из remote Git (например, deploy key требует недоступный passphrase):

1. Определите server HEAD и создайте временную локальную ветку на deploy commit.
2. Создайте bundle, исключив уже имеющийся на сервере диапазон: `git bundle create deploy.bundle deploy-transfer ^<server-head>`.
3. Передайте его: `scp -i $sshKey deploy.bundle mixa@84.54.56.242:/tmp/deploy.bundle`.
4. На сервере: `git fetch /tmp/deploy.bundle deploy-transfer`, затем `git merge --ff-only FETCH_HEAD`.
5. Удалите временную ветку и bundle локально, а `/tmp/deploy.bundle` — на сервере.

Bundle переносит только Git-объекты. Не добавляйте в него `.env`, ключи, дампы БД или незакоммиченные файлы.

#### 6. PowerShell → SSH quoting

Для сложных remote-команд не используйте интерполируемую строку с незащищёнными `|`, `$()` или heredoc. Надёжный вариант:

```powershell
$remote = @'
set -e
cd /opt/next-shadcn-dashboard-starter
git status --short --branch
pm2 status bonus-app
'@
$remote | ssh -i $sshKey mixa@84.54.56.242 'bash -s'
```

Ошибочный quoting может выполнить часть pipeline локально или запустить второй build. Если лишний процесс уже появился, найдите его через `pgrep -af`, проверьте конкретный PID и завершите только этот PID.

### С Docker:

```bash
cd /opt/saas-bonus-system
git pull origin main
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build
docker-compose -f docker-compose.production.yml exec app yarn prisma:migrate
```

### Без Docker:

```bash
su - nodeapp
cd ~/saas-bonus-system
git pull origin main
yarn install
yarn build
yarn prisma:migrate
pm2 reload all
```

## 🔧 Backup и восстановление

### Backup базы данных:

```bash
# Создание backup
pg_dump -U bonus_user bonus_system > backup_$(date +%Y%m%d).sql

# Автоматический backup (crontab)
0 2 * * * pg_dump -U bonus_user bonus_system > /backups/db_$(date +\%Y\%m\%d).sql
```

### Восстановление:

```bash
psql -U bonus_user bonus_system < backup_20250128.sql
```

## 🐛 Решение проблем

### Проблема: 502 Bad Gateway

```bash
# Проверка приложения
pm2 status
pm2 logs

# Перезапуск
pm2 restart all
```

### Проблема: Нехватка памяти

```bash
# Добавление swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Проблема: Медленная работа

```bash
# Оптимизация PostgreSQL
nano /etc/postgresql/14/main/postgresql.conf
# shared_buffers = 256MB
# effective_cache_size = 1GB
# work_mem = 4MB

systemctl restart postgresql
```

## 📋 Чек-лист production

- [ ] SSL сертификат настроен
- [ ] Firewall включен
- [ ] Fail2ban настроен
- [ ] Backup настроен
- [ ] Мониторинг работает
- [ ] Логирование настроено
- [ ] Переменные окружения production
- [ ] Sentry подключен
- [ ] Redis пароль установлен
- [ ] PostgreSQL пароль сильный
- [ ] Автообновления включены

## 💰 Оптимизация расходов

1. **Используйте CDN** для статики (Cloudflare)
2. **Сжатие изображений** (WebP формат)
3. **Кэширование** на уровне Nginx
4. **Автомасштабирование** при необходимости

## 📞 Поддержка

При проблемах:
1. Проверьте логи: `pm2 logs`, `docker logs`
2. Проверьте статус: `systemctl status`, `docker ps`
3. Создайте issue на GitHub

---

*Последнее обновление: 28.01.2025*
*Версия: 1.2.0*