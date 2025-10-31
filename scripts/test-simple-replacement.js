// Простой тест замены переменных без импорта TypeScript
function testVariableReplacement() {
  console.log('🧪 Тестируем логику замены переменных...');

  // Имитируем логику из ProjectVariablesService
  const text = 'Истекает в ближайшие 30 дней: {user.expiringBonusesFormatted}';
  const additionalVariables = {
    'user.expiringBonusesFormatted': '0₽',
    'user.firstName': 'Тест',
    'user.balanceFormatted': '400 бонусов'
  };

  console.log('📝 Исходный текст:', text);
  console.log('📋 Переменные:', additionalVariables);

  let result = text;

  // Имитируем логику замены
  for (const [key, value] of Object.entries(additionalVariables)) {
    // Поддерживаем оба формата: {variable_name} и {user.variable}
    const regex1 = new RegExp(`\\{${key}\\}`, 'g');
    const regex2 = new RegExp(`\\{${key.replace(/\./g, '\\.')}\\}`, 'g');

    console.log(`🔄 Заменяем ${key}:`);
    console.log(`   regex1: ${regex1}`);
    console.log(`   regex2: ${regex2}`);
    console.log(`   value: "${value}"`);

    const beforeReplace = result;
    result = result.replace(regex1, value);
    result = result.replace(regex2, value);

    console.log(`   before: "${beforeReplace}"`);
    console.log(`   after:  "${result}"`);

    if (key === 'user.expiringBonusesFormatted') {
      console.log(`🔍 Специальная проверка для expiringBonusesFormatted:`);
      console.log(`   Содержал плейсхолдер до замены: ${beforeReplace.includes('{user.expiringBonusesFormatted}')}`);
      console.log(`   Содержит плейсхолдер после замены: ${result.includes('{user.expiringBonusesFormatted}')}`);
    }
  }

  console.log('✅ Финальный результат:', result);
  console.log('❓ Содержит плейсхолдер:', result.includes('{user.expiringBonusesFormatted}'));

  return result;
}

testVariableReplacement();
