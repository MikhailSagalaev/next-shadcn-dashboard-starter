const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestAdmin() {
  const email = 'test@example.com';
  const password = 'Test123!';

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Check if user exists
    const existing = await prisma.adminAccount.findUnique({
      where: { email }
    });

    if (existing) {
      // Update to verified
      await prisma.adminAccount.update({
        where: { email },
        data: {
          emailVerified: true,
          isActive: true
        }
      });
      console.log('✅ User updated and verified:', email);
    } else {
      // Create new user
      await prisma.adminAccount.create({
        data: {
          email,
          passwordHash,
          emailVerified: true,
          isActive: true,
          role: 'ADMIN'
        }
      });
      console.log('✅ New test user created:', email);
    }

    console.log('\n📧 Email:', email);
    console.log('🔐 Password:', password);
    console.log('\nYou can now login at http://localhost:5006/auth/sign-in');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAdmin();
