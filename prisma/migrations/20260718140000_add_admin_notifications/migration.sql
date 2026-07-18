-- @file: prisma/migrations/20260718140000_add_admin_notifications/migration.sql
-- @description: Creates admin notification enums, table, indexes, and tenant relations.
-- @project: SaaS Bonus System
-- @dependencies: PostgreSQL, Prisma
-- @created: 2026-07-18
-- @author: AI Assistant + User

-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM (
  'payout_requested',
  'payout_cancelled',
  'referral_join_request',
  'new_partner',
  'integration_error',
  'subscription',
  'billing',
  'limit_reached',
  'new_user',
  'large_purchase',
  'system'
);

-- CreateEnum
CREATE TYPE "AdminNotificationSeverity" AS ENUM ('info', 'success', 'warning', 'error');

-- CreateTable
CREATE TABLE "admin_notifications" (
  "id" TEXT NOT NULL,
  "admin_account_id" TEXT NOT NULL,
  "project_id" TEXT,
  "type" "AdminNotificationType" NOT NULL,
  "severity" "AdminNotificationSeverity" NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "link" TEXT,
  "metadata" JSONB,
  "dedupe_key" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_notifications_admin_account_id_read_at_idx"
  ON "admin_notifications"("admin_account_id", "read_at");
CREATE INDEX "admin_notifications_admin_account_id_created_at_idx"
  ON "admin_notifications"("admin_account_id", "created_at");

-- AddForeignKey
ALTER TABLE "admin_notifications"
  ADD CONSTRAINT "admin_notifications_admin_account_id_fkey"
  FOREIGN KEY ("admin_account_id") REFERENCES "admin_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_notifications"
  ADD CONSTRAINT "admin_notifications_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
