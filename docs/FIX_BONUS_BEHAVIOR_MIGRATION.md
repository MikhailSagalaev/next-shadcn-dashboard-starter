# Исправление миграции bonus_behavior

## Проблема
После добавления поля `bonusBehavior` в Prisma схему, колонка `bonus_behavior` не существует в базе данных, что вызывает ошибку:
```
The column `projects.bonus_behavior` does not exist in the current database.
```

## Решение

### Вариант 1: Применить миграцию через Prisma (рекомендуется)

```bash
# Проверить статус миграций
npx prisma migrate status

# Применить миграцию вручную
npx prisma migrate deploy

# Если миграция не применяется, применить конкретную миграцию
npx prisma migrate resolve --applied 20250923083509_add_bonus_behavior_setting
npx prisma migrate deploy
```

### Вариант 2: Применить SQL вручную через psql

Подключиться к БД и выполнить:

```sql
-- Создать enum если не существует
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusBehavior') THEN
        CREATE TYPE "BonusBehavior" AS ENUM ('spend_and_earn', 'spend_only', 'earn_only');
    END IF;
END $$;

-- Добавить колонку если не существует
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'bonus_behavior'
    ) THEN
        ALTER TABLE "projects" 
        ADD COLUMN "bonus_behavior" "BonusBehavior" NOT NULL DEFAULT 'spend_and_earn';
    END IF;
END $$;
```

### Вариант 3: Использовать готовый скрипт

```bash
# На сервере
psql -h localhost -p 5440 -U your_user -d bonus_system -f scripts/add_bonus_behavior_column.sql
```

## После применения миграции

1. Перегенерировать Prisma Client:
```bash
npx prisma generate
```

2. Перезапустить приложение:
```bash
pm2 restart all
```

## Проверка

Проверить, что колонка добавлена:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'bonus_behavior';
```

Должно вернуться:
```
column_name      | data_type       | column_default
-----------------|-----------------|------------------
bonus_behavior   | USER-DEFINED   | 'spend_and_earn'::BonusBehavior
```

