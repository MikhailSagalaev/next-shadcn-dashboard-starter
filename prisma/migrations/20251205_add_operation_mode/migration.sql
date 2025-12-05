-- CreateEnum
CREATE TYPE "operation_mode" AS ENUM ('with_bot', 'without_bot');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "operation_mode" "operation_mode" NOT NULL DEFAULT 'with_bot';
