/**
 * @file: scripts/test-user-variables.ts
 * @description: Тестовый скрипт для проверки работы переменных пользователя
 * @project: SaaS Bonus System
 * @created: 2025-10-15
 * @author: AI Assistant + User
 */

import { PrismaClient } from '@prisma/client';
import { UserVariablesService } from '../src/lib/services/workflow/user-variables.service';
import { ProjectVariablesService } from '../src/lib/services/project-variables.service';

const prisma = new PrismaClient();

async function testUserVariables() {
  console.log('🧪 Тестирование переменных пользователя...\n');

  try {
    // Получаем первого пользователя из базы данных
    const user = await prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true, firstName: true, projectId: true }
    });

    if (!user) {
      console.log('❌ Пользователи не найдены в базе данных');
      return;
    }

    console.log(`👤 Тестируем с пользователем: ${user.firstName} (${user.id})`);

    // Тестируем UserVariablesService
    console.log('\n📊 Тестирование UserVariablesService...');
    const userVariables = await UserVariablesService.getUserVariables(
      prisma,
      user.id,
      user.projectId
    );

    console.log(`✅ Загружено переменных: ${Object.keys(userVariables).length}`);
    console.log('📋 Примеры переменных:');
    Object.entries(userVariables).slice(0, 10).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Тестируем замену переменных
    console.log('\n🔄 Тестирование замены переменных...');
    const testText = `
Привет, {user.firstName}!
Ваш баланс: {user.balanceFormatted}
Уровень: {user.currentLevel}
Реферальный код: {user.referralCode}
    `.trim();

    console.log('📝 Исходный текст:');
    console.log(testText);

    const replacedText = await ProjectVariablesService.replaceVariablesInText(
      user.projectId,
      testText,
      userVariables
    );

    console.log('\n✨ Результат замены:');
    console.log(replacedText);

    // Проверяем, остались ли не замененные переменные
    const unreplacedVars = replacedText.match(/\{[^}]+\}/g);
    if (unreplacedVars) {
      console.log('\n⚠️ Не замененные переменные:', unreplacedVars);
    } else {
      console.log('\n✅ Все переменные успешно заменены!');
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserVariables();
