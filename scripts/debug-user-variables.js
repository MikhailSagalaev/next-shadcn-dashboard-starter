const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Импортируем UserVariablesService
const userVariablesPath = path.join(__dirname, '..', 'src', 'lib', 'services', 'workflow', 'user-variables.service.ts');
const tsNode = require('ts-node');
tsNode.register();

async function debugUserVariables() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Отладка переменных пользователя...');

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
      balance: user.balance,
      currentLevel: user.currentLevel,
      totalPurchases: user.totalPurchases
    });

    // Импортируем UserVariablesService
    const { UserVariablesService } = require('../src/lib/services/workflow/user-variables.service');

    // Получаем переменные пользователя
    const userVariables = await UserVariablesService.getUserVariables(user.id, prisma);

    console.log('\n📊 Переменные пользователя:');
    Object.entries(userVariables).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Проверяем конкретную переменную
    const expiringFormatted = userVariables['user.expiringBonusesFormatted'];
    console.log(`\n🎯 user.expiringBonusesFormatted: "${expiringFormatted}"`);

    // Проверяем что возвращает getUserProfile
    const { QueryExecutor } = require('../src/lib/services/workflow/query-executor');
    const profile = await QueryExecutor.execute(prisma, 'get_user_profile', { userId: user.id });

    console.log('\n📋 Профиль из get_user_profile:');
    Object.entries(profile).forEach(([key, value]) => {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugUserVariables();
