-- AlterTable
ALTER TABLE "mailings" ADD COLUMN "sent_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "opened_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "clicked_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "link_tracking_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "MailingEventType" AS ENUM ('SENT', 'OPENED', 'CLICKED', 'FAILED');

-- CreateTable
CREATE TABLE "mailing_history" (
    "id" TEXT NOT NULL,
    "mailing_id" TEXT NOT NULL,
    "user_id" TEXT,
    "recipient_id" TEXT NOT NULL,
    "type" "MailingEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "link_id" TEXT,

    CONSTRAINT "mailing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailing_links" (
    "id" TEXT NOT NULL,
    "mailing_id" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailing_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailing_history_mailing_id_type_idx" ON "mailing_history"("mailing_id", "type");

-- CreateIndex
CREATE INDEX "mailing_history_user_id_idx" ON "mailing_history"("user_id");

-- CreateIndex
CREATE INDEX "mailing_history_recipient_id_idx" ON "mailing_history"("recipient_id");

-- CreateIndex
CREATE INDEX "mailing_history_link_id_idx" ON "mailing_history"("link_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailing_links_short_code_key" ON "mailing_links"("short_code");

-- CreateIndex
CREATE INDEX "mailing_links_mailing_id_idx" ON "mailing_links"("mailing_id");

-- CreateIndex
CREATE INDEX "mailing_links_short_code_idx" ON "mailing_links"("short_code");

-- AddForeignKey
ALTER TABLE "mailing_history" ADD CONSTRAINT "mailing_history_mailing_id_fkey" FOREIGN KEY ("mailing_id") REFERENCES "mailings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_history" ADD CONSTRAINT "mailing_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_history" ADD CONSTRAINT "mailing_history_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "mailing_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_history" ADD CONSTRAINT "mailing_history_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "mailing_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_links" ADD CONSTRAINT "mailing_links_mailing_id_fkey" FOREIGN KEY ("mailing_id") REFERENCES "mailings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

