ALTER TYPE "MailingType" ADD VALUE IF NOT EXISTS 'MAX';

ALTER TABLE "mailing_recipients"
ADD COLUMN "max_id" TEXT;

CREATE INDEX "mailing_recipients_max_id_idx"
ON "mailing_recipients"("max_id");
