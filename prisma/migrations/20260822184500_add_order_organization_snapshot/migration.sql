ALTER TABLE "orders"
ADD COLUMN "organization_id" TEXT;

-- Existing orders predate the immutable snapshot. Use the explicit referral
-- attribution first and the legacy user organization only as a fallback.
UPDATE "orders" AS "order_row"
SET "organization_id" = COALESCE(
  (
    SELECT "attribution"."organization_id"
    FROM "referral_attributions" AS "attribution"
    INNER JOIN "partner_organizations" AS "attribution_org"
      ON "attribution_org"."id" = "attribution"."organization_id"
      AND "attribution_org"."project_id" = "order_row"."project_id"
    WHERE "attribution"."user_id" = "order_row"."user_id"
      AND "attribution"."project_id" = "order_row"."project_id"
    LIMIT 1
  ),
  (
    SELECT "user_row"."organization_id"
    FROM "users" AS "user_row"
    INNER JOIN "partner_organizations" AS "user_org"
      ON "user_org"."id" = "user_row"."organization_id"
      AND "user_org"."project_id" = "order_row"."project_id"
    WHERE "user_row"."id" = "order_row"."user_id"
      AND "user_row"."project_id" = "order_row"."project_id"
    LIMIT 1
  )
)
WHERE "order_row"."organization_id" IS NULL
  AND "order_row"."user_id" IS NOT NULL;

CREATE INDEX "orders_organization_id_accounted_at_idx"
ON "orders"("organization_id", "accounted_at");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "partner_organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
