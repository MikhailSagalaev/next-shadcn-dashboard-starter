-- Independent marked-goods stock lifecycle: receiving, quarantine, reservations,
-- compliance documents, refunds and cross-system reconciliation.
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'EXPECTED';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'AVAILABLE';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'QUARANTINED';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'SALE_PENDING';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'RETURN_PENDING';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'WRITE_OFF_PENDING';
ALTER TYPE "MarkedUnitStatus" ADD VALUE IF NOT EXISTS 'WRITTEN_OFF';

CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'SCANNING', 'DISCREPANCY', 'READY', 'ACCEPTANCE_PENDING', 'ACCEPTED', 'REJECTED', 'FAILED');
CREATE TYPE "GoodsReceiptSource" AS ENUM ('MANUAL', 'UPD_XML', 'EDO');
CREATE TYPE "ReceiptDiscrepancyType" AS ENUM ('MISSING', 'EXTRA', 'WRONG_GTIN', 'DAMAGED', 'DUPLICATE', 'INVALID_CODE', 'INVALID_EXTERNAL_STATUS');
CREATE TYPE "ReceiptDiscrepancyResolution" AS ENUM ('ACCEPTED', 'RETURN_TO_SUPPLIER', 'CORRECTED_DOCUMENT', 'WRITE_OFF', 'IGNORED');
CREATE TYPE "ComplianceProvider" AS ENUM ('MANUAL', 'CUSTOM_GATEWAY');
CREATE TYPE "ComplianceDocumentKind" AS ENUM ('UPD_RECEIPT', 'WRITE_OFF', 'RETURN_TO_CIRCULATION');
CREATE TYPE "ComplianceDocumentStatus" AS ENUM ('DRAFT', 'READY_TO_SIGN', 'SUBMITTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "WriteOffReason" AS ENUM ('DAMAGE', 'LOSS', 'DESTRUCTION', 'EXPIRED', 'OWN_USE', 'PRODUCTION_USE', 'OTHER');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'MATCHED', 'MISMATCH', 'PARTIAL', 'FAILED');
CREATE TYPE "ReconciliationIssueType" AS ENUM ('LOCAL_STOCK_MISMATCH', 'UNIT_WITHOUT_RECEIPT', 'RECEIPT_STATUS_MISMATCH', 'YOOKASSA_UNAVAILABLE', 'GIS_MT_UNAVAILABLE', 'GIS_MT_STATUS_MISMATCH', 'COMPLIANCE_DOCUMENT_FAILED');

ALTER TABLE "fiscal_receipts" ADD COLUMN "provider_refund_id" TEXT;
CREATE UNIQUE INDEX "fiscal_receipts_provider_refund_id_key" ON "fiscal_receipts"("provider_refund_id");

ALTER TABLE "marked_units"
  ALTER COLUMN "order_id" DROP NOT NULL,
  ALTER COLUMN "order_item_id" DROP NOT NULL,
  ADD COLUMN "goods_receipt_item_id" TEXT,
  ADD COLUMN "reserved_at" TIMESTAMP(3),
  ADD COLUMN "available_at" TIMESTAMP(3),
  ADD COLUMN "quarantined_at" TIMESTAMP(3),
  ADD COLUMN "written_off_at" TIMESTAMP(3),
  ADD COLUMN "external_status" TEXT,
  ADD COLUMN "external_checked_at" TIMESTAMP(3);

ALTER TABLE "marked_units" DROP CONSTRAINT "marked_units_order_id_fkey";
ALTER TABLE "marked_units" DROP CONSTRAINT "marked_units_order_item_id_fkey";
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "marked_units_goods_receipt_item_id_idx" ON "marked_units"("goods_receipt_item_id");
CREATE INDEX "marked_units_product_id_status_idx" ON "marked_units"("product_id", "status");

CREATE TABLE "goods_receipts" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "supplier_name" TEXT NOT NULL,
  "supplier_inn" TEXT,
  "document_number" TEXT NOT NULL,
  "document_date" TIMESTAMP(3) NOT NULL,
  "source" "GoodsReceiptSource" NOT NULL DEFAULT 'MANUAL',
  "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
  "external_document_id" TEXT,
  "external_status" TEXT,
  "accepted_at" TIMESTAMP(3),
  "accepted_by" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "goods_receipts_project_id_document_number_supplier_inn_key" ON "goods_receipts"("project_id", "document_number", "supplier_inn");
CREATE INDEX "goods_receipts_project_id_status_created_at_idx" ON "goods_receipts"("project_id", "status", "created_at");

CREATE TABLE "goods_receipt_items" (
  "id" TEXT NOT NULL,
  "goods_receipt_id" TEXT NOT NULL,
  "product_id" TEXT,
  "name" TEXT NOT NULL,
  "gtin" TEXT NOT NULL,
  "expected_quantity" INTEGER NOT NULL,
  "accepted_quantity" INTEGER NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(10,2),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items"("goods_receipt_id");
CREATE INDEX "goods_receipt_items_product_id_idx" ON "goods_receipt_items"("product_id");
CREATE INDEX "goods_receipt_items_gtin_idx" ON "goods_receipt_items"("gtin");

CREATE TABLE "goods_receipt_discrepancies" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "goods_receipt_id" TEXT NOT NULL,
  "goods_receipt_item_id" TEXT,
  "marked_unit_id" TEXT,
  "type" "ReceiptDiscrepancyType" NOT NULL,
  "message" TEXT NOT NULL,
  "resolution" "ReceiptDiscrepancyResolution",
  "resolution_comment" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolved_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipt_discrepancies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "goods_receipt_discrepancies_goods_receipt_id_resolved_at_idx" ON "goods_receipt_discrepancies"("goods_receipt_id", "resolved_at");
CREATE INDEX "goods_receipt_discrepancies_project_id_type_idx" ON "goods_receipt_discrepancies"("project_id", "type");

CREATE TABLE "stock_unit_events" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "marked_unit_id" TEXT NOT NULL,
  "product_id" TEXT,
  "order_id" TEXT,
  "from_status" "MarkedUnitStatus",
  "to_status" "MarkedUnitStatus" NOT NULL,
  "reason" TEXT,
  "actor_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_unit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_unit_events_marked_unit_id_created_at_idx" ON "stock_unit_events"("marked_unit_id", "created_at");
CREATE INDEX "stock_unit_events_project_id_created_at_idx" ON "stock_unit_events"("project_id", "created_at");

CREATE TABLE "compliance_integrations" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "provider" "ComplianceProvider" NOT NULL DEFAULT 'MANUAL',
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "gateway_url" TEXT,
  "credential_encrypted" TEXT,
  "last_tested_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compliance_integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "compliance_integrations_project_id_key" ON "compliance_integrations"("project_id");

CREATE TABLE "compliance_documents" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "goods_receipt_id" TEXT,
  "kind" "ComplianceDocumentKind" NOT NULL,
  "status" "ComplianceDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "provider" "ComplianceProvider" NOT NULL DEFAULT 'MANUAL',
  "reason" "WriteOffReason",
  "document_number" TEXT,
  "external_id" TEXT,
  "payload" JSONB,
  "response_payload" JSONB,
  "last_error" TEXT,
  "submitted_at" TIMESTAMP(3),
  "succeeded_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compliance_documents_project_id_kind_status_created_at_idx" ON "compliance_documents"("project_id", "kind", "status", "created_at");
CREATE INDEX "compliance_documents_external_id_idx" ON "compliance_documents"("external_id");

CREATE TABLE "compliance_document_units" (
  "document_id" TEXT NOT NULL,
  "marked_unit_id" TEXT NOT NULL,
  CONSTRAINT "compliance_document_units_pkey" PRIMARY KEY ("document_id", "marked_unit_id")
);
CREATE INDEX "compliance_document_units_marked_unit_id_idx" ON "compliance_document_units"("marked_unit_id");

CREATE TABLE "compliance_outbox" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" "FiscalOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compliance_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "compliance_outbox_idempotency_key_key" ON "compliance_outbox"("idempotency_key");
CREATE INDEX "compliance_outbox_status_next_attempt_at_idx" ON "compliance_outbox"("status", "next_attempt_at");
CREATE INDEX "compliance_outbox_project_id_created_at_idx" ON "compliance_outbox"("project_id", "created_at");

CREATE TABLE "reconciliation_runs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "period_from" TIMESTAMP(3),
  "period_to" TIMESTAMP(3),
  "summary" JSONB,
  "last_error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_by" TEXT,
  CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reconciliation_runs_project_id_started_at_idx" ON "reconciliation_runs"("project_id", "started_at");

CREATE TABLE "reconciliation_issues" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "marked_unit_id" TEXT,
  "order_id" TEXT,
  "fiscal_receipt_id" TEXT,
  "type" "ReconciliationIssueType" NOT NULL,
  "message" TEXT NOT NULL,
  "expected" JSONB,
  "actual" JSONB,
  "resolved_at" TIMESTAMP(3),
  "resolution" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reconciliation_issues_run_id_type_idx" ON "reconciliation_issues"("run_id", "type");
CREATE INDEX "reconciliation_issues_project_id_resolved_at_idx" ON "reconciliation_issues"("project_id", "resolved_at");

ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_goods_receipt_item_id_fkey" FOREIGN KEY ("goods_receipt_item_id") REFERENCES "goods_receipt_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_discrepancies" ADD CONSTRAINT "goods_receipt_discrepancies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_discrepancies" ADD CONSTRAINT "goods_receipt_discrepancies_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_discrepancies" ADD CONSTRAINT "goods_receipt_discrepancies_goods_receipt_item_id_fkey" FOREIGN KEY ("goods_receipt_item_id") REFERENCES "goods_receipt_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_discrepancies" ADD CONSTRAINT "goods_receipt_discrepancies_marked_unit_id_fkey" FOREIGN KEY ("marked_unit_id") REFERENCES "marked_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_unit_events" ADD CONSTRAINT "stock_unit_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_unit_events" ADD CONSTRAINT "stock_unit_events_marked_unit_id_fkey" FOREIGN KEY ("marked_unit_id") REFERENCES "marked_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_unit_events" ADD CONSTRAINT "stock_unit_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_unit_events" ADD CONSTRAINT "stock_unit_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compliance_integrations" ADD CONSTRAINT "compliance_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compliance_document_units" ADD CONSTRAINT "compliance_document_units_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "compliance_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_document_units" ADD CONSTRAINT "compliance_document_units_marked_unit_id_fkey" FOREIGN KEY ("marked_unit_id") REFERENCES "marked_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compliance_outbox" ADD CONSTRAINT "compliance_outbox_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_outbox" ADD CONSTRAINT "compliance_outbox_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "compliance_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_marked_unit_id_fkey" FOREIGN KEY ("marked_unit_id") REFERENCES "marked_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_fiscal_receipt_id_fkey" FOREIGN KEY ("fiscal_receipt_id") REFERENCES "fiscal_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
