-- Migration: Add notification_templates table
-- Created: 2025-01-30

CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "image_url" TEXT,
    "buttons" JSONB,
    "parse_mode" TEXT NOT NULL DEFAULT 'HTML',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_templates_project_id_idx" ON "notification_templates"("project_id");

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

