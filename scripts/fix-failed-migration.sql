-- Скрипт для исправления проблемы с неудавшейся миграцией
-- Выполните этот скрипт напрямую в PostgreSQL

-- 1. Проверяем статус миграций
SELECT migration_name, finished_at, rolled_back_at, started_at 
FROM "_prisma_migrations" 
WHERE migration_name LIKE '%operation_mode%'
ORDER BY started_at DESC;

-- 2. Помечаем неудавшуюся миграцию как откаченную
UPDATE "_prisma_migrations" 
SET rolled_back_at = NOW()
WHERE migration_name = '20251205_add_operation_mode' 
  AND finished_at IS NULL;

-- 3. Или удаляем запись о неудавшейся миграции (если она не нужна)
-- DELETE FROM "_prisma_migrations" 
-- WHERE migration_name = '20251205_add_operation_mode' 
--   AND finished_at IS NULL;

-- 4. Проверяем, что поля operation_mode уже существуют
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name IN ('operation_mode');

-- 5. Если поле operation_mode отсутствует, добавляем его
-- ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "operation_mode" TEXT NOT NULL DEFAULT 'WITH_BOT';

-- 6. Добавляем workflow поля
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow_max_steps" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow_timeout_ms" INTEGER NOT NULL DEFAULT 30000;
