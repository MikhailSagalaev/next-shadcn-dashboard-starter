ALTER TABLE "partner_organizations"
  ADD COLUMN "first_purchase_discount_percent" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
  ADD COLUMN "first_purchase_discount_redeemed_at" TIMESTAMP(3);

ALTER TABLE "partner_organizations"
  ADD CONSTRAINT "partner_organizations_first_purchase_discount_percent_check"
  CHECK (
    "first_purchase_discount_percent" >= 0
    AND "first_purchase_discount_percent" <= 100
  );
