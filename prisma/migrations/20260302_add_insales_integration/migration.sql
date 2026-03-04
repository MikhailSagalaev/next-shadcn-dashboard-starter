-- Add InSales integration tables

-- InSales Integration main table
CREATE TABLE "insales_integrations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "api_password" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "bonus_percent" INTEGER NOT NULL DEFAULT 10,
    "max_bonus_spend" INTEGER NOT NULL DEFAULT 50,
    "widget_enabled" BOOLEAN NOT NULL DEFAULT true,
    "show_product_badges" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_webhook_at" TIMESTAMP(3),
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_bonus_awarded" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_bonus_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insales_integrations_pkey" PRIMARY KEY ("id")
);

-- InSales Webhook Logs table
CREATE TABLE "insales_webhook_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "response" JSONB,
    "error" TEXT,
    "processing_time_ms" INTEGER,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insales_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "insales_integrations_project_id_key" ON "insales_integrations"("project_id");
CREATE UNIQUE INDEX "insales_integrations_webhook_secret_key" ON "insales_integrations"("webhook_secret");

-- Create indexes for performance
CREATE INDEX "insales_integrations_project_id_idx" ON "insales_integrations"("project_id");
CREATE INDEX "insales_integrations_webhook_secret_idx" ON "insales_integrations"("webhook_secret");

CREATE INDEX "insales_webhook_logs_integration_id_processed_at_idx" ON "insales_webhook_logs"("integration_id", "processed_at");
CREATE INDEX "insales_webhook_logs_event_idx" ON "insales_webhook_logs"("event");
CREATE INDEX "insales_webhook_logs_success_idx" ON "insales_webhook_logs"("success");

-- Add foreign key constraints
ALTER TABLE "insales_integrations" ADD CONSTRAINT "insales_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insales_webhook_logs" ADD CONSTRAINT "insales_webhook_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "insales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
