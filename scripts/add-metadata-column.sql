-- Добавление поля metadata в таблицу bonuses
-- Выполнить в базе данных bonus_system

ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Проверить, что колонка добавлена
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'bonuses' AND column_name = 'metadata';
