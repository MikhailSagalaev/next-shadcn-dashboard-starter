/**
 * @file: test-welcome-bonus.ts
 * @description: Тестовый скрипт для проверки начисления приветственных бонусов
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { db } from '@/lib/db';
import { UserService } from '@/lib/services/user.service';
import { logger } from '@/lib/logger';

async function testWelcomeBonusFlow() {
  console.log('🧪 Тестирование начисления приветственных бонусов\n');

  try {
    // 1. Найти тестовый проект
    const project = await db.project.findFirst({
      where: {
        name: { contains: 'Le Art de Lamour', mode: 'insensitive' }
      },
      include: {
        referralProgram: true
      }
    });

    if (!project) {
      console.error('❌ Проект не найден');
      return;
    }

    console.log('✅ Проект найден:', project.name);
    console.log('📊 Настройки проекта:');
    console.log(`   - welcomeBonus: ${project.welcomeBonus}`);
    console.log(`   - welcomeRewardType: ${project.welcomeRewardType}`);
    console.log(`   - operationMode: ${project.operationMode}`);

    if (project.referralProgram) {
      console.log('📊 Настройки реферальной программы:');
      console.log(`   - welcomeBonus: ${project.referralProgram.welcomeBonus}`);
      console.log(
        `   - welcomeRewardType: ${project.referralProgram.welcomeRewardType}`
      );
    }

    // 2. Создать тестового пользователя
    const testEmail = `test-welcome-${Date.now()}@example.com`;
    const testPhone = `+79${Math.floor(Math.random() * 1000000000)}`;

    console.log('\n📝 Создание тестового пользователя...');
    console.log(`   - Email: ${testEmail}`);
    console.log(`   - Phone: ${testPhone}`);

    const user = await UserService.createUser({
      projectId: project.id,
      email: testEmail,
      phone: testPhone,
      firstName: 'Тест',
      lastName: 'Пользователь'
    });

    console.log('✅ Пользователь создан:', user.id);
    console.log(`   - isActive: ${user.isActive}`);

    // 3. Проверить начисленные бонусы
    console.log('\n🔍 Проверка начисленных бонусов...');

    const bonuses = await db.bonus.findMany({
      where: {
        userId: user.id,
        type: 'WELCOME'
      }
    });

    if (bonuses.length === 0) {
      console.log('❌ Приветственные бонусы НЕ начислены');
      console.log('\n🔍 Возможные причины:');
      console.log('   1. welcomeRewardType !== "BONUS"');
      console.log('   2. welcomeBonus = 0');
      console.log('   3. Ошибка в логике начисления');
    } else {
      console.log('✅ Приветственные бонусы начислены!');
      bonuses.forEach((bonus, index) => {
        console.log(`\n   Бонус #${index + 1}:`);
        console.log(`   - ID: ${bonus.id}`);
        console.log(`   - Сумма: ${bonus.amount}`);
        console.log(`   - Тип: ${bonus.type}`);
        console.log(`   - Описание: ${bonus.description}`);
        console.log(`   - Использован: ${bonus.isUsed}`);
        console.log(`   - Истекает: ${bonus.expiresAt}`);
      });
    }

    // 4. Проверить транзакции
    console.log('\n🔍 Проверка транзакций...');

    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        type: 'EARN'
      }
    });

    if (transactions.length === 0) {
      console.log('❌ Транзакции начисления НЕ найдены');
    } else {
      console.log(`✅ Найдено транзакций: ${transactions.length}`);
      transactions.forEach((tx, index) => {
        console.log(`\n   Транзакция #${index + 1}:`);
        console.log(`   - ID: ${tx.id}`);
        console.log(`   - Сумма: ${tx.amount}`);
        console.log(`   - Тип: ${tx.type}`);
        console.log(`   - Описание: ${tx.description}`);
      });
    }

    // 5. Проверить баланс
    console.log('\n💰 Проверка баланса пользователя...');

    const balance = await UserService.getUserBalance(user.id);

    console.log(`   - Всего начислено: ${balance.totalEarned}`);
    console.log(`   - Всего списано: ${balance.totalSpent}`);
    console.log(`   - Текущий баланс: ${balance.currentBalance}`);
    console.log(`   - Истекает скоро: ${balance.expiringSoon}`);

    // 6. Очистка (опционально)
    console.log('\n🧹 Очистка тестовых данных...');

    await db.transaction.deleteMany({ where: { userId: user.id } });
    await db.bonus.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });

    console.log('✅ Тестовые данные удалены');

    console.log('\n✅ Тест завершен успешно!');
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении теста:', error);
    if (error instanceof Error) {
      console.error('   Сообщение:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    await db.$disconnect();
  }
}

// Запуск теста
testWelcomeBonusFlow();
