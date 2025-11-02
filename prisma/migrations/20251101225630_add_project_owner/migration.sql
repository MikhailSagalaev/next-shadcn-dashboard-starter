-- AlterTable - добавляем колонку как nullable сначала
ALTER TABLE "projects" ADD COLUMN "owner_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_owner_id_idx" ON "projects"("owner_id");

-- AddForeignKey - добавляем внешний ключ
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable - делаем NOT NULL (после заполнения данных)
-- ALTER TABLE "projects" ALTER COLUMN "owner_id" SET NOT NULL;

