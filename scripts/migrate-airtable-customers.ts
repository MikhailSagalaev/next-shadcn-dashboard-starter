/**
 * @file: scripts/migrate-airtable-customers.ts
 * @description: Скрипт миграции заказчиков из Airtable в SaaS бонусную систему
 * @project: SaaS Bonus System
 * @dependencies: Prisma, csv-parser, fs
 * @created: 2025-09-25
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';

const prisma = new PrismaClient();

interface AirtableCustomer {
  // Основные поля (могут быть в разных форматах)
  Имя?: string;
  Фамилия?: string;
  Email?: string;
  Телефон?: string;
  'Дата рождения'?: string;
  Город?: string;
  Адрес?: string;
  Компания?: string;
  'Сумма покупок'?: string;
  'Количество покупок'?: string;
  'Дата первой покупки'?: string;
  'Дата последней активности'?: string;
  Статус?: string;
  'UTM Source'?: string;
  'UTM Medium'?: string;
  'UTM Campaign'?: string;
  'UTM Term'?: string;
  'UTM Content'?: string;
  Комментарии?: string;
  'Реферальный код'?: string;

  // Альтернативные названия полей (для гибкости)
  'Имя клиента'?: string;
  'Фамилия клиента'?: string;
  'Email клиента'?: string;
  'Телефон клиента'?: string;
  'Общая сумма'?: string;
  'Общая сумма покупок'?: string;
  'Статус клиента'?: string;
  Источник?: string;
  Канал?: string;
  Кампания?: string;
  'Ключевые слова'?: string;
  Содержание?: string;
}

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  duplicates: number;
}

class AirtableMigrationService {
  private stats: MigrationStats = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0
  };

  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(private projectId: string) {}

  async migrateFromCSV(csvPath: string): Promise<void> {
    console.log('🚀 Начинаем миграцию данных из Airtable...');
    console.log(`📁 Файл: ${csvPath}`);
    console.log(`🏢 Проект: ${this.projectId}`);

    // Проверка существования файла
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Файл не найден: ${csvPath}`);
    }

    // Проверка существования проекта
    const project = await prisma.project.findUnique({
      where: { id: this.projectId }
    });

    if (!project) {
      throw new Error(`Проект с ID ${this.projectId} не найден`);
    }

    console.log(`✅ Проект найден: ${project.name}`);

    const customers: AirtableCustomer[] = [];

    // Чтение и парсинг CSV
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(
          csv({
            separator: ';', // Попробовать разные разделители
            skipEmptyLines: true,
            trim: true
          })
        )
        .on('data', (data) => customers.push(data))
        .on('end', () => {
          console.log(`📊 Прочитано ${customers.length} строк из CSV`);
          resolve();
        })
        .on('error', reject);
    });

    // Если не прочитано ничего, попробовать с запятой
    if (customers.length === 0) {
      console.log('🔄 Попробуем прочитать с разделителем запятая...');
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(csvPath)
          .pipe(
            csv({
              separator: ',',
              skipEmptyLines: true,
              trim: true
            })
          )
          .on('data', (data) => customers.push(data))
          .on('end', () => {
            console.log(
              `📊 Прочитано ${customers.length} строк из CSV (запятая)`
            );
            resolve();
          })
          .on('error', reject);
      });
    }

    this.stats.total = customers.length;

    // Показать пример данных для анализа
    if (customers.length > 0) {
      console.log('\n📋 Пример первой строки данных:');
      console.log(JSON.stringify(customers[0], null, 2));
      console.log('\n🔍 Доступные поля:', Object.keys(customers[0]));
    }

    // Основная миграция
    console.log('\n🔄 Начинаем миграцию пользователей...');

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      if (i > 0 && i % 50 === 0) {
        console.log(`📈 Обработано ${i}/${customers.length} пользователей...`);
      }

      await this.migrateCustomer(customer);
    }

    // Финальная статистика
    this.printFinalStats();

    // Сохранение отчета
    this.saveMigrationReport();
  }

  private async migrateCustomer(customer: AirtableCustomer): Promise<void> {
    try {
      // Преобразование данных
      const userData = this.transformCustomerData(customer);

      // Проверка обязательных полей
      if (!userData.email && !userData.phone) {
        this.errors.push(
          `Пользователь без email и телефона: ${JSON.stringify(customer)}`
        );
        this.stats.skipped++;
        return;
      }

      // Проверка дубликатов
      const existingUser = await this.findExistingUser(
        userData.email,
        userData.phone
      );
      if (existingUser) {
        this.warnings.push(
          `Дубликат найден: ${userData.email || userData.phone} (существующий ID: ${existingUser.id})`
        );
        this.stats.duplicates++;
        this.stats.skipped++;
        return;
      }

      // Создание пользователя
      const user = await prisma.user.create({
        data: userData
      });

      // Генерация реферального кода
      const referralCode = this.generateReferralCode(user);
      if (referralCode) {
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode }
        });
      }

      // Создание начальной транзакции на основе суммы покупок
      if (userData.totalPurchases > 0) {
        await this.createInitialPurchaseTransaction(
          user.id,
          userData.totalPurchases
        );
      }

      this.stats.successful++;
      console.log(
        `✅ Создан: ${user.firstName} ${user.lastName || ''} (${user.email || user.phone})`
      );
    } catch (error) {
      const errorMsg = `❌ Ошибка миграции пользователя ${customer['Email'] || customer['Телефон']}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMsg);
      console.error(errorMsg);
      this.stats.failed++;
    }
  }

  private transformCustomerData(customer: AirtableCustomer): any {
    // Маппинг полей с поддержкой альтернативных названий
    const firstName = customer['Имя'] || customer['Имя клиента'] || '';
    const lastName = customer['Фамилия'] || customer['Фамилия клиента'] || '';
    const email = customer['Email'] || customer['Email клиента'];
    const phone = customer['Телефон'] || customer['Телефон клиента'];

    // Преобразование суммы покупок
    const totalPurchasesStr =
      customer['Сумма покупок'] ||
      customer['Общая сумма'] ||
      customer['Общая сумма покупок'] ||
      '0';
    const totalPurchases =
      parseFloat(totalPurchasesStr.replace(/[^\d.,]/g, '').replace(',', '.')) ||
      0;

    // Определение статуса
    const status = customer['Статус'] || customer['Статус клиента'] || '';
    const isActive =
      !status.toLowerCase().includes('архив') &&
      !status.toLowerCase().includes('неактив');

    // Дата регистрации
    let registeredAt = new Date();
    const purchaseDate = customer['Дата первой покупки'];
    if (purchaseDate) {
      const parsedDate = new Date(purchaseDate);
      if (!isNaN(parsedDate.getTime())) {
        registeredAt = parsedDate;
      }
    }

    return {
      projectId: this.projectId,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      email: email ? email.toLowerCase().trim() : null,
      phone: phone ? this.normalizePhone(phone) : null,
      birthDate: this.parseDate(customer['Дата рождения']),
      totalPurchases,
      isActive,
      registeredAt,
      utmSource: customer['UTM Source'] || customer['Источник'],
      utmMedium: customer['UTM Medium'] || customer['Канал'],
      utmCampaign: customer['UTM Campaign'] || customer['Кампания'],
      utmTerm: customer['UTM Term'] || customer['Ключевые слова'],
      utmContent: customer['UTM Content'] || customer['Содержание']
    };
  }

  private normalizePhone(phone?: string): string | null {
    if (!phone) return null;

    // Удалить все кроме цифр
    const cleaned = phone.replace(/\D/g, '');

    // Если начинается с 7 или 8, преобразовать в международный формат
    if (cleaned.startsWith('7')) {
      return `+7${cleaned.slice(1)}`;
    }
    if (cleaned.startsWith('8')) {
      return `+7${cleaned.slice(1)}`;
    }

    // Если уже в международном формате
    if (cleaned.length === 11 && cleaned.startsWith('7')) {
      return `+${cleaned}`;
    }

    // Для коротких номеров - попытаться добавить код
    if (cleaned.length === 10) {
      return `+7${cleaned}`;
    }

    return phone; // Вернуть как есть, если не распознан формат
  }

  private parseDate(dateStr?: string): Date | null {
    if (!dateStr) return null;

    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  private async findExistingUser(email?: string | null, phone?: string | null) {
    if (email) {
      const user = await prisma.user.findFirst({
        where: {
          projectId: this.projectId,
          email: email.toLowerCase()
        }
      });
      if (user) return user;
    }

    if (phone) {
      const user = await prisma.user.findFirst({
        where: {
          projectId: this.projectId,
          phone: this.normalizePhone(phone)
        }
      });
      if (user) return user;
    }

    return null;
  }

  private generateReferralCode(user: any): string | null {
    if (!user.email && !user.phone) return null;

    const base = user.email
      ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
      : user.phone.replace(/\D/g, '').slice(-6);

    const random = Math.random().toString(36).substring(2, 6);
    return `${base}_${random}`.toUpperCase();
  }

  private async createInitialPurchaseTransaction(
    userId: string,
    amount: number
  ): Promise<void> {
    await prisma.transaction.create({
      data: {
        userId,
        amount: amount.toString(),
        type: 'EARN',
        description:
          'Начисление бонусов за исторические покупки (миграция из Airtable)',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 день назад
      }
    });
  }

  private printFinalStats(): void {
    console.log('\n🎉 Миграция завершена!');
    console.log('📊 Статистика:');
    console.log(`   Всего записей: ${this.stats.total}`);
    console.log(`   ✅ Успешно: ${this.stats.successful}`);
    console.log(`   ❌ Ошибок: ${this.stats.failed}`);
    console.log(`   ⏭️  Пропущено: ${this.stats.skipped}`);
    console.log(`   🔄 Дубликатов: ${this.stats.duplicates}`);

    if (this.errors.length > 0) {
      console.log('\n❌ Ошибки:');
      this.errors.slice(0, 10).forEach((error) => console.log(`   - ${error}`));
      if (this.errors.length > 10) {
        console.log(`   ... и еще ${this.errors.length - 10} ошибок`);
      }
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Предупреждения:');
      this.warnings
        .slice(0, 10)
        .forEach((warning) => console.log(`   - ${warning}`));
      if (this.warnings.length > 10) {
        console.log(`   ... и еще ${this.warnings.length - 10} предупреждений`);
      }
    }
  }

  private saveMigrationReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      projectId: this.projectId,
      stats: this.stats,
      errors: this.errors,
      warnings: this.warnings
    };

    const reportPath = path.join(process.cwd(), 'migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Отчет сохранен: ${reportPath}`);
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error(
      'Использование: npm run migrate-customers <csv-path> <project-id>'
    );
    console.error(
      'Пример: npm run migrate-customers customers.csv proj_123456'
    );
    process.exit(1);
  }

  const [csvPath, projectId] = args;

  try {
    const migration = new AirtableMigrationService(projectId);
    await migration.migrateFromCSV(csvPath);
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { AirtableMigrationService };
