import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const withEmail = await prisma.user.count({
    where: { email: { not: null } }
  });
  const emptyEmail = await prisma.user.count({ where: { email: '' } });
  const withPhone = await prisma.user.count({
    where: { phone: { not: null } }
  });
  const total = await prisma.user.count();

  console.log('Всего:', total);
  console.log('С email (not null):', withEmail);
  console.log('С пустым email:', emptyEmail);
  console.log('С phone:', withPhone);

  const sample = await prisma.user.findMany({
    where: {
      AND: [{ email: { not: null } }, { email: { not: '' } }]
    },
    take: 5,
    select: { email: true, phone: true, firstName: true }
  });
  console.log('Примеры с непустым email:', sample);

  await prisma.$disconnect();
}
main();
