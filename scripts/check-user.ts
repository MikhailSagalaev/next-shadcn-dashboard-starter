/**
 * @file: scripts/check-user.ts
 * @description: Скрипт для проверки пользователей в базе данных
 * @project: SaaS Bonus System
 * @created: 2025-10-16
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';

async function checkUser() {
  try {
    console.log('🔍 Проверяем пользователей в базе данных...\n');

    // Ищем пользователя по Telegram ID
    const telegramId = '524567338';
    console.log(`Поиск пользователя с telegramId: ${telegramId}`);

    const user = await db.user.findFirst({
      where: {
        telegramId: BigInt(telegramId),
        projectId: 'cmgntgsdv0000v8mwfwwh30az' // ID проекта из логов
      },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        isActive: true,
        phone: true,
        email: true,
        currentLevel: true,
        referralCode: true,
        registeredAt: true
      }
    });

    if (user) {
      console.log('✅ Пользователь найден:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Telegram ID: ${user.telegramId}`);
      console.log(`  Имя: ${user.firstName} ${user.lastName || ''}`);
      console.log(`  Активен: ${user.isActive}`);
      console.log(`  Телефон: ${user.phone || 'Не указан'}`);
      console.log(`  Email: ${user.email || 'Не указан'}`);
      console.log(`  Уровень: ${user.currentLevel}`);
      console.log(`  Реферальный код: ${user.referralCode || 'Не сгенерирован'}`);
      console.log(`  Зарегистрирован: ${user.registeredAt}`);
    } else {
      console.log('❌ Пользователь не найден');
    }

    // Проверяем всех пользователей в проекте
    console.log('\n📊 Все пользователи в проекте:');
    const allUsers = await db.user.findMany({
      where: {
        projectId: 'cmgntgsdv0000v8mwfwwh30az'
      },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        isActive: true,
        phone: true,
        email: true
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    if (allUsers.length > 0) {
      allUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.firstName} (ID: ${user.id}, Telegram: ${user.telegramId}, Активен: ${user.isActive})`);
      });
    } else {
      console.log('  Пользователи не найдены');
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке пользователей:', error);
  } finally {
    await db.$disconnect();
  }
}

checkUser();