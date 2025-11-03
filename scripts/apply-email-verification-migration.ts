/**
 * Script to apply email verification migration manually
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying email verification migration...');
    
    await prisma.$executeRaw`
      ALTER TABLE admin_accounts 
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
      ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP(3);
    `;
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

