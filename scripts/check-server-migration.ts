/**
 * @file: scripts/check-server-migration.ts
 * @description: Скрипт для проверки миграции на сервере - показывает пользователей во всех проектах
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Database
 * @created: 2025-09-28
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkServerMigration() {
  console.log(
    '🔍 Проверяем миграцию на сервере - пользователи во всех проектах'
  );

  try {
    // Получаем все проекты с количеством пользователей
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📊 Найдено проектов: ${projects.length}\n`);

    // Выводим детальную информацию по каждому проекту
    for (const [index, project] of projects.entries()) {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Пользователей: ${project._count.users}`);
      console.log(
        `   Создан: ${project.createdAt.toLocaleDateString('ru-RU')} ${project.createdAt.toLocaleTimeString('ru-RU')}`
      );

      // Если в проекте есть пользователи, покажем несколько последних
      if (project._count.users > 0) {
        const recentUsers = await prisma.user.findMany({
          where: { projectId: project.id },
          orderBy: { registeredAt: 'desc' },
          take: 3,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            registeredAt: true,
            _count: {
              select: {
                bonuses: true,
                transactions: true
              }
            }
          }
        });

        console.log(`   Последние пользователи:`);
        recentUsers.forEach((user, i) => {
          const name =
            user.firstName || user.lastName
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
              : 'Без имени';
          console.log(
            `     ${i + 1}. ${name} (${user.email}) - ${user._count.transactions} транзакций`
          );
        });
      }

      console.log('');
    }

    // Общая статистика
    const totalUsers = projects.reduce(
      (sum, project) => sum + project._count.users,
      0
    );
    console.log(`📈 Общая статистика:`);
    console.log(`   Всего проектов: ${projects.length}`);
    console.log(`   Всего пользователей: ${totalUsers}`);

    // Проверяем есть ли пользователи без projectId
    const usersWithoutProject = await prisma.user.count({
      where: { projectId: null }
    });

    if (usersWithoutProject > 0) {
      console.log(`   ⚠️ Пользователей без проекта: ${usersWithoutProject}`);
    }

    // Находим проект с максимальным количеством пользователей
    if (projects.length > 0) {
      const maxUsersProject = projects.reduce((max, project) =>
        project._count.users > max._count.users ? project : max
      );

      console.log(`   🏆 Проект с наибольшим количеством пользователей:`);
      console.log(
        `      ${maxUsersProject.name} (${maxUsersProject.id}): ${maxUsersProject._count.users} пользователей`
      );
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке миграции:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServerMigration();
