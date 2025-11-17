#!/bin/bash

# Скрипт восстановления и оптимизации VPS после сбоя
# Запускать после перезагрузки сервера

echo "🔧 Начинаем восстановление и оптимизацию VPS..."

# 1. Создание swap файла (если его нет)
echo "💾 Проверка и создание swap..."
if [ ! -f /swapfile ]; then
    echo "Создаем swap файл 2GB..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ Swap создан"
else
    echo "Swap уже существует"
    swapon -s
fi

# 2. Оптимизация памяти
echo "🧹 Очистка памяти..."
sync
echo 3 > /proc/sys/vm/drop_caches

# 3. Установка Node.js и pnpm (если еще не установлены)
echo "📦 Проверка Node.js..."
if ! command -v node &> /dev/null; then
    echo "Установка Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt install -y nodejs
fi

if ! command -v pnpm &> /dev/null; then
    echo "Установка pnpm..."
    npm install -g pnpm
fi

# 4. Настройка лимитов для Node.js
echo "⚙️ Настройка лимитов системы..."
cat >> /etc/security/limits.conf << EOF
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF

# 5. Оптимизация pnpm
echo "🚀 Оптимизация pnpm..."
pnpm config set store-dir /root/.pnpm-store
pnpm config set max-sockets 3
pnpm config set network-concurrency 2
pnpm config set child-concurrency 2

# 6. Безопасная установка зависимостей
echo "📦 Переход к проекту..."
cd /opt/next-shadcn-dashboard-starter

# Удаляем старые node_modules и lock файлы если есть
echo "🧹 Очистка старых файлов..."
rm -rf node_modules
rm -rf .next
rm -rf dist

# Установка с ограничением ресурсов
echo "📦 Установка зависимостей с ограничениями..."
export NODE_OPTIONS="--max-old-space-size=1024"

# Используем npm вместо pnpm для первичной установки (менее требователен к памяти)
echo "Используем npm для установки (более стабильно на слабых VPS)..."
npm install --legacy-peer-deps

echo "✅ Восстановление завершено!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте статус: free -h"
echo "2. Продолжите установку: cd /opt/next-shadcn-dashboard-starter"
echo "3. Настройте .env.production файл"
echo "4. Выполните: npm run build"
echo "5. Запустите: pm2 start npm -- start"