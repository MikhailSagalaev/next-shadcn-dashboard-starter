/**
 * @file: scripts/fix-users-active-status.ts
 * @description: Скрипт для исправления статуса активности пользователей после переноса базы
 * @project: SaaS Bonus System
 * @dependencies: Prisma, @prisma/client
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Исправляет статус активности пользователей:
 * - Пользователи БЕЗ telegramId должны быть isActive = false
 * - Пользователи С telegramId должны быть isActive = true
 */
async function fixUsersActiveStatus() {
  console.log('🔍 Начинаю проверку статуса активности пользователей...\n');

  try {
    // 1. Находим всех пользователей без telegramId, но с isActive = true
    const inactiveUsers = await prisma.user.findMany({
      where: {
        telegramId: null,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        isActive: true,
        projectId: true
      }
    });

    console.log(
      `📊 Найдено ${inactiveUsers.length} пользователей без Telegram, но с isActive = true`
    );

    if (inactiveUsers.length > 0) {
      // Обновляем их статус на неактивный
      const updateResult = await prisma.user.updateMany({
        where: {
          telegramId: null,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      console.log(
        `✅ Обновлено ${updateResult.count} пользователей: isActive = false\n`
      );
    }

    // 2. Находим всех пользователей с telegramId, но с isActive = false
    const activeUsers = await prisma.user.findMany({
      where: {
        telegramId: { not: null },
        isActive: false
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        isActive: true,
        projectId: true
      }
    });

    console.log(
      `📊 Найдено ${activeUsers.length} пользователей с Telegram, но с isActive = false`
    );

    if (activeUsers.length > 0) {
      // Обновляем их статус на активный
      const updateResult = await prisma.user.updateMany({
        where: {
          telegramId: { not: null },
          isActive: false
        },
        data: {
          isActive: true
        }
      });

      console.log(
        `✅ Обновлено ${updateResult.count} пользователей: isActive = true\n`
      );
    }

    // 3. Выводим статистику по проектам
    const stats = await prisma.user.groupBy({
      by: ['projectId', 'isActive'],
      _count: {
        id: true
      }
    });

    console.log('📈 Статистика по проектам:');
    console.log('─'.repeat(60));

    const projectStats = new Map<
      string,
      { active: number; inactive: number }
    >();

    for (const stat of stats) {
      if (!projectStats.has(stat.projectId)) {
        projectStats.set(stat.projectId, { active: 0, inactive: 0 });
      }
      const project = projectStats.get(stat.projectId)!;
      if (stat.isActive) {
        project.active = stat._count.id;
      } else {
        project.inactive = stat._count.id;
      }
    }

    for (const [projectId, counts] of projectStats.entries()) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true }
      });
      console.log(`Проект: ${project?.name || projectId}`);
      console.log(`  Активных: ${counts.active}`);
      console.log(`  Неактивных: ${counts.inactive}`);
      console.log(`  Всего: ${counts.active + counts.inactive}`);
      console.log('');
    }

    console.log('✅ Исправление статуса активности завершено!');
  } catch (error) {
    console.error('❌ Ошибка при исправлении статуса:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск скрипта
fixUsersActiveStatus()
  .then(() => {
    console.log('\n🎉 Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
