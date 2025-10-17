-- ==================================================
-- Миграция для добавления поля metadata в admin_accounts
-- Дата: 2025-01-28
-- Описание: Добавляет поле metadata JSONB для хранения токенов восстановления пароля
-- ==================================================

-- Добавление поля metadata в admin_accounts
ALTER TABLE "public"."admin_accounts" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Если есть проблемы с индексом users_telegram_id_key, удаляем его
DROP INDEX IF EXISTS "public"."users_telegram_id_key";

-- Убеждаемся что composite unique index существует
CREATE UNIQUE INDEX IF NOT EXISTS "users_project_id_telegram_id_key" 
ON "public"."users"("project_id", "telegram_id");

-- Проверяем что поле добавлено
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admin_accounts' 
AND column_name = 'metadata';
