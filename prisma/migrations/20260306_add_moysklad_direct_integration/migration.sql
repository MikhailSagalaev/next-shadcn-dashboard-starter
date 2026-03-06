-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "SyncDirection" AS ENUM ('BIDIRECTIONAL', 'MOYSKLAD_TO_US', 'US_TO_MOYSKLAD');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "moysklad_direct_integrations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "api_token" TEXT NOT NULL,
    "bonus_program_id" TEXT NOT NULL,
    "sync_direction" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "auto_sync" BOOLEAN NOT NULL DEFAULT true,
    "webhook_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moysklad_direct_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "moysklad_direct_sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "moysklad_transaction_id" TEXT,
    "user_id" TEXT,
    "amount" DECIMAL(10,2),
    "request_data" JSONB,
    "response_data" JSONB,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moysklad_direct_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "moysklad_direct_integrations_project_id_key" ON "moysklad_direct_integrations"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "moysklad_direct_integrations_webhook_secret_key" ON "moysklad_direct_integrations"("webhook_secret");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moysklad_direct_integrations_project_id_idx" ON "moysklad_direct_integrations"("project_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moysklad_direct_integrations_webhook_secret_idx" ON "moysklad_direct_integrations"("webhook_secret");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moysklad_direct_sync_logs_integration_id_idx" ON "moysklad_direct_sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moysklad_direct_sync_logs_user_id_idx" ON "moysklad_direct_sync_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moysklad_direct_sync_logs_created_at_idx" ON "moysklad_direct_sync_logs"("created_at");

-- AddForeignKey
ALTER TABLE "moysklad_direct_integrations" ADD CONSTRAINT "moysklad_direct_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_direct_sync_logs" ADD CONSTRAINT "moysklad_direct_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "moysklad_direct_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_direct_sync_logs" ADD CONSTRAINT "moysklad_direct_sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
