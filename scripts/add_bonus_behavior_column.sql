-- Add bonus_behavior column to projects table
DO $$
BEGIN
    -- Create enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusBehavior') THEN
        CREATE TYPE "BonusBehavior" AS ENUM ('spend_and_earn', 'spend_only', 'earn_only');
    END IF;

    -- Add column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'projects'
                   AND column_name = 'bonus_behavior') THEN
        ALTER TABLE "projects" ADD COLUMN "bonus_behavior" "BonusBehavior" NOT NULL DEFAULT 'spend_and_earn';
    END IF;
END $$;
