-- AlterTable: Add restart tracking fields to WorkflowExecution
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "parent_execution_id" TEXT;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "restarted_from_node_id" TEXT;

-- CreateIndex: Index for parent execution lookups
CREATE INDEX IF NOT EXISTS "workflow_executions_parent_execution_id_idx" ON "workflow_executions"("parent_execution_id");

-- AddForeignKey: Self-referential relation for execution restart tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_parent_execution_id_fkey'
    ) THEN
        ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_parent_execution_id_fkey" 
        FOREIGN KEY ("parent_execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable: Add full payload logging fields to WorkflowLog
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "input_data" JSONB;
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "output_data" JSONB;
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "variables_before" JSONB;
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "variables_after" JSONB;
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "http_request" JSONB;
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "http_response" JSONB;
ALTER TABLE "workflow_logs" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
