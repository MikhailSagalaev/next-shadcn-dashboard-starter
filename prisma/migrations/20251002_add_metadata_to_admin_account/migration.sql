-- Add metadata column to admin_accounts table
ALTER TABLE "public"."admin_accounts" ADD COLUMN "metadata" JSONB;

