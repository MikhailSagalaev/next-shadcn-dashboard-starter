CREATE TABLE "partner_organization_memberships" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "level" INTEGER,
  "title" TEXT,
  "can_manage" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "partner_organization_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_organization_memberships_level_check"
    CHECK ("level" IS NULL OR "level" >= 1),
  CONSTRAINT "partner_organization_memberships_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "partner_organization_memberships_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "partner_organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "partner_organization_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "partner_organization_memberships_organization_id_user_id_key"
  ON "partner_organization_memberships"("organization_id", "user_id");
CREATE INDEX "partner_organization_memberships_project_id_user_id_idx"
  ON "partner_organization_memberships"("project_id", "user_id");
CREATE INDEX "partner_organization_memberships_organization_id_can_manage_idx"
  ON "partner_organization_memberships"("organization_id", "can_manage");

CREATE TABLE "partner_referral_links" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "child_user_id" TEXT NOT NULL,
  "referrer_user_id" TEXT NOT NULL,
  "share_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "partner_referral_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_referral_links_share_percent_check"
    CHECK ("share_percent" >= 0 AND "share_percent" <= 100),
  CONSTRAINT "partner_referral_links_no_self_reference_check"
    CHECK ("child_user_id" <> "referrer_user_id"),
  CONSTRAINT "partner_referral_links_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "partner_referral_links_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "partner_organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "partner_referral_links_child_user_id_fkey"
    FOREIGN KEY ("child_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "partner_referral_links_referrer_user_id_fkey"
    FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "partner_referral_links_organization_id_child_user_id_referrer_user_id_key"
  ON "partner_referral_links"("organization_id", "child_user_id", "referrer_user_id");
CREATE UNIQUE INDEX "partner_referral_links_one_primary_per_child_idx"
  ON "partner_referral_links"("organization_id", "child_user_id")
  WHERE "is_primary" = true;
CREATE INDEX "partner_referral_links_project_id_child_user_id_idx"
  ON "partner_referral_links"("project_id", "child_user_id");
CREATE INDEX "partner_referral_links_project_id_referrer_user_id_idx"
  ON "partner_referral_links"("project_id", "referrer_user_id");
CREATE INDEX "partner_referral_links_organization_id_referrer_user_id_idx"
  ON "partner_referral_links"("organization_id", "referrer_user_id");

CREATE FUNCTION "check_partner_referral_share_total"()
RETURNS TRIGGER AS $$
DECLARE
  total_share DECIMAL(7, 2);
BEGIN
  SELECT COALESCE(SUM("share_percent"), 0)
    INTO total_share
    FROM "partner_referral_links"
   WHERE "organization_id" = NEW."organization_id"
     AND "child_user_id" = NEW."child_user_id"
     AND "id" <> NEW."id";

  IF total_share + NEW."share_percent" > 100 THEN
    RAISE EXCEPTION 'Referral shares cannot exceed 100 percent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "partner_referral_links_share_total_trigger"
BEFORE INSERT OR UPDATE OF "share_percent", "organization_id", "child_user_id"
ON "partner_referral_links"
FOR EACH ROW EXECUTE FUNCTION "check_partner_referral_share_total"();

-- Preserve every current organization assignment as the first membership.
INSERT INTO "partner_organization_memberships" (
  "id",
  "project_id",
  "organization_id",
  "user_id",
  "level",
  "can_manage",
  "created_at",
  "updated_at"
)
SELECT
  'pom_' || md5(u."id" || ':' || u."organization_id"),
  u."project_id",
  u."organization_id",
  u."id",
  CASE u."partner_role"::text
    WHEN 'trainer' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'director' THEN 3
    ELSE NULL
  END,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."organization_id" IS NOT NULL
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

-- A configured organization director becomes a manager of that organization,
-- but is no longer forced to move out of other organizations.
INSERT INTO "partner_organization_memberships" (
  "id",
  "project_id",
  "organization_id",
  "user_id",
  "level",
  "can_manage",
  "created_at",
  "updated_at"
)
SELECT
  'pom_' || md5(o."director_user_id" || ':' || o."id"),
  o."project_id",
  o."id",
  o."director_user_id",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "partner_organizations" o
JOIN "users" u
  ON u."id" = o."director_user_id"
 AND u."project_id" = o."project_id"
WHERE o."director_user_id" IS NOT NULL
ON CONFLICT ("organization_id", "user_id")
DO UPDATE SET "can_manage" = true, "updated_at" = CURRENT_TIMESTAMP;

-- A legacy parent may have had another primary organization. Add a membership
-- in the child's organization so the migrated link satisfies the new invariant.
INSERT INTO "partner_organization_memberships" (
  "id",
  "project_id",
  "organization_id",
  "user_id",
  "level",
  "can_manage",
  "created_at",
  "updated_at"
)
SELECT DISTINCT
  'pom_' || md5(parent."id" || ':' || child."organization_id"),
  child."project_id",
  child."organization_id",
  parent."id",
  CASE parent."partner_role"::text
    WHEN 'trainer' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'director' THEN 3
    ELSE NULL
  END,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" child
JOIN "users" parent
  ON parent."id" = child."referred_by"
 AND parent."project_id" = child."project_id"
WHERE child."organization_id" IS NOT NULL
  AND child."referred_by" IS NOT NULL
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

-- Backfill the existing single-parent tree as 100% primary links.
INSERT INTO "partner_referral_links" (
  "id",
  "project_id",
  "organization_id",
  "child_user_id",
  "referrer_user_id",
  "share_percent",
  "is_primary",
  "created_at",
  "updated_at"
)
SELECT
  'prl_' || md5(u."id" || ':' || u."referred_by" || ':' || u."organization_id"),
  u."project_id",
  u."organization_id",
  u."id",
  u."referred_by",
  100,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
JOIN "users" parent
  ON parent."id" = u."referred_by"
 AND parent."project_id" = u."project_id"
WHERE u."organization_id" IS NOT NULL
  AND u."referred_by" IS NOT NULL
  AND u."id" <> u."referred_by"
ON CONFLICT ("organization_id", "child_user_id", "referrer_user_id")
DO NOTHING;
