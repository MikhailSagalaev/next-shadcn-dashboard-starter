-- Add МойСклад integration fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "moysklad_counterparty_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMP(3);

-- Add unique constraint for moysklad_counterparty_id
CREATE UNIQUE INDEX IF NOT EXISTS "users_moysklad_counterparty_id_key" ON "users"("moysklad_counterparty_id");

-- Add МойСклад sale ID field to transactions table
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "moysklad_sale_id" TEXT;

-- Add index for moysklad_sale_id
CREATE INDEX IF NOT EXISTS "transactions_moysklad_sale_id_idx" ON "transactions"("moysklad_sale_id");
