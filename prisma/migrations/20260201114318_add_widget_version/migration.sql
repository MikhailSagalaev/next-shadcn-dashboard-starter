-- AlterTable
ALTER TABLE "projects" ADD COLUMN "widget_version" TEXT NOT NULL DEFAULT 'legacy';

-- CreateIndex
CREATE INDEX "projects_widget_version_idx" ON "projects"("widget_version");
