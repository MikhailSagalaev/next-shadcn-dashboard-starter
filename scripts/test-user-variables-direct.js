const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Импортируем UserVariablesService через require (может не сработать из-за TypeScript)
try {
  const { UserVariablesService } = require(path.join(__dirname, '..', 'src', 'lib', 'services', 'workflow', 'user-variables.service'));
  const prisma = new PrismaClient();

  async function testUserVariables() {
    try {
      const userId = 'cmh32zyum0005v8kku0wgozw9';
      const projectId = 'cmh2d0uv30000v8h8ujr7u233';

      console.log('🔍 Тестируем UserVariablesService для пользователя:', userId);

      const userVariables = await UserVariablesService.getUserVariables(
        prisma,
        userId,
        projectId
      );

      console.log('✅ Полученные userVariables:');
      Object.keys(userVariables).forEach(key => {
        if (key.includes('expiringBonuses')) {
          console.log(`   ${key}: "${userVariables[key]}"`);
        }
      });

      console.log('\n🎯 Все переменные:');
      Object.keys(userVariables).forEach(key => {
        console.log(`   ${key}: "${userVariables[key]}"`);
      });

    } catch (error) {
      console.error('❌ Ошибка:', error);
      console.error('Stack:', error.stack);
    } finally {
      await prisma.$disconnect();
    }
  }

  testUserVariables();

} catch (error) {
  console.error('❌ Не удалось импортировать UserVariablesService:', error.message);
  console.log('Будем тестировать через другой способ...');
}
