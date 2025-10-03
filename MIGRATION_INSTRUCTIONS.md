# 📝 Инструкция по применению миграции БД

## Проблема
Необходимо добавить поле `metadata` в таблицу `admin_accounts` для хранения токенов восстановления пароля.

## Решение

### Вариант 1: Через pgAdmin или другой GUI инструмент

Выполните следующий SQL в вашей БД `bonus_system`:

```sql
-- Добавление поля metadata в admin_accounts
ALTER TABLE "public"."admin_accounts" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Если есть проблемы с индексом users_telegram_id_key, удаляем его
DROP INDEX IF EXISTS "public"."users_telegram_id_key";

-- Убеждаемся что composite unique index существует
CREATE UNIQUE INDEX IF NOT EXISTS "users_project_id_telegram_id_key" 
ON "public"."users"("project_id", "telegram_id");
```

### Вариант 2: Через psql командную строку

```powershell
# Замените пароль и параметры подключения на ваши
$env:PGPASSWORD="ваш_пароль"
psql -h localhost -p 5432 -U ваш_пользователь -d bonus_system -f apply-metadata-migration.sql
```

### Вариант 3: Через Docker (если БД в контейнере)

```powershell
docker exec -i your-postgres-container psql -U postgres -d bonus_system < apply-metadata-migration.sql
```

## Проверка

После применения миграции проверьте структуру таблицы:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admin_accounts' 
AND column_name = 'metadata';
```

Должно вернуть:
```
column_name | data_type | is_nullable
------------|-----------|------------
metadata    | jsonb     | YES
```

## Затем

После успешного применения миграции выполните:

```powershell
npx prisma generate
```

Это обновит Prisma клиент с новым полем.

---

**Статус**: ⏳ Миграция создана, ожидает применения
**Файл миграции**: `apply-metadata-migration.sql`

