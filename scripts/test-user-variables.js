const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Импортируем UserVariablesService
const tsNode = require('ts-node');
tsNode.register();

const UserVariablesService = require(path.join(__dirname, '..', 'src', 'lib', 'services', 'workflow', 'user-variables.service.ts')).UserVariablesService;

async function testUserVariables() {
  console.log('🧪 Тестируем UserVariablesService...');

  const prisma = new PrismaClient();

  try {
    const userId = 'cmh32zyum0005v8kku0wgozw9';
    const projectId = 'cmh2d0uv30000v8h8ujr7u233';

    console.log(`👤 Получаем переменные для пользователя: ${userId}`);

    const variables = await UserVariablesService.getUserVariables(prisma, userId, projectId);

    console.log('📋 Все переменные:', Object.keys(variables));
    console.log('🔍 Переменная expiringBonusesFormatted:', variables['user.expiringBonusesFormatted']);
    console.log('🔍 Переменная expiringBonuses:', variables['user.expiringBonuses']);

    // Проверяем, есть ли переменная
    const hasExpiring = 'user.expiringBonusesFormatted' in variables;
    console.log('❓ Есть переменная user.expiringBonusesFormatted:', hasExpiring);

    if (hasExpiring) {
      console.log('✅ Значение:', variables['user.expiringBonusesFormatted']);
    } else {
      console.log('❌ Переменная не найдена');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserVariables();
