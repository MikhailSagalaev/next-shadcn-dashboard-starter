const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserData() {
  try {
    const userId = 'cmh32zyum0005v8kku0wgozw9';
    const projectId = 'cmh2d0uv30000v8h8ujr7u233';

    console.log('🔍 Проверяем данные пользователя:', userId);

    // 1. Основные данные пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    console.log('👤 Пользователь:', user);

    if (!user) {
      console.log('❌ Пользователь не найден!');
      return;
    }

    // 2. Все бонусы пользователя
    const bonuses = await prisma.bonus.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🎁 Все бонусы пользователя:', bonuses.length, 'шт.');
    bonuses.slice(0, 5).forEach(b => console.log(`  - ${b.amount}₽ (${b.type}) expires: ${b.expiresAt || 'never'}`));

    // 3. Бонусы, которые истекают в ближайшие 30 дней
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringBonuses = await prisma.bonus.findMany({
      where: {
        userId: userId,
        expiresAt: {
          not: null,
          lte: thirtyDaysFromNow,
          gt: new Date()
        },
        isUsed: false
      }
    });

    console.log('⏰ Истекающие бонусы (30 дней):', expiringBonuses.length, 'шт.');
    expiringBonuses.forEach(b => console.log(`  - ${b.amount}₽ expires: ${b.expiresAt}`));

    // 4. Все транзакции пользователя
    const transactions = await prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('💰 Последние 10 транзакций:', transactions.length, 'шт.');
    transactions.forEach(t => console.log(`  - ${t.type}: ${t.amount}₽ (${t.description})`));

    // 5. Расчет итоговых сумм вручную (как в QueryExecutor)
    const totalEarned = transactions
      .filter(t => t.type === 'EARN')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSpent = Math.abs(transactions
      .filter(t => t.type === 'SPEND')
      .reduce((sum, t) => sum + Number(t.amount), 0));

    const totalPurchasesCount = transactions
      .filter(t => t.type === 'PURCHASE')
      .length;

    const expiringAmount = expiringBonuses
      .reduce((sum, b) => sum + b.amount, 0);

    console.log('\n📊 Рассчитанные вручную суммы:');
    console.log('   Всего заработано:', totalEarned);
    console.log('   Всего потрачено:', totalSpent);
    console.log('   Количество покупок:', totalPurchasesCount);
    console.log('   Истекает бонусов:', expiringAmount);

    // 7. Проверяем активные бонусы
    const activeBonuses = bonuses.filter(b => !b.isUsed && (!b.expiresAt || b.expiresAt > new Date()));
    console.log('\n✅ Активные бонусы:', activeBonuses.length, 'шт.');
    activeBonuses.forEach(b => console.log(`  - ${b.amount}₽ (${b.type}) expires: ${b.expiresAt || 'never'}`));

    // 8. Рассчитываем balance как сумму активных бонусов
    const calculatedBalance = activeBonuses.reduce((sum, b) => sum + Number(b.amount), 0);

    console.log('\n🎯 Что должно быть в userVariables:');
    console.log('   user.balanceFormatted:', `${calculatedBalance} бонусов`);
    console.log('   user.totalEarnedFormatted:', `${totalEarned} бонусов`);
    console.log('   user.totalSpentFormatted:', `${totalSpent} бонусов`);
    console.log('   user.totalPurchasesFormatted:', `${totalPurchasesCount} покупок`);
    console.log('   user.expiringBonusesFormatted:', `${expiringAmount}₽`);

    // 9. Проверяем соответствие с тем, что должно быть по QueryExecutor
    console.log('\n🔍 Сравнение с ожидаемыми значениями:');
    console.log('   Ожидаемый balance:', calculatedBalance, '(сумма активных бонусов)');
    console.log('   Ожидаемый totalEarned:', totalEarned, '(сумма EARN транзакций)');
    console.log('   Ожидаемый expiringBonuses:', expiringAmount, '(бонусы, истекающие в 30 дней)');

    // 8. Проверяем уровень пользователя
    console.log('\n🏆 Уровень пользователя:', user.currentLevel);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserData();
