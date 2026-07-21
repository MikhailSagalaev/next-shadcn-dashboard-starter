-- Merchant YooKassa credentials belong to a project and must never reuse
-- the platform billing credentials from the server environment.
CREATE TABLE "yookassa_fiscal_integrations" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "shop_id" TEXT NOT NULL,
  "secret_key_encrypted" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "receipt_timezone" INTEGER NOT NULL DEFAULT 2,
  "delivery_vat_code" INTEGER,
  "last_tested_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "yookassa_fiscal_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "yookassa_fiscal_integrations_project_id_key"
  ON "yookassa_fiscal_integrations"("project_id");
CREATE INDEX "yookassa_fiscal_integrations_is_active_idx"
  ON "yookassa_fiscal_integrations"("is_active");

ALTER TABLE "yookassa_fiscal_integrations"
  ADD CONSTRAINT "yookassa_fiscal_integrations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
