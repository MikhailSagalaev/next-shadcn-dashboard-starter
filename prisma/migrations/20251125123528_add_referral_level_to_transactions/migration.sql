-- AlterTable: transactions
-- Добавляем столбец referral_level в таблицу transactions, если его нет
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "referral_level" INTEGER;

