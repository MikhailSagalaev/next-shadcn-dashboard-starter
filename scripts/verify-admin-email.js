// Quick script to verify admin email for local development
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@example.com';
  
  const admin = await prisma.adminAccount.findFirst({ where: { email } });
  
  if (!admin) {
    console.log('Admin not found:', email);
    return;
  }
  
  await prisma.adminAccount.update({
    where: { id: admin.id },
    data: { emailVerified: true }
  });
  
  console.log('✅ Email verified for:', email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
