-- AlterTable workflow_executions - добавление полей для состояния ожидания
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "current_node_id" TEXT;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "wait_type" TEXT;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "wait_payload" JSONB;

-- CreateIndex для быстрого поиска ожидающих выполнений
CREATE INDEX IF NOT EXISTS "workflow_executions_project_id_telegram_chat_id_status_idx" 
ON "workflow_executions"("project_id", "telegram_chat_id", "status");

