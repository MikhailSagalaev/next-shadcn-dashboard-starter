#!/bin/bash

# МойСклад Direct - Исправление ошибки Server Action
# Дата: 2026-03-06

echo "🔧 Исправление ошибки Server Action..."
echo ""

# Остановить приложение
echo "1️⃣ Остановка приложения..."
pm2 stop all

# Очистить кеш
echo "2️⃣ Очистка кеша..."
rm -rf .next
rm -rf node_modules/.cache

# Генерация Prisma Client
echo "3️⃣ Генерация Prisma Client..."
npx prisma generate

# Сборка проекта
echo "4️⃣ Сборка проекта..."
yarn build

# Проверка успешности сборки
if [ $? -eq 0 ]; then
    echo "✅ Сборка успешна!"
else
    echo "❌ Ошибка сборки!"
    exit 1
fi

# Перезапуск приложения
echo "5️⃣ Перезапуск приложения..."
pm2 restart all

# Показать логи
echo "6️⃣ Логи приложения:"
pm2 logs --lines 20

echo ""
echo "🎉 Готово! Проверьте страницу интеграции:"
echo "https://gupil.ru/dashboard/projects/[PROJECT_ID]/integrations/moysklad-direct"
