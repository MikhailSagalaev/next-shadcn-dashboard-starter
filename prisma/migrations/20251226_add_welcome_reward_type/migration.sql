-- Добавляем поля в таблицу projects для приветственного вознаграждения
-- Enum WelcomeRewardType уже создан ранее

-- AlterTable projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "welcome_bonus" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "welcome_reward_type" "WelcomeRewardType" NOT NULL DEFAULT 'bonus';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "first_purchase_discount_percent" INTEGER NOT NULL DEFAULT 0;
