const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  const projectId = 'cmhi55g7i0003v844g83tdoce';

  const totalUsers = await prisma.user.count({
    where: { projectId }
  });

  const activeUsers = await prisma.user.count({
    where: {
      projectId,
      isActive: true
    }
  });

  const inactiveUsers = await prisma.user.count({
    where: {
      projectId,
      isActive: false
    }
  });

  const sampleUsers = await prisma.user.findMany({
    where: { projectId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isActive: true,
      telegramId: true
    },
    take: 5
  });

  console.log(`Всего пользователей: ${totalUsers}`);
  console.log(`Активных: ${activeUsers}`);
  console.log(`Неактивных: ${inactiveUsers}`);
  console.log('\nПримеры пользователей:');
  sampleUsers.forEach(u => {
    console.log(`  ${u.firstName} ${u.lastName} - ${u.isActive ? 'АКТИВЕН' : 'НЕАКТИВЕН'} (telegram: ${u.telegramId?.toString()})`);
  });

  await prisma.$disconnect();
}

checkUsers();
