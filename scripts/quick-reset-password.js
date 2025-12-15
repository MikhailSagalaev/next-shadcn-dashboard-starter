// Quick script to reset admin password
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  
  // Check if admin exists
  const existing = await prisma.adminAccount.findFirst({ where: { email } });
  
  if (existing) {
    await prisma.adminAccount.update({
      where: { id: existing.id },
      data: { passwordHash: hash }
    });
    console.log('Password updated!');
  } else {
    await prisma.adminAccount.create({
      data: {
        email,
        passwordHash: hash,
        role: 'SUPERADMIN',
        isActive: true
      }
    });
    console.log('Admin created!');
  }
  
  console.log('');
  console.log('========================================');
  console.log('Email:    ', email);
  console.log('Password: ', password);
  console.log('========================================');
  console.log('');
  console.log('Login at: http://localhost:5006/sign-in');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
