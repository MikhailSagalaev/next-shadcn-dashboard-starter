/**
 * @file: scripts/update-user-levels.ts
 * @description: Скрипт обновления уровней пользователей на основе суммы покупок
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-09-25
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LevelUpdateStats {
  total: number;
  updated: number;
  errors: number;
}

class LevelUpdateService {
  private stats: LevelUpdateStats = {
    total: 0,
    updated: 0,
    errors: 0
  };

  constructor(private projectId: string) {}

  async updateUserLevels(): Promise<void> {
    console.log('🚀 Начинаем обновление уровней пользователей...');
    console.log(`🏢 Проект: ${this.projectId}`);

    // Проверка существования проекта
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      include: { bonusLevels: true }
    });

    if (!project) {
      throw new Error(`Проект с ID ${this.projectId} не найден`);
    }

    if (!project.bonusLevels || project.bonusLevels.length === 0) {
      throw new Error(`В проекте ${project.name} не настроены уровни бонусов`);
    }

    console.log(`✅ Проект найден: ${project.name}`);
    console.log(`📊 Настроено уровней: ${project.bonusLevels.length}`);

    // Сортировка уровней по возрастанию суммы
    const sortedLevels = project.bonusLevels.sort(
      (a, b) => a.minAmount - b.minAmount
    );

    console.log('\n🏆 Доступные уровни:');
    sortedLevels.forEach((level) => {
      console.log(
        `   ${level.name}: от ${level.minAmount}₽ (${level.bonusPercent}% бонусов)`
      );
    });

    // Получение пользователей проекта
    const users = await prisma.user.findMany({
      where: { projectId: this.projectId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        totalPurchases: true,
        currentLevel: true
      }
    });

    this.stats.total = users.length;
    console.log(`\n👥 Найдено пользователей: ${users.length}`);

    // Обновление уровней
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if (i > 0 && i % 100 === 0) {
        console.log(`📈 Обработано ${i}/${users.length} пользователей...`);
      }

      await this.updateUserLevel(user, sortedLevels);
    }

    // Финальная статистика
    this.printFinalStats();
  }

  private async updateUserLevel(user: any, levels: any[]): Promise<void> {
    try {
      // Найти подходящий уровень (перебор от высшего к низшему)
      let newLevel = levels[0]; // Минимальный уровень по умолчанию

      for (const level of levels.slice().reverse()) {
        if (user.totalPurchases >= level.minAmount) {
          newLevel = level;
          break;
        }
      }

      // Обновить уровень, если он изменился
      if (user.currentLevel !== newLevel.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { currentLevel: newLevel.name }
        });

        const userName = `${user.firstName} ${user.lastName || ''}`.trim();
        const contact = user.email || user.phone;

        console.log(
          `🔄 ${userName} (${contact}): ${user.currentLevel} → ${newLevel.name} (${user.totalPurchases}₽)`
        );
        this.stats.updated++;
      }
    } catch (error) {
      const errorMsg = `❌ Ошибка обновления уровня пользователя ${user.email || user.phone}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      this.stats.errors++;
    }
  }

  private printFinalStats(): void {
    console.log('\n🎉 Обновление уровней завершено!');
    console.log('📊 Статистика:');
    console.log(`   Всего пользователей: ${this.stats.total}`);
    console.log(`   ✅ Обновлено уровней: ${this.stats.updated}`);
    console.log(`   ❌ Ошибок: ${this.stats.errors}`);

    const successRate =
      this.stats.total > 0
        ? ((this.stats.updated / this.stats.total) * 100).toFixed(1)
        : '0';
    console.log(`   📈 Процент изменений: ${successRate}%`);
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error('Использование: npm run update-levels <project-id>');
    console.error('Пример: npm run update-levels proj_123456');
    process.exit(1);
  }

  const [projectId] = args;

  try {
    const updater = new LevelUpdateService(projectId);
    await updater.updateUserLevels();
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { LevelUpdateService };
