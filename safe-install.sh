#!/bin/bash

# Безопасный скрипт установки для VPS с ограниченными ресурсами
# Использует npm вместо pnpm и оптимизирует потребление памяти

echo "🚀 Безопасная установка SaaS Bonus System"
echo "==========================================="

# Проверка доступной памяти
echo "📊 Текущее состояние системы:"
free -h
echo ""

# 1. Обязательно создаем swap если его нет
if [ ! -f /swapfile ]; then
    echo "⚠️ Swap не найден. Создаем swap 2GB..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ Swap создан"
else
    echo "✅ Swap уже существует"
fi

# 2. Установка базовых пакетов
echo "📦 Установка базовых пакетов..."
apt update
apt install -y curl wget git build-essential

# 3. Установка Node.js
if ! command -v node &> /dev/null; then
    echo "🟢 Установка Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt install -y nodejs
fi

# 4. Установка PM2 глобально
echo "📦 Установка PM2..."
npm install -g pm2

# 5. Установка PostgreSQL
echo "🐘 Установка PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Настройка БД
sudo -u postgres psql << EOF 2>/dev/null
CREATE DATABASE bonus_system;
CREATE USER bonus_user WITH PASSWORD 'SecurePass2025BonusSystem';
GRANT ALL PRIVILEGES ON DATABASE bonus_system TO bonus_user;
ALTER DATABASE bonus_system OWNER TO bonus_user;
\q
EOF

systemctl restart postgresql
systemctl enable postgresql

# 6. Установка Nginx
echo "🌐 Установка Nginx..."
apt install -y nginx

# 7. Переход к проекту
cd /opt/next-shadcn-dashboard-starter

# 8. Создание .env.production
echo "⚙️ Создание конфигурации..."
cat > .env.production << 'EOF'
DATABASE_URL="postgresql://bonus_user:SecurePass2025BonusSystem@localhost:5432/bonus_system"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="http://89.111.174.71"

# Clerk (keyless mode)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

# Security
CRON_SECRET="cron_$(openssl rand -hex 16)"
JWT_SECRET="jwt_$(openssl rand -hex 16)"

# Sentry
NEXT_PUBLIC_SENTRY_DISABLED="true"
EOF

# 9. Установка зависимостей с ограничениями
echo "📦 Установка зависимостей проекта..."
echo "⚠️ Это может занять 5-10 минут..."

# Ограничиваем память для Node.js
export NODE_OPTIONS="--max-old-space-size=1024"

# Очистка
rm -rf node_modules package-lock.json

# Используем npm с ограничениями
npm install --legacy-peer-deps --no-audit --no-fund

# 10. Генерация Prisma
echo "💾 Настройка базы данных..."
npx prisma generate
npx prisma migrate deploy

# 11. Сборка проекта
echo "🔨 Сборка приложения..."
npm run build

# 12. Настройка PM2
echo "⚙️ Настройка PM2..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'saas-bonus',
    script: 'npm',
    args: 'start',
    instances: 1,  // Только 1 инстанс для экономии памяти
    exec_mode: 'fork',  // fork вместо cluster
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NODE_OPTIONS: '--max-old-space-size=512'
    }
  }]
};
EOF

# 13. Запуск через PM2
echo "🚀 Запуск приложения..."
pm2 delete all 2>/dev/null
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# 14. Настройка Nginx
echo "🌐 Настройка Nginx..."
cat > /etc/nginx/sites-available/saas-bonus << 'EOF'
server {
    listen 80;
    server_name 89.111.174.71;
    
    client_max_body_size 10M;
    
    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;

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
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/saas-bonus /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 15. Настройка firewall
echo "🔒 Настройка безопасности..."
ufw --force disable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Финальная проверка
echo ""
echo "✅ Установка завершена!"
echo "==========================================="
echo "📊 Статус системы:"
free -h
echo ""
echo "📊 Статус приложения:"
pm2 status
echo ""
echo "🌐 Приложение доступно: http://89.111.174.71"
echo ""
echo "📝 Полезные команды:"
echo "  pm2 logs         - просмотр логов"
echo "  pm2 monit        - мониторинг в реальном времени"
echo "  pm2 restart all  - перезапуск приложения"
echo "  pm2 status       - статус процессов"
echo ""
echo "⚠️ Рекомендации:"
echo "1. Добавьте домен и настройте SSL"
echo "2. Получите production ключи от Clerk"
echo "3. Настройте резервное копирование БД"