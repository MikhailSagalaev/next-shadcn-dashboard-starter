CREATE TYPE "DistanceSaleMode" AS ENUM (
  'UNCONFIGURED',
  'KKT_MARKED_RECEIPT',
  'GIS_MT_DISTANCE_SALE'
);

CREATE TYPE "WithdrawalState" AS ENUM (
  'NOT_REQUIRED',
  'NOT_STARTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED'
);

ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_SUPPLIER';

CREATE TYPE "StockUnitHoldSource" AS ENUM (
  'RECEIVING',
  'CUSTOMER_RETURN',
  'MANUAL_REVIEW',
  'RECONCILIATION'
);

CREATE TYPE "StockUnitHoldStatus" AS ENUM (
  'OPEN',
  'PENDING_EXTERNAL',
  'RESOLVED',
  'CANCELED'
);

CREATE TYPE "StockUnitHoldResolution" AS ENUM (
  'RELEASE_TO_STOCK',
  'RETURN_TO_SUPPLIER',
  'WRITE_OFF',
  'REMARK',
  'KEEP_QUARANTINED'
);

ALTER TYPE "ComplianceDocumentKind" ADD VALUE IF NOT EXISTS 'DISTANCE_SALE';
ALTER TYPE "ComplianceDocumentKind" ADD VALUE IF NOT EXISTS 'RETURN_TO_SUPPLIER';
ALTER TYPE "ComplianceDocumentKind" ADD VALUE IF NOT EXISTS 'REMARKING';

ALTER TABLE "orders"
  ADD COLUMN "withdrawal_mode" "DistanceSaleMode" NOT NULL DEFAULT 'UNCONFIGURED',
  ADD COLUMN "withdrawal_state" "WithdrawalState" NOT NULL DEFAULT 'NOT_STARTED';

UPDATE "orders" AS o
SET "withdrawal_state" = 'NOT_REQUIRED'
WHERE NOT EXISTS (
  SELECT 1
  FROM "order_items" AS oi
  WHERE oi."order_id" = o."id"
    AND oi."marking_status" = 'MARKED_REQUIRED'
);

ALTER TABLE "compliance_integrations"
  ADD COLUMN "distance_sale_mode" "DistanceSaleMode" NOT NULL DEFAULT 'UNCONFIGURED',
  ADD COLUMN "last_sync_at" TIMESTAMP(3);

ALTER TABLE "compliance_documents"
  ADD COLUMN "order_id" TEXT,
  ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "fiscal_receipts"
  ADD COLUMN "includes_mark_codes" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "compliance_document_units"
  ADD COLUMN "previous_status" "MarkedUnitStatus";

ALTER TABLE "compliance_documents"
  ADD CONSTRAINT "compliance_documents_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "compliance_documents_order_id_kind_status_idx"
  ON "compliance_documents"("order_id", "kind", "status");

CREATE UNIQUE INDEX "compliance_documents_idempotency_key_key"
  ON "compliance_documents"("idempotency_key");

CREATE UNIQUE INDEX "compliance_documents_order_id_kind_key"
  ON "compliance_documents"("order_id", "kind");

CREATE TABLE "stock_unit_holds" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "marked_unit_id" TEXT NOT NULL,
  "compliance_document_id" TEXT,
  "source" "StockUnitHoldSource" NOT NULL,
  "status" "StockUnitHoldStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" "StockUnitHoldResolution",
  "reason" TEXT NOT NULL,
  "resolution_comment" TEXT,
  "opened_by" TEXT,
  "resolved_by" TEXT,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "stock_unit_holds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_unit_holds_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_unit_holds_marked_unit_id_fkey"
    FOREIGN KEY ("marked_unit_id") REFERENCES "marked_units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_unit_holds_compliance_document_id_fkey"
    FOREIGN KEY ("compliance_document_id") REFERENCES "compliance_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "stock_unit_holds_project_id_status_opened_at_idx"
  ON "stock_unit_holds"("project_id", "status", "opened_at");

CREATE INDEX "stock_unit_holds_marked_unit_id_status_idx"
  ON "stock_unit_holds"("marked_unit_id", "status");

CREATE UNIQUE INDEX "stock_unit_holds_one_active_per_unit_idx"
  ON "stock_unit_holds"("marked_unit_id")
  WHERE "status" IN ('OPEN', 'PENDING_EXTERNAL');
