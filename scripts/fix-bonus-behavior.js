const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixBonusBehavior() {
  try {
    console.log('🔧 Исправляем проблему с bonus_behavior колонкой...');

    // Проверяем, существует ли колонка
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'bonus_behavior'
    `;

    if (result.length === 0) {
      console.log('📝 Колонка bonus_behavior не существует, создаем...');

      // Создаем enum если не существует
      try {
        await prisma.$executeRaw`CREATE TYPE "BonusBehavior" AS ENUM ('SPEND_AND_EARN', 'SPEND_ONLY', 'EARN_ONLY');`;
        console.log('✅ Создан enum BonusBehavior');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log('⚠️  Enum уже существует');
        }
      }

      // Добавляем колонку
      await prisma.$executeRaw`
        ALTER TABLE "projects"
        ADD COLUMN "bonus_behavior" "BonusBehavior" NOT NULL DEFAULT 'SPEND_AND_EARN'
      `;

      console.log('✅ Колонка bonus_behavior добавлена');
    } else {
      console.log('✅ Колонка bonus_behavior уже существует');
    }

    console.log('🎉 Исправление завершено успешно!');
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBonusBehavior();
