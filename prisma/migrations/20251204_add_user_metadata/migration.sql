-- Add metadata field to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';
