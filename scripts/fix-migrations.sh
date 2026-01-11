#!/bin/bash
# Скрипт для исправления проблем с миграциями Prisma
# Использование: bash scripts/fix-migrations.sh

set -e

echo "🔧 Исправление проблем с миграциями Prisma..."

# Загружаем переменные окружения
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Файл .env не найден"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL не найден в .env"
    exit 1
fi

echo "📊 Проверяем статус миграций..."

# Извлекаем параметры подключения из DATABASE_URL
# Формат: postgresql://user:password@host:port/database
if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASSWORD="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    
    echo "📝 Параметры подключения:"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    
    # SQL для исправления
    SQL="UPDATE \"_prisma_migrations\" 
SET rolled_back_at = NOW()
WHERE migration_name = '20251205_add_operation_mode' 
  AND finished_at IS NULL;"
    
    echo ""
    echo "🔄 Помечаем неудавшуюся миграцию как откаченную..."
    
    # Выполняем SQL
    export PGPASSWORD="$DB_PASSWORD"
    echo "$SQL" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    
    if [ $? -eq 0 ]; then
        echo "✅ Миграция помечена как откаченная"
    else
        echo "⚠️  Ошибка выполнения SQL"
        echo "Выполните SQL вручную:"
        echo "$SQL"
    fi
else
    echo "⚠️  Не удалось распарсить DATABASE_URL"
    echo "Выполните SQL вручную из scripts/fix-failed-migration.sql"
fi

echo ""
echo "🔄 Пробуем применить миграции снова..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Миграции успешно применены!"
    
    echo ""
    echo "🔄 Генерируем Prisma Client..."
    npx prisma generate
    
    echo ""
    echo "🔄 Перезапускаем PM2..."
    pm2 restart all
    
    echo ""
    echo "✅ Готово! Проверьте логи:"
    echo "   pm2 logs --lines 20"
else
    echo "❌ Ошибка применения миграций"
    echo "Попробуйте выполнить SQL вручную из scripts/fix-failed-migration.sql"
    exit 1
fi
