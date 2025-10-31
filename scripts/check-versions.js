const { PrismaClient } = require('@prisma/client');

async function checkVersions() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Проверяем версии workflow...');

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId: 'cmhdpf1ai0001v824cvwo816y' },
      orderBy: { version: 'desc' }
    });

    console.log(`Найдено версий: ${versions.length}`);
    versions.forEach(v => {
      console.log(`  - Версия ${v.version}: ${v.id} (активна: ${v.isActive})`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVersions();
