-- Add moysklad_direct_counterparty_id column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "moysklad_direct_counterparty_id" TEXT;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "users_moysklad_direct_counterparty_id_key" ON "users"("moysklad_direct_counterparty_id");
