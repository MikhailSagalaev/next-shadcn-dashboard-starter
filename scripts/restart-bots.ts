/**
 * Скрипт для перезапуска всех ботов
 * Останавливает и запускает заново
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Перезапуск ботов...\n');

    // Находим все активные проекты с ботами
    const projects = await prisma.project.findMany({
      where: {
        isActive: true,
        botStatus: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        botToken: true
      }
    });

    console.log(`📋 Найдено активных ботов: ${projects.length}\n`);

    for (const project of projects) {
      console.log(`🤖 Перезапуск бота для проекта: ${project.name}`);
      
      // Останавливаем бота
      await fetch(`http://localhost:3000/api/projects/${project.id}/bot/stop`, {
        method: 'POST'
      });
      
      console.log('   ⏸️  Бот остановлен');
      
      // Ждём 1 секунду
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Запускаем бота
      await fetch(`http://localhost:3000/api/projects/${project.id}/bot/start`, {
        method: 'POST'
      });
      
      console.log('   ✅ Бот запущен');
    }

    console.log('\n✅ Все боты перезапущены!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

