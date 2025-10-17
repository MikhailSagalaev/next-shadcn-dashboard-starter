/**
 * @file: scripts/test-query.ts
 * @description: Тестирование запроса check_user_by_telegram
 * @project: SaaS Bonus System
 * @created: 2025-10-16
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { QueryExecutor } from '@/lib/services/workflow/query-executor';

async function testQuery() {
  try {
    console.log('🔍 Тестируем запрос check_user_by_telegram...\n');

    const params = {
      telegramId: '524567338',
      projectId: 'cmgntgsdv0000v8mwfwwh30az'
    };

    console.log('Параметры запроса:', params);

    // Выполняем запрос через QueryExecutor
    const result = await QueryExecutor.execute(db, 'check_user_by_telegram', params);

    console.log('Результат запроса:');
    if (result) {
      console.log(`  ID: ${result.id}`);
      console.log(`  Имя: ${result.firstName}`);
      console.log(`  Активен: ${result.isActive}`);
      console.log(`  Баланс: ${result.balance}`);
      console.log(`  Telegram ID: ${result.telegramId?.toString()}`);
    } else {
      console.log('  null');
    }

    if (result) {
      console.log('\n✅ Пользователь найден через QueryExecutor');
      console.log(`  ID: ${result.id}`);
      console.log(`  Имя: ${result.firstName}`);
      console.log(`  Активен: ${result.isActive}`);
      console.log(`  Баланс: ${result.balance}`);
    } else {
      console.log('\n❌ Пользователь не найден через QueryExecutor');
    }

    // Тестируем прямой запрос к базе
    console.log('\n🔍 Тестируем прямой запрос к базе...');
    
    const directResult = await db.user.findFirst({
      where: {
        telegramId: BigInt('524567338'),
        projectId: 'cmgntgsdv0000v8mwfwwh30az'
      },
      include: {
        bonuses: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        }
      }
    });

    if (directResult) {
      const balance = directResult.bonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);
      console.log('✅ Пользователь найден через прямой запрос');
      console.log(`  ID: ${directResult.id}`);
      console.log(`  Имя: ${directResult.firstName}`);
      console.log(`  Активен: ${directResult.isActive}`);
      console.log(`  Баланс: ${balance}`);
    } else {
      console.log('❌ Пользователь не найден через прямой запрос');
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании запроса:', error);
  } finally {
    await db.$disconnect();
  }
}

testQuery();
