const path = require('path');

// Импортируем сервисы
const ProjectVariablesService = require(path.join(__dirname, '..', 'src', 'lib', 'services', 'project-variables.service.ts'));
const UserVariablesService = require(path.join(__dirname, '..', 'src', 'lib', 'services', 'workflow', 'user-variables.service.ts'));

async function testVariableReplacement() {
  console.log('🧪 Тестируем замену переменных...');

  try {
    // Тестовый текст с плейсхолдером
    const testText = 'Истекает в ближайшие 30 дней: {user.expiringBonusesFormatted}';

    // Тестовые переменные
    const additionalVariables = {
      'user.expiringBonusesFormatted': '0₽',
      'user.firstName': 'Тест',
      'user.balanceFormatted': '400 бонусов'
    };

    console.log('📝 Исходный текст:', testText);
    console.log('📋 Переменные:', additionalVariables);

    // Заменяем переменные (используем фиктивный projectId)
    const result = await ProjectVariablesService.replaceVariablesInText(
      'cmh2d0uv30000v8h8ujr7u233',
      testText,
      additionalVariables
    );

    console.log('✅ Результат:', result);
    console.log('❓ Содержит плейсхолдер:', result.includes('{user.expiringBonusesFormatted}'));

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

testVariableReplacement();
