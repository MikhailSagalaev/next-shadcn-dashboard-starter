/**
 * @file: scripts/check-all-projects.ts
 * @description: Скрипт для проверки количества пользователей во всех проектах
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Database
 * @created: 2025-09-28
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllProjects() {
  console.log('🔍 Проверяем пользователей во всех проектах');

  try {
    // Получаем все проекты
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

    // Выводим статистику по каждому проекту
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Пользователей: ${project._count.users}`);
      console.log(
        `   Создан: ${project.createdAt.toLocaleDateString('ru-RU')}`
      );
      console.log('');
    });

    // Общая статистика
    const totalUsers = projects.reduce(
      (sum, project) => sum + project._count.users,
      0
    );
    console.log(`\n📈 Общая статистика:`);
    console.log(`   Всего проектов: ${projects.length}`);
    console.log(`   Всего пользователей: ${totalUsers}`);

    // Находим проект с максимальным количеством пользователей
    const maxUsersProject = projects.reduce((max, project) =>
      project._count.users > max._count.users ? project : max
    );

    if (maxUsersProject._count.users > 0) {
      console.log(`   Проект с наибольшим количеством пользователей:`);
      console.log(
        `   - ${maxUsersProject.name} (${maxUsersProject.id}): ${maxUsersProject._count.users} пользователей`
      );
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке проектов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllProjects();
