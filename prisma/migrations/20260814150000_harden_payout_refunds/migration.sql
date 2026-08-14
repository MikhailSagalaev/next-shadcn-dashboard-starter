ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'refund_pending';

ALTER TABLE "payouts"
ADD COLUMN IF NOT EXISTS "refund_target_status" "PayoutStatus",
ADD COLUMN IF NOT EXISTS "refund_completed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payouts_status_updated_at_idx"
ON "payouts"("status", "updated_at");
