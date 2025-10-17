-- Migration: Add Workflow Tables
-- Generated SQL for workflow_versions, workflow_executions, workflow_logs, workflow_variables

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."workflow_versions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nodes" JSONB NOT NULL,
    "entry_node_id" TEXT NOT NULL,
    "variables" JSONB,
    "settings" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."workflow_executions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "telegram_chat_id" TEXT,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error" TEXT,
    "step_count" INTEGER,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."workflow_logs" (
    "id" BIGSERIAL NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "workflow_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."workflow_variables" (
    "id" BIGSERIAL NOT NULL,
    "project_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "user_id" TEXT,
    "session_id" TEXT,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_variables_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "workflow_versions_workflow_id_is_active_idx" ON "public"."workflow_versions"("workflow_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_workflow_id_version_key" ON "public"."workflow_versions"("workflow_id", "version");

CREATE INDEX IF NOT EXISTS "workflow_executions_project_id_workflow_id_started_at_idx" ON "public"."workflow_executions"("project_id", "workflow_id", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_executions_session_id_idx" ON "public"."workflow_executions"("session_id");

CREATE INDEX IF NOT EXISTS "workflow_logs_execution_id_step_idx" ON "public"."workflow_logs"("execution_id", "step");
CREATE INDEX IF NOT EXISTS "workflow_logs_timestamp_idx" ON "public"."workflow_logs"("timestamp");

CREATE INDEX IF NOT EXISTS "workflow_variables_project_id_scope_key_idx" ON "public"."workflow_variables"("project_id", "scope", "key");
CREATE INDEX IF NOT EXISTS "workflow_variables_expires_at_idx" ON "public"."workflow_variables"("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_variables_project_id_workflow_id_user_id_session_i_key" ON "public"."workflow_variables"("project_id", "workflow_id", "user_id", "session_id", "scope", "key");

-- Add foreign keys (only if tables exist)
DO $$
BEGIN
    -- Add FK for workflow_versions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
        ALTER TABLE "public"."workflow_versions"
        ADD CONSTRAINT "workflow_versions_workflow_id_fkey"
        FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add FK for workflow_executions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
        ALTER TABLE "public"."workflow_executions"
        ADD CONSTRAINT "workflow_executions_workflow_id_fkey"
        FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add FK for workflow_logs
    ALTER TABLE "public"."workflow_logs"
    ADD CONSTRAINT "workflow_logs_execution_id_fkey"
    FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    -- Add FK for workflow_variables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE "public"."workflow_variables"
        ADD CONSTRAINT "workflow_variables_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
        ALTER TABLE "public"."workflow_variables"
        ADD CONSTRAINT "workflow_variables_workflow_id_fkey"
        FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
