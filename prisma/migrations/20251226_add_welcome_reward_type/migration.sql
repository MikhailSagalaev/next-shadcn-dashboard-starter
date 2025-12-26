-- CreateEnum
CREATE TYPE "WelcomeRewardType" AS ENUM ('bonus', 'discount');

-- AlterTable
ALTER TABLE "referral_programs" ADD COLUMN IF NOT EXISTS "welcome_reward_type" "WelcomeRewardType" NOT NULL DEFAULT 'bonus';
ALTER TABLE "referral_programs" ADD COLUMN IF NOT EXISTS "first_purchase_discount_percent" INTEGER NOT NULL DEFAULT 0;
