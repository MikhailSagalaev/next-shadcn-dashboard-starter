-- Manual additive migration for plans 005 + 007 (partner_parent_id, payouts,
-- referral_programs payout settings). Apply directly because `prisma migrate dev`
-- can't run on this repo (broken shadow-DB replay of historical migrations).
--
-- Production-safe: ONLY adds a nullable column, a new table, and two columns with
-- defaults. Nothing is dropped or rewritten. Idempotent — safe to re-run.
--
-- Apply:
--   npx prisma db execute --file prisma/manual/20260623_partner_payouts.sql --schema prisma/schema.prisma
--   npx prisma generate

BEGIN;

-- ── 005: explicit payout parent ────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partner_parent_id" TEXT;

CREATE INDEX IF NOT EXISTS "users_project_id_partner_parent_id_idx"
  ON "users" ("project_id", "partner_parent_id");

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_partner_parent_id_fkey"
    FOREIGN KEY ("partner_parent_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 007: referral program payout settings ──────────────────────────────────
ALTER TABLE "referral_programs"
  ADD COLUMN IF NOT EXISTS "payout_min_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "referral_programs"
  ADD COLUMN IF NOT EXISTS "payout_hold_days" INTEGER NOT NULL DEFAULT 0;

-- ── 007: PayoutStatus enum ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM
    ('requested', 'approved', 'paid', 'rejected', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 007: payouts table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payouts" (
  "id"                  TEXT NOT NULL,
  "project_id"          TEXT NOT NULL,
  "user_id"             TEXT NOT NULL,
  "amount"              DECIMAL(10,2) NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'RUB',
  "status"              "PayoutStatus" NOT NULL DEFAULT 'requested',
  "request_source"      TEXT NOT NULL DEFAULT 'telegram_bot',
  "request_telegram_id" BIGINT,
  "payout_method"       TEXT,
  "payout_details"      JSONB,
  "requested_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by"         TEXT,
  "reviewed_at"         TIMESTAMP(3),
  "reject_reason"       TEXT,
  "paid_at"             TIMESTAMP(3),
  "paid_by"             TEXT,
  "fail_reason"         TEXT,
  "cancelled_at"        TIMESTAMP(3),
  "external_ref"        TEXT,
  "external_id"         TEXT,
  "ledger_batch_id"     TEXT,
  "metadata"            JSONB DEFAULT '{}',
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_external_id_key"
  ON "payouts" ("external_id");
CREATE INDEX IF NOT EXISTS "payouts_project_id_status_idx"
  ON "payouts" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "payouts_project_id_user_id_status_idx"
  ON "payouts" ("project_id", "user_id", "status");

DO $$ BEGIN
  ALTER TABLE "payouts"
    ADD CONSTRAINT "payouts_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payouts"
    ADD CONSTRAINT "payouts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
