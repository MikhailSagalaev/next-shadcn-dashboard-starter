-- Manual additive migration for plan 009 (in-app admin notification bell, core).
-- Apply directly because `prisma migrate dev` can't run on this repo (broken
-- shadow-DB replay of historical migrations).
--
-- Production-safe: ONLY adds two new enums, a new table, indexes and FKs.
-- Nothing is dropped or rewritten. Idempotent — safe to re-run.
--
-- Apply:
--   npx prisma db execute --file prisma/manual/20260623_admin_notifications.sql --schema prisma/schema.prisma
--   npx prisma generate

BEGIN;

-- ── 009: AdminNotificationType enum ────────────────────────────────────────
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 009: AdminNotificationSeverity enum ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AdminNotificationSeverity" AS ENUM
    ('info', 'success', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 009: admin_notifications table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id"               TEXT NOT NULL,
  "admin_account_id" TEXT NOT NULL,
  "project_id"       TEXT,
  "type"             "AdminNotificationType" NOT NULL,
  "severity"         "AdminNotificationSeverity" NOT NULL DEFAULT 'info',
  "title"            TEXT NOT NULL,
  "message"          TEXT NOT NULL,
  "link"             TEXT,
  "metadata"         JSONB,
  "dedupe_key"       TEXT,
  "read_at"          TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_notifications_admin_account_id_read_at_idx"
  ON "admin_notifications" ("admin_account_id", "read_at");
CREATE INDEX IF NOT EXISTS "admin_notifications_admin_account_id_created_at_idx"
  ON "admin_notifications" ("admin_account_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "admin_notifications"
    ADD CONSTRAINT "admin_notifications_admin_account_id_fkey"
    FOREIGN KEY ("admin_account_id") REFERENCES "admin_accounts" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "admin_notifications"
    ADD CONSTRAINT "admin_notifications_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
