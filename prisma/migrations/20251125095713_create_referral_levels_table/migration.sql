-- CreateTable
CREATE TABLE IF NOT EXISTS "referral_levels" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "referral_program_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "referral_levels_project_id_level_key" ON "referral_levels"("project_id", "level");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'referral_levels_project_id_fkey'
    ) THEN
        ALTER TABLE "referral_levels" 
        ADD CONSTRAINT "referral_levels_project_id_fkey" 
        FOREIGN KEY ("project_id") 
        REFERENCES "projects"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'referral_levels_referral_program_id_fkey'
    ) THEN
        ALTER TABLE "referral_levels" 
        ADD CONSTRAINT "referral_levels_referral_program_id_fkey" 
        FOREIGN KEY ("referral_program_id") 
        REFERENCES "referral_programs"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

