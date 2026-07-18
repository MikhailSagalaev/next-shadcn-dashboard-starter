-- @file: prisma/migrations/20260718120000_add_scheduled_workflow_runs/migration.sql
-- @description: Durable atomic claim ledger for scheduled per-user workflow runs.
-- @project: SaaS Bonus System
-- @created: 2026-07-18

-- CreateEnum
CREATE TYPE "ScheduledWorkflowRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "scheduled_workflow_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_version_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "status" "ScheduledWorkflowRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_run_workflow_version_user_bucket_key"
ON "scheduled_workflow_runs"("workflow_id", "workflow_version_id", "user_id", "bucket");

-- CreateIndex
CREATE INDEX "scheduled_workflow_runs_project_id_status_queued_at_idx"
ON "scheduled_workflow_runs"("project_id", "status", "queued_at");

-- CreateIndex
CREATE INDEX "scheduled_workflow_runs_status_updated_at_idx"
ON "scheduled_workflow_runs"("status", "updated_at");
