-- CreateEnum
CREATE TYPE "OrderAccountingState" AS ENUM (
  'LEGACY',
  'NOT_APPLIED',
  'APPLYING',
  'APPLIED',
  'REVERSING',
  'REVERSED',
  'PARTIALLY_REVERSED'
);

-- AlterTable: the default applies to future orders; existing rows are marked LEGACY below.
ALTER TABLE "orders"
  ADD COLUMN "accounting_state" "OrderAccountingState" NOT NULL DEFAULT 'NOT_APPLIED',
  ADD COLUMN "accounted_purchase_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "accounted_earn_base" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "accounted_spent_bonus_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "accounted_at" TIMESTAMP(3),
  ADD COLUMN "reversed_at" TIMESTAMP(3),
  ADD COLUMN "reversal_shortfall" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "orders"
SET "accounting_state" = 'LEGACY';
