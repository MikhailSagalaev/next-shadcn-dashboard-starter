-- Add workflow limits to projects table
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow_max_steps" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow_timeout_ms" INTEGER NOT NULL DEFAULT 30000;
