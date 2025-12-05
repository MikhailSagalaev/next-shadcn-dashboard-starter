import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    select: { id: true, metadata: true, firstName: true }
  });
  console.log('Примеры metadata:');
  users.forEach((u) => {
    console.log(`${u.firstName}: ${JSON.stringify(u.metadata)}`);
  });
  await prisma.$disconnect();
}
main();
