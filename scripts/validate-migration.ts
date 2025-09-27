/**
 * @file: scripts/validate-migration.ts
 * @description: Скрипт валидации успешности миграции данных из Airtable
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-09-25
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalPurchases: number;
    averagePurchase: number;
    usersWithEmail: number;
    usersWithPhone: number;
    duplicateEmails: number;
    duplicatePhones: number;
    usersWithoutContact: number;
    levelDistribution: Record<string, number>;
  };
}

class MigrationValidator {
  private issues: string[] = [];
  private warnings: string[] = [];

  constructor(private projectId: string) {}

  async validate(): Promise<ValidationResult> {
    console.log('🔍 Начинаем валидацию миграции...');
    console.log(`🏢 Проект: ${this.projectId}`);

    // Проверка существования проекта
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            totalPurchases: true,
            isActive: true,
            currentLevel: true,
            registeredAt: true
          }
        },
        bonusLevels: true
      }
    });

    if (!project) {
      throw new Error(`Проект с ID ${this.projectId} не найден`);
    }

    console.log(`✅ Проект найден: ${project.name}`);
    console.log(`👥 Пользователей в системе: ${project.users.length}`);

    const stats = await this.calculateStats(project.users);
    await this.checkDataIntegrity(project.users);
    await this.validateLevels(project.users, project.bonusLevels);

    const isValid = this.issues.length === 0;

    this.printResults(stats, isValid);

    return {
      isValid,
      issues: this.issues,
      warnings: this.warnings,
      stats
    };
  }

  private async calculateStats(
    users: any[]
  ): Promise<ValidationResult['stats']> {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.isActive).length;
    const totalPurchases = users.reduce(
      (sum, u) => sum + Number(u.totalPurchases),
      0
    );
    const averagePurchase = totalUsers > 0 ? totalPurchases / totalUsers : 0;

    const usersWithEmail = users.filter((u) => u.email).length;
    const usersWithPhone = users.filter((u) => u.phone).length;
    const usersWithoutContact = users.filter(
      (u) => !u.email && !u.phone
    ).length;

    // Проверка дубликатов
    const emails = users
      .filter((u) => u.email)
      .map((u) => u.email!.toLowerCase());
    const phones = users.filter((u) => u.phone).map((u) => u.phone!);

    const duplicateEmails = emails.length - new Set(emails).size;
    const duplicatePhones = phones.length - new Set(phones).size;

    // Распределение по уровням
    const levelDistribution: Record<string, number> = {};
    users.forEach((user) => {
      levelDistribution[user.currentLevel] =
        (levelDistribution[user.currentLevel] || 0) + 1;
    });

    return {
      totalUsers,
      activeUsers,
      totalPurchases,
      averagePurchase,
      usersWithEmail,
      usersWithPhone,
      duplicateEmails,
      duplicatePhones,
      usersWithoutContact,
      levelDistribution
    };
  }

  private async checkDataIntegrity(users: any[]): Promise<void> {
    // Проверка пользователей без имени
    const usersWithoutName = users.filter((u) => !u.firstName && !u.lastName);
    if (usersWithoutName.length > 0) {
      this.warnings.push(`${usersWithoutName.length} пользователей без имени`);
    }

    // Проверка очень старых дат регистрации
    const oldRegistrations = users.filter((u) => {
      const regDate = new Date(u.registeredAt);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return regDate < new Date('2020-01-01'); // До 2020 года
    });
    if (oldRegistrations.length > 0) {
      this.warnings.push(
        `${oldRegistrations.length} пользователей с очень старой датой регистрации`
      );
    }

    // Проверка отрицательных сумм покупок
    const negativePurchases = users.filter((u) => u.totalPurchases < 0);
    if (negativePurchases.length > 0) {
      this.issues.push(
        `${negativePurchases.length} пользователей с отрицательной суммой покупок`
      );
    }

    // Проверка очень больших сумм (выбросы)
    const highPurchases = users.filter((u) => u.totalPurchases > 1000000); // > 1M
    if (highPurchases.length > 0) {
      this.warnings.push(
        `${highPurchases.length} пользователей с очень большой суммой покупок (>1M₽)`
      );
    }
  }

  private async validateLevels(users: any[], levels: any[]): Promise<void> {
    if (!levels || levels.length === 0) {
      this.issues.push('В проекте не настроены уровни бонусов');
      return;
    }

    // Проверка корректности уровней
    for (const user of users) {
      const userLevel = levels.find((l) => l.name === user.currentLevel);
      if (!userLevel) {
        this.issues.push(
          `Пользователь ${user.email || user.phone} имеет неизвестный уровень: ${user.currentLevel}`
        );
        continue;
      }

      // Проверка соответствия уровня сумме покупок
      const shouldBeHigherLevel = levels
        .filter((l) => l.minAmount <= user.totalPurchases)
        .sort((a, b) => b.minAmount - a.minAmount)[0];

      if (
        shouldBeHigherLevel &&
        shouldBeHigherLevel.name !== user.currentLevel
      ) {
        this.warnings.push(
          `Пользователь ${user.email || user.phone} имеет уровень ${user.currentLevel}, но должен быть ${shouldBeHigherLevel.name} (покупки: ${user.totalPurchases}₽)`
        );
      }
    }
  }

  private printResults(
    stats: ValidationResult['stats'],
    isValid: boolean
  ): void {
    console.log('\n📊 Результаты валидации:');
    console.log(`   Статус: ${isValid ? '✅ Валидна' : '❌ Есть проблемы'}`);

    console.log('\n📈 Статистика пользователей:');
    console.log(`   Всего пользователей: ${stats.totalUsers}`);
    console.log(`   Активных пользователей: ${stats.activeUsers}`);
    console.log(
      `   Общая сумма покупок: ${stats.totalPurchases.toLocaleString()}₽`
    );
    console.log(
      `   Средняя сумма покупок: ${stats.averagePurchase.toFixed(2)}₽`
    );

    console.log('\n📞 Контактная информация:');
    console.log(`   С email: ${stats.usersWithEmail}`);
    console.log(`   С телефоном: ${stats.usersWithPhone}`);
    console.log(`   Без контактов: ${stats.usersWithoutContact}`);

    if (stats.duplicateEmails > 0 || stats.duplicatePhones > 0) {
      console.log('\n⚠️  Дубликаты:');
      console.log(`   Дубликатов email: ${stats.duplicateEmails}`);
      console.log(`   Дубликатов телефонов: ${stats.duplicatePhones}`);
    }

    console.log('\n🏆 Распределение по уровням:');
    Object.entries(stats.levelDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([level, count]) => {
        console.log(`   ${level}: ${count} пользователей`);
      });

    if (this.issues.length > 0) {
      console.log('\n❌ Критические проблемы:');
      this.issues.forEach((issue) => console.log(`   - ${issue}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Предупреждения:');
      this.warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    if (isValid && this.warnings.length === 0) {
      console.log('\n🎉 Миграция прошла успешно без проблем!');
    }
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error('Использование: npm run validate-migration <project-id>');
    console.error('Пример: npm run validate-migration proj_123456');
    process.exit(1);
  }

  const [projectId] = args;

  try {
    const validator = new MigrationValidator(projectId);
    const result = await validator.validate();

    if (!result.isValid) {
      console.log('\n❌ Валидация не пройдена из-за критических ошибок');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка валидации:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { MigrationValidator };
