-- States for store orders, catalog marking and the fiscal outbox.
CREATE TYPE "StorePaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "FiscalState" AS ENUM ('NOT_STARTED', 'PREPAYMENT_REGISTERED', 'SETTLEMENT_PENDING', 'SETTLED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "MarkingState" AS ENUM ('NOT_REQUIRED', 'UNCONFIGURED', 'PENDING', 'PARTIAL', 'COMPLETE', 'FAILED');
CREATE TYPE "FulfillmentState" AS ENUM ('NEW', 'PICKING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');
CREATE TYPE "ProductMarkingStatus" AS ENUM ('UNKNOWN', 'MARKED_REQUIRED', 'LEGACY_UNMARKED_ALLOWED', 'NOT_SUBJECT');
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'SALE', 'RETURN', 'WRITE_OFF');
CREATE TYPE "MarkedUnitStatus" AS ENUM ('SCANNED', 'ASSIGNED', 'SOLD', 'RETURNED', 'VOID');
CREATE TYPE "FiscalReceiptType" AS ENUM ('PREPAYMENT', 'SETTLEMENT', 'REFUND');
CREATE TYPE "FiscalReceiptStatus" AS ENUM ('NEW', 'PENDING', 'SUCCEEDED', 'CANCELED', 'FAILED');
CREATE TYPE "FiscalOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "orders"
  ADD COLUMN "external_order_id" TEXT,
  ADD COLUMN "payment_provider" TEXT,
  ADD COLUMN "provider_payment_id" TEXT,
  ADD COLUMN "payment_status" "StorePaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "fiscal_state" "FiscalState" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "marking_state" "MarkingState" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "fulfillment_state" "FulfillmentState" NOT NULL DEFAULT 'NEW';

WITH payment_ids AS (
  SELECT "id", NULLIF("metadata"->>'paymentTransactionId', '') AS payment_id,
         ROW_NUMBER() OVER (PARTITION BY NULLIF("metadata"->>'paymentTransactionId', '') ORDER BY "created_at") AS position
  FROM "orders"
)
UPDATE "orders" AS target
SET "external_order_id" = target."order_number",
    "payment_provider" = target."payment_method",
    "provider_payment_id" = CASE WHEN payment_ids.position = 1 THEN payment_ids.payment_id ELSE NULL END,
    "payment_status" = CASE
      WHEN target."status" IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
           AND LOWER(COALESCE(target."payment_method", '')) <> 'наличные'
      THEN 'PAID'::"StorePaymentStatus"
      ELSE 'UNPAID'::"StorePaymentStatus"
    END
FROM payment_ids
WHERE payment_ids."id" = target."id";

CREATE UNIQUE INDEX "orders_provider_payment_id_key" ON "orders"("provider_payment_id");
CREATE INDEX "orders_project_id_payment_status_idx" ON "orders"("project_id", "payment_status");
CREATE INDEX "orders_project_id_fulfillment_state_idx" ON "orders"("project_id", "fulfillment_state");

ALTER TABLE "order_items"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "external_product_id" TEXT,
  ADD COLUMN "gtin" TEXT,
  ADD COLUMN "marking_status" "ProductMarkingStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "vat_code" INTEGER,
  ADD COLUMN "payment_subject" TEXT,
  ADD COLUMN "measure" TEXT NOT NULL DEFAULT 'piece';

UPDATE "order_items"
SET "sku" = NULLIF("metadata"->>'sku', ''),
    "external_product_id" = NULLIF("metadata"->>'externalId', '');

DROP INDEX IF EXISTS "products_sku_key";
ALTER TABLE "products"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "gtin" TEXT,
  ADD COLUMN "marking_status" "ProductMarkingStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "vat_code" INTEGER,
  ADD COLUMN "payment_subject" TEXT,
  ADD COLUMN "measure" TEXT NOT NULL DEFAULT 'piece',
  ADD COLUMN "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stock_reserved" INTEGER NOT NULL DEFAULT 0;

WITH external_ids AS (
  SELECT "id", NULLIF("metadata"->>'externalId', '') AS external_id,
         ROW_NUMBER() OVER (PARTITION BY "project_id", NULLIF("metadata"->>'externalId', '') ORDER BY "created_at") AS position
  FROM "products"
)
UPDATE "products" AS target
SET "external_id" = CASE WHEN external_ids.position = 1 THEN external_ids.external_id ELSE NULL END
FROM external_ids
WHERE external_ids."id" = target."id";

CREATE UNIQUE INDEX "products_project_id_sku_key" ON "products"("project_id", "sku");
CREATE UNIQUE INDEX "products_project_id_external_id_key" ON "products"("project_id", "external_id");
CREATE INDEX "products_project_id_gtin_idx" ON "products"("project_id", "gtin");

CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "order_id" TEXT,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "balance_after" INTEGER,
  "reason" TEXT,
  "idempotency_key" TEXT,
  "metadata" JSONB,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_movements_idempotency_key_key" ON "inventory_movements"("idempotency_key");
CREATE INDEX "inventory_movements_project_id_created_at_idx" ON "inventory_movements"("project_id", "created_at");
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");
CREATE INDEX "inventory_movements_order_id_idx" ON "inventory_movements"("order_id");

CREATE TABLE "fiscal_receipts" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "provider_receipt_id" TEXT,
  "provider_payment_id" TEXT NOT NULL,
  "type" "FiscalReceiptType" NOT NULL,
  "status" "FiscalReceiptStatus" NOT NULL DEFAULT 'NEW',
  "idempotency_key" TEXT NOT NULL,
  "request_payload" JSONB,
  "response_payload" JSONB,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "submitted_at" TIMESTAMP(3),
  "succeeded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fiscal_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_receipts_provider_receipt_id_key" ON "fiscal_receipts"("provider_receipt_id");
CREATE UNIQUE INDEX "fiscal_receipts_idempotency_key_key" ON "fiscal_receipts"("idempotency_key");
CREATE INDEX "fiscal_receipts_project_id_status_created_at_idx" ON "fiscal_receipts"("project_id", "status", "created_at");
CREATE INDEX "fiscal_receipts_order_id_type_idx" ON "fiscal_receipts"("order_id", "type");

CREATE TABLE "marked_units" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "product_id" TEXT,
  "receipt_id" TEXT,
  "code_hash" TEXT NOT NULL,
  "code_encrypted" TEXT NOT NULL,
  "gtin" TEXT NOT NULL,
  "serial" TEXT,
  "status" "MarkedUnitStatus" NOT NULL DEFAULT 'ASSIGNED',
  "scanned_by" TEXT,
  "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sold_at" TIMESTAMP(3),
  "returned_at" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "marked_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marked_units_code_hash_key" ON "marked_units"("code_hash");
CREATE INDEX "marked_units_project_id_status_idx" ON "marked_units"("project_id", "status");
CREATE INDEX "marked_units_order_id_order_item_id_idx" ON "marked_units"("order_id", "order_item_id");
CREATE INDEX "marked_units_gtin_idx" ON "marked_units"("gtin");

CREATE TABLE "fiscal_outbox" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "order_id" TEXT,
  "receipt_id" TEXT,
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
  CONSTRAINT "fiscal_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_outbox_idempotency_key_key" ON "fiscal_outbox"("idempotency_key");
CREATE INDEX "fiscal_outbox_status_next_attempt_at_idx" ON "fiscal_outbox"("status", "next_attempt_at");
CREATE INDEX "fiscal_outbox_project_id_created_at_idx" ON "fiscal_outbox"("project_id", "created_at");

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fiscal_receipts" ADD CONSTRAINT "fiscal_receipts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_receipts" ADD CONSTRAINT "fiscal_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marked_units" ADD CONSTRAINT "marked_units_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "fiscal_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fiscal_outbox" ADD CONSTRAINT "fiscal_outbox_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_outbox" ADD CONSTRAINT "fiscal_outbox_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_outbox" ADD CONSTRAINT "fiscal_outbox_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "fiscal_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
