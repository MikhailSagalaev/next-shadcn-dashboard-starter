/**
 * @file: scripts/check-migration.ts
 * @description: Скрипт для проверки результатов миграции
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Database
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMigration() {
  const projectId = process.argv[2] || 'cmfa8oqx000019e372pk9547l';

  console.log(`🔍 Проверяем миграцию для проекта: ${projectId}`);

  try {
    // Проверяем общее количество пользователей в проекте
    const totalUsers = await prisma.user.count({
      where: { projectId }
    });

    console.log(`📊 Всего пользователей в проекте: ${totalUsers}`);

    // Проверяем пользователей с бонусами
    const usersWithBonuses = await prisma.user.count({
      where: {
        projectId,
        currentBonusBalance: { gt: 0 }
      }
    });

    console.log(`💰 Пользователей с бонусами: ${usersWithBonuses}`);

    // Проверяем последние 5 созданных пользователей
    const recentUsers = await prisma.user.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        currentBonusBalance: true,
        createdAt: true
      }
    });

    console.log('\n🆕 Последние созданные пользователи:');
    recentUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.firstName} ${user.lastName || ''} (${user.email}) - ${user.currentBonusBalance}₽`
      );
    });

    // Проверяем статистику транзакций
    const totalTransactions = await prisma.transaction.count({
      where: {
        user: { projectId }
      }
    });

    console.log(`\n💸 Всего транзакций: ${totalTransactions}`);

    // Проверяем бонусы
    const totalBonuses = await prisma.bonus.count({
      where: {
        user: { projectId }
      }
    });

    console.log(`🎁 Всего бонусов: ${totalBonuses}`);
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigration();
