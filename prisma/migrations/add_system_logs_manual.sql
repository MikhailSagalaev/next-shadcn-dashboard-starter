-- Migration: Add SystemLog and SystemSettings tables
-- Created: 2025-01-30
-- Description: Добавление таблиц для системного логирования и настроек

-- CreateTable: system_logs
CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "project_id" TEXT,
    "user_id" TEXT,
    "source" TEXT NOT NULL,
    "stack" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: system_settings
CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "settings" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: system_logs level and created_at
CREATE INDEX IF NOT EXISTS "system_logs_level_created_at_idx" ON "public"."system_logs"("level", "created_at");

-- CreateIndex: system_logs project_id
CREATE INDEX IF NOT EXISTS "system_logs_project_id_idx" ON "public"."system_logs"("project_id");

-- AddForeignKey: system_logs project_id -> projects id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'system_logs_project_id_fkey'
    ) THEN
        ALTER TABLE "public"."system_logs" 
        ADD CONSTRAINT "system_logs_project_id_fkey" 
        FOREIGN KEY ("project_id") 
        REFERENCES "public"."projects"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Insert default system settings if not exists
INSERT INTO "public"."system_settings" ("id", "settings", "updated_at")
VALUES ('system', '{"maintenanceMode": false, "featureFlags": {}, "limits": {}}', NOW())
ON CONFLICT ("id") DO NOTHING;
