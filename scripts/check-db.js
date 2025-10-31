const { PrismaClient } = require('@prisma/client');

async function checkDB() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Проверяем проекты...');
    const projects = await prisma.project.findMany();
    console.log(`Найдено проектов: ${projects.length}`);
    projects.forEach(p => console.log(`  - ${p.id}: ${p.name}`));

    console.log('\n🔍 Проверяем workflow...');
    const workflows = await prisma.workflow.findMany();
    console.log(`Найдено workflow: ${workflows.length}`);
    workflows.forEach(w => console.log(`  - ${w.id}: ${w.name} (project: ${w.projectId})`));

    console.log('\n🔍 Проверяем пользователей...');
    const users = await prisma.user.findMany();
    console.log(`Найдено пользователей: ${users.length}`);
    users.forEach(u => console.log(`  - ${u.id}: ${u.firstName} ${u.lastName} (telegram: ${u.telegramId})`));

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDB();
