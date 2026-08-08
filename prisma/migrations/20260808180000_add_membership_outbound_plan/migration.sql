ALTER TABLE "partner_organization_memberships"
ADD COLUMN "outbound_referral_plan_id" TEXT;

WITH membership_counts AS (
  SELECT "user_id", COUNT(*) AS membership_count
  FROM "partner_organization_memberships"
  GROUP BY "user_id"
)
UPDATE "partner_organization_memberships" AS membership
SET "outbound_referral_plan_id" = CASE
  WHEN counts.membership_count = 1
    THEN COALESCE("users"."outbound_referral_plan_id", organization."default_referral_commission_plan_id")
  WHEN "users"."outbound_referral_plan_id" = organization."default_referral_commission_plan_id"
    THEN "users"."outbound_referral_plan_id"
  ELSE organization."default_referral_commission_plan_id"
END
FROM membership_counts AS counts,
     "users",
     "partner_organizations" AS organization
WHERE membership."user_id" = counts."user_id"
  AND "users"."id" = membership."user_id"
  AND organization."id" = membership."organization_id";

CREATE INDEX "partner_organization_memberships_outbound_referral_plan_id_idx"
ON "partner_organization_memberships"("outbound_referral_plan_id");

ALTER TABLE "partner_organization_memberships"
ADD CONSTRAINT "partner_organization_memberships_outbound_referral_plan_id_fkey"
FOREIGN KEY ("outbound_referral_plan_id")
REFERENCES "referral_commission_plans"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
