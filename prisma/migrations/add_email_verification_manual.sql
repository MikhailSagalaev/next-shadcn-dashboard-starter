-- Migration: Add email verification fields to admin_accounts
-- Created: 2025-01-28
-- Description: Adds email_verified, email_verification_token, email_verification_expires columns

ALTER TABLE "admin_accounts" 
ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT,
ADD COLUMN IF NOT EXISTS "email_verification_expires" TIMESTAMP(3);

COMMENT ON COLUMN "admin_accounts"."email_verified" IS 'Whether the email has been verified';
COMMENT ON COLUMN "admin_accounts"."email_verification_token" IS 'Token for email verification, expires after 24 hours';
COMMENT ON COLUMN "admin_accounts"."email_verification_expires" IS 'Expiration timestamp for email verification token';

