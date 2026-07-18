-- @file: prisma/migrations/20260718130000_harden_telegram_delivery/migration.sql
-- @description: Add Telegram delivery observability, retry metadata, and recipient idempotency.
-- @project: SaaS Bonus System
-- @created: 2026-07-18

-- Deduplicate only recipients with a non-null user_id and preserve their dependent records.
CREATE TEMP TABLE "_mailing_recipient_dedupe" AS
SELECT "id" AS "duplicate_id",
       MIN("id") OVER (PARTITION BY "mailing_id", "user_id") AS "keeper_id",
       COUNT(*) OVER (PARTITION BY "mailing_id", "user_id") AS "duplicate_count"
FROM "mailing_recipients"
WHERE "user_id" IS NOT NULL;

UPDATE "mailing_history" AS "history"
SET "recipient_id" = "dedupe"."keeper_id"
FROM "_mailing_recipient_dedupe" AS "dedupe"
WHERE "history"."recipient_id" = "dedupe"."duplicate_id"
  AND "dedupe"."duplicate_count" > 1
  AND "dedupe"."duplicate_id" <> "dedupe"."keeper_id";

UPDATE "mailing_link_clicks" AS "click"
SET "recipient_id" = "dedupe"."keeper_id"
FROM "_mailing_recipient_dedupe" AS "dedupe"
WHERE "click"."recipient_id" = "dedupe"."duplicate_id"
  AND "dedupe"."duplicate_count" > 1
  AND "dedupe"."duplicate_id" <> "dedupe"."keeper_id";

DELETE FROM "mailing_recipients" AS "recipient"
USING "_mailing_recipient_dedupe" AS "dedupe"
WHERE "recipient"."id" = "dedupe"."duplicate_id"
  AND "dedupe"."duplicate_count" > 1
  AND "dedupe"."duplicate_id" <> "dedupe"."keeper_id";

DROP TABLE "_mailing_recipient_dedupe";

-- AlterTable
ALTER TABLE "mailing_recipients"
ADD COLUMN "error_code" INTEGER,
ADD COLUMN "error_description" TEXT,
ADD COLUMN "retry_after" INTEGER,
ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "max_attempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "job_id" TEXT,
ADD COLUMN "telegram_message_id" TEXT,
ADD COLUMN "last_attempt_at" TIMESTAMP(3);

ALTER TABLE "notifications"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "error" TEXT,
ADD COLUMN "error_code" INTEGER,
ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "provider_message_id" TEXT,
ADD COLUMN "last_attempt_at" TIMESTAMP(3);

-- PostgreSQL unique indexes permit multiple NULL user_id values and match Prisma @@unique semantics.
CREATE UNIQUE INDEX "mailing_recipients_mailing_id_user_id_key" ON "mailing_recipients"("mailing_id", "user_id");
CREATE INDEX "mailing_recipients_mailing_id_status_last_attempt_at_idx" ON "mailing_recipients"("mailing_id", "status", "last_attempt_at");
CREATE INDEX "mailings_status_scheduled_at_idx" ON "mailings"("status", "scheduled_at");
CREATE INDEX "notifications_project_id_status_created_at_idx" ON "notifications"("project_id", "status", "created_at");
CREATE INDEX "notifications_user_id_channel_idx" ON "notifications"("user_id", "channel");
