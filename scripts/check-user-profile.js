const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { QueryExecutor } = require(path.join(__dirname, '..', 'src', 'lib', 'services', 'workflow', 'query-executor'));

async function checkUserProfile() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Проверяем профиль пользователя...');

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id: 'cmh32zyum0005v8kku0wgozw9' }
    });

    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }

    console.log('Пользователь:', {
      id: user.id,
      telegramId: user.telegramId?.toString(),
      balance: 'calculated below'
    });

    // Получаем профиль через QueryExecutor
    const profile = await QueryExecutor.execute(prisma, 'get_user_profile', { userId: user.id });

    console.log('Профиль из get_user_profile:', {
      userId: profile.userId,
      balance: profile.balance,
      expiringBonuses: profile.expiringBonuses,
      totalEarned: profile.totalEarned,
      totalSpent: profile.totalSpent,
      totalPurchases: profile.totalPurchases
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserProfile();
