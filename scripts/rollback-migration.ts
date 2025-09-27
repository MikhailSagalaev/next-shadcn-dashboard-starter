/**
 * @file: scripts/rollback-migration.ts
 * @description: Скрипт отката миграции данных из Airtable
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-09-25
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RollbackStats {
  usersDeleted: number;
  transactionsDeleted: number;
  bonusesDeleted: number;
  notificationsDeleted: number;
}

class MigrationRollbackService {
  private stats: RollbackStats = {
    usersDeleted: 0,
    transactionsDeleted: 0,
    bonusesDeleted: 0,
    notificationsDeleted: 0
  };

  constructor(private projectId: string) {}

  async rollback(): Promise<void> {
    console.log('⚠️  Начинаем откат миграции...');
    console.log(`🏢 Проект: ${this.projectId}`);

    // Проверка существования проекта
    const project = await prisma.project.findUnique({
      where: { id: this.projectId }
    });

    if (!project) {
      throw new Error(`Проект с ID ${this.projectId} не найден`);
    }

    console.log(`✅ Проект найден: ${project.name}`);

    // Создание резервной копии перед удалением
    await this.createBackup();

    // Подтверждение от пользователя
    console.log('\n🚨 ВНИМАНИЕ!');
    console.log(
      'Этот скрипт удалит ВСЕХ пользователей проекта и связанные данные.'
    );
    console.log('Резервная копия создана в файле backup_rollback.json');
    console.log('Вы уверены, что хотите продолжить? (y/N)');

    // В автоматическом режиме пропускаем подтверждение
    const confirmed =
      process.env.SKIP_CONFIRMATION === 'true' ||
      (await this.getUserConfirmation());

    if (!confirmed) {
      console.log('❌ Откат отменен пользователем');
      return;
    }

    // Основной откат
    await this.performRollback();

    // Финальная статистика
    this.printFinalStats();
  }

  private async createBackup(): Promise<void> {
    console.log('📦 Создание резервной копии...');

    // Получение всех данных проекта
    const users = await prisma.user.findMany({
      where: { projectId: this.projectId },
      include: {
        bonuses: true,
        transactions: true,
        notifications: true
      }
    });

    const backup = {
      timestamp: new Date().toISOString(),
      projectId: this.projectId,
      users: users
    };

    const backupPath = path.join(
      process.cwd(),
      `backup_rollback_${Date.now()}.json`
    );
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    console.log(`✅ Резервная копия создана: ${backupPath}`);
  }

  private async getUserConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', (input) => {
        const answer = input.toString().trim().toLowerCase();
        resolve(answer === 'y' || answer === 'yes');
      });
    });
  }

  private async performRollback(): Promise<void> {
    console.log('🗑️  Начинаем удаление данных...');

    // Получение количества записей перед удалением
    const userCount = await prisma.user.count({
      where: { projectId: this.projectId }
    });

    const transactionCount = await prisma.transaction.count({
      where: {
        user: {
          projectId: this.projectId
        }
      }
    });

    const bonusCount = await prisma.bonus.count({
      where: {
        user: {
          projectId: this.projectId
        }
      }
    });

    const notificationCount = await prisma.notification.count({
      where: {
        user: {
          projectId: this.projectId
        }
      }
    });

    console.log(`📊 Будет удалено:`);
    console.log(`   Пользователей: ${userCount}`);
    console.log(`   Транзакций: ${transactionCount}`);
    console.log(`   Бонусов: ${bonusCount}`);
    console.log(`   Уведомлений: ${notificationCount}`);

    // Удаление в правильном порядке (сначала дочерние записи)
    console.log('🗑️  Удаление уведомлений...');
    const notificationsDeleted = await prisma.notification.deleteMany({
      where: {
        user: {
          projectId: this.projectId
        }
      }
    });
    this.stats.notificationsDeleted = notificationsDeleted.count;

    console.log('🗑️  Удаление бонусов...');
    const bonusesDeleted = await prisma.bonus.deleteMany({
      where: {
        user: {
          projectId: this.projectId
        }
      }
    });
    this.stats.bonusesDeleted = bonusesDeleted.count;

    console.log('🗑️  Удаление транзакций...');
    const transactionsDeleted = await prisma.transaction.deleteMany({
      where: {
        user: {
          projectId: this.projectId
        }
      }
    });
    this.stats.transactionsDeleted = transactionsDeleted.count;

    console.log('🗑️  Удаление пользователей...');
    const usersDeleted = await prisma.user.deleteMany({
      where: { projectId: this.projectId }
    });
    this.stats.usersDeleted = usersDeleted.count;

    console.log('✅ Все данные удалены');
  }

  private printFinalStats(): void {
    console.log('\n🎉 Откат миграции завершен!');
    console.log('📊 Статистика удаления:');
    console.log(`   ❌ Пользователей удалено: ${this.stats.usersDeleted}`);
    console.log(`   ❌ Транзакций удалено: ${this.stats.transactionsDeleted}`);
    console.log(`   ❌ Бонусов удалено: ${this.stats.bonusesDeleted}`);
    console.log(
      `   ❌ Уведомлений удалено: ${this.stats.notificationsDeleted}`
    );

    console.log('\n⚠️  ВНИМАНИЕ:');
    console.log('Проект остался без пользователей.');
    console.log('Если нужно восстановить данные, используйте резервную копию.');
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    console.log('🔄 Начинаем восстановление из резервной копии...');
    console.log(`📁 Файл: ${backupPath}`);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Файл резервной копии не найден: ${backupPath}`);
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    if (backup.projectId !== this.projectId) {
      throw new Error(
        `Резервная копия не соответствует проекту ${this.projectId}`
      );
    }

    console.log(`📊 Восстановление ${backup.users.length} пользователей...`);

    // Восстановление пользователей
    for (const userData of backup.users) {
      const { bonuses, transactions, notifications, ...userFields } = userData;

      // Создание пользователя
      const user = await prisma.user.create({
        data: {
          ...userFields,
          bonuses: {
            create: bonuses.map((b: any) => ({
              amount: b.amount,
              type: b.type,
              description: b.description,
              expiresAt: b.expiresAt,
              isUsed: b.isUsed
            }))
          },
          transactions: {
            create: transactions.map((t: any) => ({
              amount: t.amount,
              type: t.type,
              description: t.description,
              metadata: t.metadata
            }))
          },
          notifications: {
            create: notifications.map((n: any) => ({
              type: n.type,
              title: n.title,
              message: n.message,
              isRead: n.isRead,
              metadata: n.metadata
            }))
          }
        }
      });

      console.log(`✅ Восстановлен: ${user.firstName} ${user.lastName || ''}`);
    }

    console.log('🎉 Восстановление завершено!');
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'rollback' && args.length === 2) {
    const [, projectId] = args;
    const rollback = new MigrationRollbackService(projectId);
    await rollback.rollback();
  } else if (command === 'restore' && args.length === 3) {
    const [, projectId, backupPath] = args;
    const rollback = new MigrationRollbackService(projectId);
    await rollback.restoreFromBackup(backupPath);
  } else {
    console.error('Использование:');
    console.error('  Откат: npm run rollback-migration <project-id>');
    console.error(
      '  Восстановление: npm run rollback-migration restore <project-id> <backup-path>'
    );
    console.error('');
    console.error('Примеры:');
    console.error('  npm run rollback-migration proj_123456');
    console.error(
      '  npm run rollback-migration restore proj_123456 backup_rollback_123456.json'
    );
    process.exit(1);
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

export { MigrationRollbackService };
