-- CreateTable
CREATE TABLE "retailcrm_integrations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "api_url" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sync_orders" BOOLEAN NOT NULL DEFAULT true,
    "sync_customers" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailcrm_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retailcrm_integrations_project_id_key" ON "retailcrm_integrations"("project_id");

-- AddForeignKey
ALTER TABLE "retailcrm_integrations" ADD CONSTRAINT "retailcrm_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

