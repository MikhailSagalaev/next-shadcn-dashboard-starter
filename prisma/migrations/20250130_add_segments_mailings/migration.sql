-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('MANUAL', 'AUTO', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "MailingType" AS ENUM ('EMAIL', 'SMS', 'TELEGRAM', 'WHATSAPP', 'VIBER');

-- CreateEnum
CREATE TYPE "MailingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "type" "SegmentType" NOT NULL DEFAULT 'MANUAL',
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_members" (
    "id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segment_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailing_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "MailingType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MailingType" NOT NULL,
    "segment_id" TEXT,
    "template_id" TEXT,
    "status" "MailingStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "statistics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailing_recipients" (
    "id" TEXT NOT NULL,
    "mailing_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailing_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "segments_project_id_idx" ON "segments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "segment_members_segment_id_user_id_key" ON "segment_members"("segment_id", "user_id");

-- CreateIndex
CREATE INDEX "segment_members_segment_id_idx" ON "segment_members"("segment_id");

-- CreateIndex
CREATE INDEX "segment_members_user_id_idx" ON "segment_members"("user_id");

-- CreateIndex
CREATE INDEX "mailing_templates_project_id_idx" ON "mailing_templates"("project_id");

-- CreateIndex
CREATE INDEX "mailings_project_id_status_idx" ON "mailings"("project_id", "status");

-- CreateIndex
CREATE INDEX "mailings_segment_id_idx" ON "mailings"("segment_id");

-- CreateIndex
CREATE INDEX "mailing_recipients_mailing_id_status_idx" ON "mailing_recipients"("mailing_id", "status");

-- CreateIndex
CREATE INDEX "mailing_recipients_user_id_idx" ON "mailing_recipients"("user_id");

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_members" ADD CONSTRAINT "segment_members_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_members" ADD CONSTRAINT "segment_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_templates" ADD CONSTRAINT "mailing_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailings" ADD CONSTRAINT "mailings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailings" ADD CONSTRAINT "mailings_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailings" ADD CONSTRAINT "mailings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mailing_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_mailing_id_fkey" FOREIGN KEY ("mailing_id") REFERENCES "mailings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

