/**
 * @file: scripts/import-users-from-csv.ts
 * @description: Универсальный скрипт импорта пользователей из CSV (Email, Name, bonuses, phone)
 * @project: SaaS Bonus System
 * @dependencies: Prisma, csv-parser, fs
 * @created: 2025-12-02
 * @author: AI Assistant + User
 */

import { PrismaClient, BonusType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface CsvUser {
  ID?: string;
  Email?: string;
  email?: string;
  Name?: string;
  name?: string;
  Имя?: string;
  bonuses?: string;
  Bonuses?: string;
  'Количество бонусов'?: string;
  phone?: string;
  Phone?: string;
  Телефон?: string;
  // Дополнительные поля для совместимости
  firstName?: string;
  lastName?: string;
  Referer?: string;
  referredBy?: string;
  [key: string]: string | undefined;
}

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface ImportOptions {
  projectId: string;
  bonusExpiryDays: number;
  updateExisting: boolean;
  dryRun: boolean;
}

class CsvUserImporter {
  private stats: ImportStats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };
  private errors: string[] = [];
  private referralMap: Map<string, string> = new Map(); // airtableId -> userId

  constructor(private options: ImportOptions) {}

  async importFromCsv(csvPath: string): Promise<ImportStats> {
    console.log(
      `🚀 ${this.options.dryRun ? '[DRY-RUN] ' : ''}Импорт пользователей из CSV`
    );
    console.log(`📁 Файл: ${csvPath}`);
    console.log(`🏢 Проект: ${this.options.projectId}`);
    console.log(
      `📅 Срок действия бонусов: ${this.options.bonusExpiryDays} дней`
    );
    console.log(
      `🔄 Обновлять существующих: ${this.options.updateExisting ? 'Да' : 'Нет'}`
    );

    // Проверка файла
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Файл не найден: ${csvPath}`);
    }

    // Проверка проекта
    const project = await prisma.project.findUnique({
      where: { id: this.options.projectId }
    });

    if (!project) {
      throw new Error(`Проект не найден: ${this.options.projectId}`);
    }

    console.log(`✅ Проект: ${project.name}`);

    // Чтение CSV
    const users = await this.readCsv(csvPath);
    this.stats.total = users.length;
    console.log(`📊 Найдено записей: ${users.length}`);

    if (users.length > 0) {
      console.log('📋 Пример данных:', JSON.stringify(users[0], null, 2));
    }

    // Первый проход: создаем пользователей
    console.log('\n🔄 Импорт пользователей...');
    for (let i = 0; i < users.length; i++) {
      if (i > 0 && i % 50 === 0) {
        console.log(`📈 Обработано ${i}/${users.length}...`);
      }
      await this.importUser(users[i]);
    }

    // Второй проход: восстанавливаем реферальные связи
    if (this.referralMap.size > 0) {
      console.log('\n🔗 Восстановление реферальных связей...');
      await this.restoreReferralLinks(users);
    }

    this.printStats();
    return this.stats;
  }

  private async readCsv(csvPath: string): Promise<CsvUser[]> {
    const users: CsvUser[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(
          csv({
            separator: ',',
            quote: '"',
            escape: '"'
          })
        )
        .on('data', (data) => {
          // Очистка данных от скриптов и лишних полей
          const cleanedData: CsvUser = {};
          for (const [key, value] of Object.entries(data)) {
            if (key.includes('script') || key.includes('Calculation')) continue;
            const strValue = String(value || '').trim();
            if (strValue.includes('<script>') || strValue.includes('function'))
              continue;
            cleanedData[key] = strValue;
          }
          users.push(cleanedData);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    return users;
  }

  private async importUser(csvUser: CsvUser): Promise<void> {
    try {
      const userData = this.transformUserData(csvUser);

      if (!userData.email && !userData.phone) {
        this.stats.skipped++;
        return;
      }

      // Поиск существующего пользователя
      const existingUser = await this.findExistingUser(
        userData.email,
        userData.phone
      );

      if (existingUser) {
        if (this.options.updateExisting) {
          await this.updateUser(existingUser.id, userData, csvUser);
          this.stats.updated++;
        } else {
          this.stats.skipped++;
        }
        // Сохраняем маппинг для реферальных связей
        if (csvUser.ID) {
          this.referralMap.set(csvUser.ID, existingUser.id);
        }
        return;
      }

      // Создание нового пользователя
      if (!this.options.dryRun) {
        const newUser = await this.createUser(userData, csvUser);
        if (csvUser.ID) {
          this.referralMap.set(csvUser.ID, newUser.id);
        }
      }
      this.stats.created++;
    } catch (error) {
      this.stats.errors++;
      const msg = `Ошибка импорта ${csvUser.Email || csvUser.email}: ${error instanceof Error ? error.message : 'Unknown'}`;
      this.errors.push(msg);
      console.error(`❌ ${msg}`);
    }
  }

  private transformUserData(csvUser: CsvUser) {
    // Извлечение email
    const email =
      (csvUser.Email || csvUser.email || '').toLowerCase().trim() || null;

    // Извлечение имени
    let firstName =
      csvUser.Name || csvUser.name || csvUser.Имя || csvUser.firstName || '';
    let lastName = csvUser.lastName || '';

    // Если имя содержит пробел, разделяем на firstName и lastName
    if (firstName.includes(' ')) {
      const parts = firstName.split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }

    // Извлечение телефона
    const phone = this.normalizePhone(
      csvUser.phone || csvUser.Phone || csvUser.Телефон
    );

    // Извлечение бонусов
    const bonusesStr =
      csvUser.bonuses ||
      csvUser.Bonuses ||
      csvUser['Количество бонусов'] ||
      '0';
    const bonuses = this.parseNumber(bonusesStr);

    // Извлечение реферера
    const referredBy = csvUser.Referer || csvUser.referredBy || null;

    return {
      projectId: this.options.projectId,
      email,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      phone,
      bonuses,
      referredBy,
      isActive: true,
      currentLevel: 'Базовый',
      totalPurchases: 0
    };
  }

  private normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return null;

    if (cleaned.startsWith('7') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('8') && cleaned.length === 11) {
      return `+7${cleaned.slice(1)}`;
    }
    if (cleaned.length === 10) {
      return `+7${cleaned}`;
    }
    return phone;
  }

  private parseNumber(str: string): number {
    if (!str) return 0;
    const cleaned = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  private async findExistingUser(email: string | null, phone: string | null) {
    if (email) {
      const user = await prisma.user.findFirst({
        where: { projectId: this.options.projectId, email }
      });
      if (user) return user;
    }

    if (phone) {
      const user = await prisma.user.findFirst({
        where: { projectId: this.options.projectId, phone }
      });
      if (user) return user;
    }

    return null;
  }

  private async createUser(userData: any, csvUser: CsvUser) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.options.bonusExpiryDays);

    return await prisma.$transaction(async (tx) => {
      // Создаем пользователя
      const user = await tx.user.create({
        data: {
          projectId: userData.projectId,
          email: userData.email,
          phone: userData.phone,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isActive: userData.isActive,
          currentLevel: userData.currentLevel,
          totalPurchases: userData.totalPurchases,
          referralCode: this.generateReferralCode(
            userData.email,
            userData.phone
          )
        }
      });

      // Создаем бонусы если есть
      if (userData.bonuses > 0) {
        await tx.bonus.create({
          data: {
            userId: user.id,
            amount: userData.bonuses,
            type: BonusType.MANUAL,
            description: 'Импорт из CSV (миграция)',
            expiresAt,
            metadata: {
              migration: true,
              source: 'csv_import',
              importDate: new Date().toISOString()
            }
          }
        });

        await tx.transaction.create({
          data: {
            userId: user.id,
            amount: userData.bonuses,
            type: 'EARN',
            description: 'Импорт бонусов из CSV',
            userLevel: userData.currentLevel,
            metadata: {
              migration: true,
              source: 'csv_import'
            }
          }
        });
      }

      console.log(
        `✅ Создан: ${user.firstName || ''} ${user.lastName || ''} (${user.email || user.phone}) - ${userData.bonuses} бонусов`
      );
      return user;
    });
  }

  private async updateUser(userId: string, userData: any, csvUser: CsvUser) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.options.bonusExpiryDays);

    if (this.options.dryRun) {
      console.log(
        `🔄 [DRY-RUN] Обновление: ${userData.email || userData.phone}`
      );
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Обновляем данные пользователя
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: userData.firstName || undefined,
          lastName: userData.lastName || undefined,
          phone: userData.phone || undefined
        }
      });

      // Добавляем бонусы если есть
      if (userData.bonuses > 0) {
        // Проверяем текущий баланс
        const currentBonuses = await tx.bonus.aggregate({
          where: { userId, isUsed: false },
          _sum: { amount: true }
        });

        const currentBalance = Number(currentBonuses._sum.amount || 0);
        const diff = userData.bonuses - currentBalance;

        if (diff > 0) {
          await tx.bonus.create({
            data: {
              userId,
              amount: diff,
              type: BonusType.MANUAL,
              description: 'Корректировка баланса при импорте из CSV',
              expiresAt,
              metadata: {
                migration: true,
                source: 'csv_import_update',
                previousBalance: currentBalance,
                newBalance: userData.bonuses
              }
            }
          });

          await tx.transaction.create({
            data: {
              userId,
              amount: diff,
              type: 'EARN',
              description: 'Корректировка баланса при импорте из CSV',
              metadata: { migration: true }
            }
          });
        }
      }

      console.log(`🔄 Обновлен: ${userData.email || userData.phone}`);
    });
  }

  private async restoreReferralLinks(users: CsvUser[]) {
    for (const csvUser of users) {
      const referrerId = csvUser.Referer || csvUser.referredBy;
      if (!referrerId) continue;

      const userId = this.referralMap.get(csvUser.ID || '');
      const referrerUserId = this.referralMap.get(referrerId);

      if (userId && referrerUserId && !this.options.dryRun) {
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { referredBy: referrerUserId }
          });
          console.log(`🔗 Связь: ${csvUser.Email || csvUser.email} -> реферер`);
        } catch (error) {
          // Игнорируем ошибки связей
        }
      }
    }
  }

  private generateReferralCode(
    email: string | null,
    phone: string | null
  ): string {
    const base = email
      ? email
          .split('@')[0]
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 8)
      : phone?.replace(/\D/g, '').slice(-6) || 'user';
    const random = Math.random().toString(36).substring(2, 6);
    return `${base}_${random}`.toUpperCase();
  }

  private printStats() {
    console.log('\n🎉 Импорт завершен!');
    console.log('📊 Статистика:');
    console.log(`   Всего: ${this.stats.total}`);
    console.log(`   ✅ Создано: ${this.stats.created}`);
    console.log(`   🔄 Обновлено: ${this.stats.updated}`);
    console.log(`   ⏭️ Пропущено: ${this.stats.skipped}`);
    console.log(`   ❌ Ошибок: ${this.stats.errors}`);

    if (this.errors.length > 0) {
      console.log('\n❌ Ошибки:');
      this.errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`));
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      'Использование: npx tsx scripts/import-users-from-csv.ts <csv-path> <project-id> [--dry-run]'
    );
    console.log(
      'Пример: npx tsx scripts/import-users-from-csv.ts "Users-Grid view (3).csv" cmilhq0y600099e7uraiowrmt'
    );
    process.exit(1);
  }

  const [csvPath, projectId] = args;
  const dryRun = args.includes('--dry-run');

  const importer = new CsvUserImporter({
    projectId,
    bonusExpiryDays: 90,
    updateExisting: true,
    dryRun
  });

  try {
    await importer.importFromCsv(csvPath);
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск
main();

export { CsvUserImporter };
export type { ImportOptions, ImportStats };
