/**
 * @file: award-welcome-bonus-to-existing.ts
 * @description: Скрипт для начисления приветственных бонусов существующим пользователям
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { db } from '@/lib/db';
import { BonusService } from '@/lib/services/user.service';
import { logger } from '@/lib/logger';

interface ScriptOptions {
  projectId?: string;
  projectName?: string;
  dryRun?: boolean;
  force?: boolean;
}

async function awardWelcomeBonusToExisting(options: ScriptOptions = {}) {
  const { projectId, projectName, dryRun = false, force = false } = options;

  console.log(
    '🎁 Начисление приветственных бонусов существующим пользователям\n'
  );

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - изменения НЕ будут применены\n');
  }

  try {
    // 1. Найти проект
    let project;

    if (projectId) {
      project = await db.project.findUnique({
        where: { id: projectId },
        include: { referralProgram: true }
      });
    } else if (projectName) {
      project = await db.project.findFirst({
        where: {
          name: { contains: projectName, mode: 'insensitive' }
        },
        include: { referralProgram: true }
      });
    } else {
      // Показать список проектов для выбора
      const projects = await db.project.findMany({
        select: {
          id: true,
          name: true,
          welcomeBonus: true,
          welcomeRewardType: true,
          operationMode: true
        },
        take: 10
      });

      console.log('📋 Доступные проекты:\n');
      projects.forEach((p, index) => {
        console.log(`${index + 1}. ${p.name}`);
        console.log(`   ID: ${p.id}`);
        console.log(
          `   Welcome Bonus: ${p.welcomeBonus} (${p.welcomeRewardType})`
        );
        console.log(`   Mode: ${p.operationMode}\n`);
      });

      console.log('❌ Укажите projectId или projectName в параметрах скрипта');
      return;
    }

    if (!project) {
      console.error('❌ Проект не найден');
      return;
    }

    console.log('✅ Проект найден:', project.name);
    console.log(`   ID: ${project.id}`);
    console.log(`   Welcome Bonus: ${project.welcomeBonus}`);
    console.log(`   Welcome Reward Type: ${project.welcomeRewardType}`);
    console.log(`   Operation Mode: ${project.operationMode}`);

    // Определяем сумму приветственных бонусов
    const welcomeBonus = project.referralProgram?.welcomeBonus
      ? Number(project.referralProgram.welcomeBonus)
      : Number(project.welcomeBonus);

    const welcomeRewardType =
      project.referralProgram?.welcomeRewardType || project.welcomeRewardType;

    console.log('\n📊 Настройки начисления:');
    console.log(`   Сумма: ${welcomeBonus}`);
    console.log(`   Тип: ${welcomeRewardType}`);

    // Проверка условий начисления
    if (welcomeRewardType !== 'BONUS') {
      console.log(
        '\n⚠️  Тип вознаграждения не "BONUS" - приветственные бонусы не начисляются'
      );
      return;
    }

    if (welcomeBonus <= 0) {
      console.log(
        '\n⚠️  Сумма приветственных бонусов = 0 - начисление не требуется'
      );
      return;
    }

    // 2. Найти пользователей без приветственных бонусов
    console.log('\n🔍 Поиск пользователей без приветственных бонусов...');

    const usersWithoutWelcomeBonus = await db.user.findMany({
      where: {
        projectId: project.id,
        bonuses: {
          none: { type: 'WELCOME' }
        }
      },
      include: {
        bonuses: {
          where: { type: 'WELCOME' }
        }
      }
    });

    console.log(
      `\n📊 Найдено пользователей: ${usersWithoutWelcomeBonus.length}`
    );

    if (usersWithoutWelcomeBonus.length === 0) {
      console.log('✅ Все пользователи уже получили приветственные бонусы');
      return;
    }

    // Показать список пользователей
    console.log('\n👥 Список пользователей для начисления:\n');
    usersWithoutWelcomeBonus.forEach((user, index) => {
      const identifier = user.email || user.phone || user.id;
      const status = user.isActive ? '✅ Активен' : '⏳ Неактивен';
      console.log(`${index + 1}. ${identifier} - ${status}`);
    });

    // Подтверждение
    if (!force && !dryRun) {
      console.log(
        '\n⚠️  Для начисления бонусов запустите скрипт с параметром force: true'
      );
      console.log('   Или используйте dryRun: true для проверки без изменений');
      return;
    }

    // 3. Начислить бонусы
    console.log('\n💰 Начисление приветственных бонусов...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutWelcomeBonus) {
      const identifier = user.email || user.phone || user.id;

      try {
        if (!dryRun) {
          await BonusService.awardBonus({
            userId: user.id,
            amount: welcomeBonus,
            type: 'WELCOME',
            description: 'Приветственный бонус (ретроактивно)',
            metadata: {
              source: 'retroactive_script',
              scriptDate: new Date().toISOString(),
              projectId: project.id
            }
          });
        }

        console.log(`✅ ${identifier} - начислено ${welcomeBonus} бонусов`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${identifier} - ошибка:`, error);
        errorCount++;
      }
    }

    // 4. Итоги
    console.log('\n📊 Итоги:');
    console.log(`   ✅ Успешно: ${successCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(
      `   💰 Всего начислено: ${successCount * welcomeBonus} бонусов`
    );

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - изменения НЕ были применены');
      console.log('   Запустите без dryRun для реального начисления бонусов');
    } else {
      console.log('\n✅ Начисление завершено успешно!');
    }
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении скрипта:', error);
    if (error instanceof Error) {
      console.error('   Сообщение:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    await db.$disconnect();
  }
}

// Примеры использования:

// 1. Dry run для проекта "Le Art de Lamour"
// awardWelcomeBonusToExisting({
//   projectName: 'Le Art de Lamour',
//   dryRun: true
// });

// 2. Реальное начисление для конкретного проекта
// awardWelcomeBonusToExisting({
//   projectId: 'cmlzch7zi8l4p9e1m1ipxjub3',
//   force: true
// });

// 3. Показать список проектов
// awardWelcomeBonusToExisting();

// Запуск с параметрами из командной строки
const args = process.argv.slice(2);
const options: ScriptOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-id' && args[i + 1]) {
    options.projectId = args[i + 1];
    i++;
  } else if (args[i] === '--project-name' && args[i + 1]) {
    options.projectName = args[i + 1];
    i++;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--force') {
    options.force = true;
  }
}

// Запуск
awardWelcomeBonusToExisting(options);
