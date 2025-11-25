-- AlterTable: bonuses
-- Добавляем столбец referral_level в таблицу bonuses, если его нет
ALTER TABLE "bonuses" ADD COLUMN IF NOT EXISTS "referral_level" INTEGER;

