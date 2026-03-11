-- CreateEnum
CREATE TYPE "bonus_mode" AS ENUM ('simple', 'levels');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "bonus_mode" "bonus_mode" NOT NULL DEFAULT 'simple';

-- Автоматически установить режим LEVELS для проектов с существующими уровнями
UPDATE "projects" p
SET "bonus_mode" = 'levels'
WHERE EXISTS (
  SELECT 1 FROM "bonus_levels" bl
  WHERE bl."project_id" = p."id" AND bl."is_active" = true
);
