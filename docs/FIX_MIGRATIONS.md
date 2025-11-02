# 🔧 Исправление проблем с миграциями Prisma на сервере

## Проблема
Обнаружены две ошибки миграций:
1. **P3009**: Миграция `20251002_add_metadata_to_admin_account` не завершилась (failed)
2. **P3006**: Миграция `20251015_add_workflow_execution_wait_fields` не может быть применена

## Решение

### Шаг 1: Проверка состояния миграций
```bash
npx prisma migrate status
```

### Шаг 2: Разрешение failed миграции (P3009)

Если миграция `20251002_add_metadata_to_admin_account` действительно была применена вручную или частично, нужно пометить её как примененную:

```bash
# Если миграция уже применена в БД, пометим её как успешную
npx prisma migrate resolve --applied 20251002_add_metadata_to_admin_account
```

### Шаг 3: Проверка таблицы admin_accounts

Убедитесь, что поле `metadata` существует:
```sql
-- Подключитесь к БД
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system

-- Проверьте структуру таблицы
\dt admin_accounts
\d admin_accounts

-- Или через SQL
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admin_accounts' 
AND column_name = 'metadata';
```

Если поле `metadata` отсутствует, примените миграцию вручную:
```sql
ALTER TABLE "public"."admin_accounts" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB;
```

### Шаг 4: Проверка таблицы workflow_executions

Проверьте, существует ли таблица `workflow_executions`:
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'workflow_executions'
);
```

Если таблицы нет, нужно найти и применить предыдущие миграции, которые её создают. Проверьте миграции в хронологическом порядке.

### Шаг 5: Применение миграций по порядку

Если некоторые миграции не были применены, примените их вручную:

```bash
# Примените все pending миграции
npx prisma migrate deploy
```

Если это не работает, проверьте порядок миграций:
```bash
ls -la prisma/migrations/
```

### Шаг 6: Полное исправление (если ничего не помогает)

Если проблемы сохраняются, выполните следующие шаги:

1. **Создайте резервную копию БД:**
```bash
pg_dump -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Проверьте состояние _prisma_migrations:**
```sql
SELECT * FROM "_prisma_migrations" 
ORDER BY started_at DESC 
LIMIT 10;
```

3. **Вручную исправьте запись о failed миграции:**
```sql
-- Найдите failed миграцию
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20251002_add_metadata_to_admin_account';

-- Если она в статусе failed, но изменения применены, обновите статус
UPDATE "_prisma_migrations" 
SET finished_at = NOW(), 
    applied_steps_count = (SELECT COUNT(*) FROM jsonb_array_elements(rolled_back_migration::jsonb))
WHERE migration_name = '20251002_add_metadata_to_admin_account' 
AND finished_at IS NULL;
```

4. **Или удалите запись о failed миграции (если она не была применена):**
```sql
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251002_add_metadata_to_admin_account' 
AND finished_at IS NULL;
```

5. **Повторно примените миграции:**
```bash
npx prisma migrate deploy
```

### Шаг 7: Альтернативный подход - применение через SQL

Если автоматические миграции не работают, примените их вручную:

```bash
# Примените миграцию через psql
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system \
  -f prisma/migrations/20251002_add_metadata_to_admin_account/migration.sql

# Затем пометьте как примененную
npx prisma migrate resolve --applied 20251002_add_metadata_to_admin_account
```

### Шаг 8: Проверка после исправления

После исправления проверьте:
```bash
# Проверьте статус
npx prisma migrate status

# Сгенерируйте Prisma Client
npx prisma generate

# Проверьте валидность схемы
npx prisma validate
```

## Быстрое решение (рекомендуется)

Выполните эти команды на сервере:

```bash
# 1. Подключитесь к БД и проверьте структуру
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system << EOF
-- Проверяем наличие metadata
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'admin_accounts' AND column_name = 'metadata';

-- Если не существует, добавляем
ALTER TABLE "public"."admin_accounts" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Проверяем workflow_executions
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'workflow_executions'
) as exists;
EOF

# 2. Разрешаем failed миграцию (если metadata уже добавлен)
npx prisma migrate resolve --applied 20251002_add_metadata_to_admin_account

# 3. Применяем оставшиеся миграции
npx prisma migrate deploy

# 4. Генерируем Prisma Client
npx prisma generate
```

## Если проблема с workflow_executions

Если таблица `workflow_executions` не существует, нужно применить предыдущие миграции, которые её создают. Проверьте миграции:
- `20250906203327_` - возможно, там создается workflow_executions

```bash
# Примените миграции вручную по порядку
for migration in prisma/migrations/*/migration.sql; do
  echo "Applying $migration"
  psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -f "$migration"
done
```

Или используйте Prisma напрямую:
```bash
npx prisma migrate resolve --applied <migration_name>
```

---

**⚠️ ВАЖНО:** Перед любыми действиями создайте резервную копию базы данных!

