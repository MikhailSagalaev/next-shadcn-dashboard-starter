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

    // Проверяем пользователей с бонусами (через связь с бонусами)
    const usersWithBonuses = await prisma.user.count({
      where: {
        projectId,
        bonuses: {
          some: {
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        }
      }
    });

    console.log(`💰 Пользователей с бонусами: ${usersWithBonuses}`);

    // Проверяем последние 5 созданных пользователей
    const recentUsers = await prisma.user.findMany({
      where: { projectId },
      orderBy: { registeredAt: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        registeredAt: true
      }
    });

    // Получаем баланс бонусов для каждого пользователя
    const usersWithBalances = await Promise.all(
      recentUsers.map(async (user) => {
        const bonusBalance = await prisma.bonus.aggregate({
          where: {
            userId: user.id,
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          _sum: {
            amount: true
          }
        });

        return {
          ...user,
          currentBonusBalance: bonusBalance._sum.amount || 0
        };
      })
    );

    console.log('\n🆕 Последние созданные пользователи:');
    usersWithBalances.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.firstName} ${user.lastName || ''} (${user.email}) - ${Number(user.currentBonusBalance)}₽`
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
