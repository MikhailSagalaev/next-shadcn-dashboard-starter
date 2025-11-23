ALTER TABLE "admin_accounts"
ADD COLUMN "two_factor_secret" TEXT,
ADD COLUMN "two_factor_temp_secret" TEXT,
ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;


