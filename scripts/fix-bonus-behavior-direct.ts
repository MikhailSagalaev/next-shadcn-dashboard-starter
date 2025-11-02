/**
 * @file: scripts/fix-bonus-behavior-direct.ts
 * @description: Скрипт для добавления колонки bonus_behavior в таблицу projects через Prisma
 * @project: SaaS Bonus System
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBonusBehavior() {
  try {
    console.log('🔧 Проверяем наличие колонки bonus_behavior...');

    // Проверяем, существует ли колонка
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'bonus_behavior'
    `;

    if (result.length > 0) {
      console.log('✅ Колонка bonus_behavior уже существует');
      return;
    }

    console.log('📝 Колонка bonus_behavior не найдена, создаем...');

    // Проверяем, существует ли enum
    const enumResult = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type WHERE typname = 'BonusBehavior'
    `;

    if (enumResult.length === 0) {
      console.log('📝 Создаем enum BonusBehavior...');
      await prisma.$executeRaw`
        CREATE TYPE "BonusBehavior" AS ENUM ('spend_and_earn', 'spend_only', 'earn_only')
      `;
      console.log('✅ Enum BonusBehavior создан');
    } else {
      console.log('✅ Enum BonusBehavior уже существует');
    }

    // Добавляем колонку
    console.log('📝 Добавляем колонку bonus_behavior...');
    await prisma.$executeRaw`
      ALTER TABLE "projects" 
      ADD COLUMN "bonus_behavior" "BonusBehavior" NOT NULL DEFAULT 'spend_and_earn'
    `;

    console.log('✅ Колонка bonus_behavior добавлена успешно!');

    // Проверяем результат
    const verify = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'bonus_behavior'
    `;

    if (verify.length > 0) {
      console.log('🎉 Проверка пройдена: колонка существует');
      console.log(`   Тип: ${verify[0].data_type}`);
    } else {
      console.log('⚠️  Предупреждение: не удалось подтвердить создание колонки');
    }
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
    if (error instanceof Error) {
      // Если колонка уже существует, это не критично
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('ℹ️  Колонка уже существует или enum уже создан');
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixBonusBehavior()
  .then(() => {
    console.log('✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Скрипт завершился с ошибкой:', error);
    process.exit(1);
  });

