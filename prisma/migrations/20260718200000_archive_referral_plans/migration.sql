-- @file: prisma/migrations/20260718200000_archive_referral_plans/migration.sql
-- @description: Adds archival state for referral commission plans.
-- @project: SaaS Bonus System
-- @created: 2026-07-18

ALTER TABLE "referral_commission_plans"
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
