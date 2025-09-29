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
import csv from 'csv-parser';

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

  // Поля из реального Airtable CSV
  ID?: string;
  Status?: string; // Английское название статуса
  Orders?: string;
  'Cost (from Orders)'?: string;
  AlltimeCost?: string; // Общая сумма покупок
  CashbackLevel?: string; // Уровень кэшбэка
  'Количество бонусов'?: string; // Текущий баланс бонусов
  tilda_level?: string; // Уровень в Tilda
  ref_link?: string; // Реферальная ссылка
}

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  duplicates: number;
}

interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  skipValidation?: boolean;
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

  constructor(
    private projectId: string,
    private options: MigrationOptions = {}
  ) {}

  async migrateFromCSV(csvPath: string): Promise<void> {
    const isDryRun = this.options.dryRun;
    console.log(
      `🚀 ${isDryRun ? 'ПРОБНЫЙ ЗАПУСК' : 'Начинаем'} миграцию данных из Airtable...`
    );
    if (isDryRun) {
      console.log('⚠️  Режим DRY-RUN: данные не будут сохранены в базу');
    }
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

    // Валидация CSV файла
    await this.validateCsvFile(csvPath);

    const customers: AirtableCustomer[] = [];

    // Чтение и парсинг CSV с обработкой проблемных полей
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(
          csv({
            separator: ',', // Используем запятую как основной разделитель
            escape: '"', // Экранирование кавычек
            quote: '"' // Кавычки для полей
          })
        )
        .on('data', (data) => {
          // Очистка данных от лишних полей со скриптами
          const cleanedData: any = {};

          for (const [key, value] of Object.entries(data)) {
            // Пропускаем поля со скриптами и ненужные поля
            if (
              key.includes('script') ||
              key.includes('lk_script') ||
              key.includes('tilda_cashcalc') ||
              key.includes('Calculation')
            ) {
              continue;
            }

            // Очищаем значение от лишних символов
            let cleanValue = String(value || '').trim();

            // Удаляем многострочные скрипты если они есть
            if (
              cleanValue.includes('<script>') ||
              cleanValue.includes('function')
            ) {
              continue;
            }

            cleanedData[key] = cleanValue;
          }

          customers.push(cleanedData);
        })
        .on('end', () => {
          console.log(
            `📊 Прочитано и очищено ${customers.length} строк из CSV`
          );
          console.log('🔍 Пример очищенных данных:', customers[0]);
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
              separator: ','
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

  private async validateCsvFile(csvPath: string): Promise<void> {
    console.log('🔍 Валидация CSV файла...');

    // Проверяем размер файла
    const stats = fs.statSync(csvPath);
    if (stats.size === 0) {
      throw new Error('CSV файл пустой');
    }

    if (stats.size > 100 * 1024 * 1024) {
      // 100MB
      throw new Error('CSV файл слишком большой (>100MB)');
    }

    // Читаем первые несколько строк для валидации
    const sampleCustomers: AirtableCustomer[] = [];
    let lineCount = 0;

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => {
          sampleCustomers.push(data);
          lineCount++;
          if (lineCount >= 5) {
            // Проверяем только первые 5 строк
            // Не завершаем поток, просто прекращаем обработку
          }
        })
        .on('end', () => resolve())
        .on('error', reject);
    });

    if (sampleCustomers.length === 0) {
      throw new Error('Не удалось прочитать данные из CSV файла');
    }

    // Проверяем структуру данных (после очистки)
    const firstRow = sampleCustomers[0];
    const availableFields = Object.keys(firstRow);
    console.log('📋 Доступные поля после очистки:', availableFields);

    // Ищем необходимые поля
    const hasEmail = availableFields.some(
      (field) =>
        field.toLowerCase().includes('email') && firstRow[field]?.includes('@')
    );
    const hasName = availableFields.some(
      (field) =>
        field.toLowerCase().includes('имя') ||
        field.toLowerCase().includes('name')
    );
    const hasBonuses = availableFields.some(
      (field) =>
        field.includes('Количество бонусов') || field.includes('AlltimeCost')
    );

    if (!hasEmail || !hasName) {
      console.warn('⚠️  В CSV файле не найдены необходимые поля (Email, Имя)');
      console.log('📋 Найденные поля:', availableFields);
      console.log('🔄 Попробуем продолжить миграцию...');
    }

    console.log('✅ CSV файл прошел валидацию');
    console.log(
      `📊 Найдено: Email=${hasEmail}, Имя=${hasName}, Бонусы=${hasBonuses}`
    );
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

      // Создание пользователя и связанных данных в транзакции
      let user: any;

      if (this.options.dryRun) {
        // В режиме dry-run только симулируем создание
        user = {
          id: `dry-run-${Date.now()}-${Math.random()}`,
          ...userData,
          referralCode: this.generateReferralCode({
            email: userData.email,
            phone: userData.phone
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        console.log(
          `🔍 DRY-RUN: Симуляция создания пользователя ${user.firstName} ${user.lastName || ''} (баланс: ${userData.currentBonusBalance}₽)`
        );
      } else {
        const createdUser = await prisma.$transaction(async (tx) => {
          // Подготовка данных пользователя (убираем дополнительные поля)
          const {
            currentBonusBalance,
            airtableId,
            referralLink,
            ...userFields
          } = userData;

          // Создание пользователя
          const newUser = await tx.user.create({
            data: userFields
          });

          // Генерация реферального кода
          const referralCode = this.generateReferralCode(newUser);
          if (referralCode) {
            await tx.user.update({
              where: { id: newUser.id },
              data: { referralCode }
            });
          }

          // Создание начальной транзакции на основе суммы покупок
          if (userData.totalPurchases > 0) {
            await tx.transaction.create({
              data: {
                userId: newUser.id,
                amount: userData.totalPurchases.toString(),
                type: 'EARN',
                description:
                  'Начисление бонусов за исторические покупки (миграция из Airtable)',
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 день назад
                userLevel: userData.currentLevel,
                metadata: {
                  migration: true,
                  airtableId,
                  source: 'historical_purchases'
                }
              }
            });
          }

          // Создание транзакции для текущего баланса бонусов (если есть)
          if (currentBonusBalance > 0) {
            await tx.transaction.create({
              data: {
                userId: newUser.id,
                amount: currentBonusBalance.toString(),
                type: 'EARN',
                description:
                  'Перенос текущего баланса бонусов (миграция из Airtable)',
                createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 часов назад
                userLevel: userData.currentLevel,
                metadata: {
                  migration: true,
                  airtableId,
                  source: 'current_balance',
                  originalBalance: customer['Количество бонусов']
                }
              }
            });

            // Создание бонуса для текущего баланса
            await tx.bonus.create({
              data: {
                userId: newUser.id,
                amount: currentBonusBalance.toString(),
                description: 'Перенос текущего баланса из Airtable',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 год
                metadata: {
                  migration: true,
                  airtableId,
                  source: 'current_balance'
                }
              }
            });
          }

          return newUser;
        });
        user = createdUser;
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
    // Поиск полей в очищенных данных (без учета регистра)
    const findField = (possibleNames: string[]): string | undefined => {
      for (const name of possibleNames) {
        // Ищем точное совпадение
        if (customer[name] !== undefined) return customer[name];

        // Ищем без учета регистра
        const key = Object.keys(customer).find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        if (key) return customer[key];
      }
      return undefined;
    };

    const firstName = findField(['Имя', 'Имя клиента', 'name', 'Name']) || '';
    const lastName =
      findField(['Фамилия', 'Фамилия клиента', 'lastname', 'LastName']) || '';
    const email = findField(['Email', 'Email клиента', 'email']);
    const phone = findField(['Телефон', 'Телефон клиента', 'phone', 'Phone']);

    // Преобразование суммы покупок (расширенная логика для Airtable полей)
    const totalPurchasesStr =
      findField([
        'Сумма покупок',
        'Общая сумма',
        'Общая сумма покупок',
        'AlltimeCost',
        'Cost (from Orders)'
      ]) || '0';

    // Более надёжный парсинг чисел с поддержкой разных форматов
    const totalPurchases = this.parseCurrency(totalPurchasesStr);

    // Определение статуса (расширенная логика)
    const status = findField(['Статус', 'Статус клиента', 'Status']) || '';
    const isActive =
      !status.toLowerCase().includes('архив') &&
      !status.toLowerCase().includes('неактив') &&
      status.toLowerCase() !== 'inactive' &&
      status.toLowerCase() !== 'archived';

    // Дата регистрации
    let registeredAt = new Date();
    const purchaseDate = findField(['Дата первой покупки', 'Дата регистрации']);
    if (purchaseDate) {
      const parsedDate = new Date(purchaseDate);
      if (!isNaN(parsedDate.getTime())) {
        registeredAt = parsedDate;
      }
    }

    // Преобразование текущего баланса бонусов
    const currentBonusBalance = this.parseCurrency(
      findField(['Количество бонусов']) || '0'
    );

    // Определение уровня на основе CashbackLevel или tilda_level
    let currentLevel = 'Базовый'; // По умолчанию
    const cashbackLevel = findField([
      'CashbackLevel',
      'tilda_level',
      'Уровень'
    ]);
    if (cashbackLevel) {
      const levelStr = cashbackLevel.toString().toLowerCase();
      if (levelStr.includes('2') || levelStr.includes('серебрян'))
        currentLevel = 'Серебряный';
      else if (levelStr.includes('3') || levelStr.includes('золот'))
        currentLevel = 'Золотой';
      else if (
        levelStr.includes('4') ||
        levelStr.includes('плати') ||
        levelStr.includes('прем')
      )
        currentLevel = 'Платиновый';
    }

    return {
      projectId: this.projectId,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      email: email ? email.toLowerCase().trim() : null,
      phone: phone ? this.normalizePhone(phone) : null,
      birthDate: this.parseDate(customer['Дата рождения']),
      totalPurchases,
      currentLevel,
      isActive,
      registeredAt,
      utmSource: customer['UTM Source'] || customer['Источник'],
      utmMedium: customer['UTM Medium'] || customer['Канал'],
      utmCampaign: customer['UTM Campaign'] || customer['Кампания'],
      utmTerm: customer['UTM Term'] || customer['Ключевые слова'],
      utmContent: customer['UTM Content'] || customer['Содержание'],
      // Дополнительные поля для миграции
      currentBonusBalance,
      airtableId: customer['ID'],
      referralLink: customer['ref_link']
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

  private parseCurrency(currencyStr: string): number {
    if (!currencyStr || typeof currencyStr !== 'string') return 0;

    // Удаляем пробелы и неразрывные пробелы
    let cleanStr = currencyStr.replace(/[\s\u00A0]/g, '');

    // Обрабатываем разные валютные символы
    cleanStr = cleanStr.replace(/[₽$€£¥₴₸₼₺₻₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '');

    // Заменяем запятую на точку, если она используется как разделитель дробной части
    // (европейский формат: 1.234,56 -> 1234.56)
    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      // Если есть и точка и запятая, точка - разделитель тысяч, запятая - дробной части
      cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    } else if (cleanStr.includes(',')) {
      // Если только запятая, считаем её разделителем дробной части
      cleanStr = cleanStr.replace(',', '.');
    }

    // Удаляем все символы кроме цифр и точки
    cleanStr = cleanStr.replace(/[^\d.-]/g, '');

    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : Math.max(0, parsed); // Не допускаем отрицательные суммы
  }

  private async findExistingUser(email?: string | null, phone?: string | null) {
    // Проверяем email
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const userByEmail = await prisma.user.findFirst({
        where: {
          projectId: this.projectId,
          email: normalizedEmail
        }
      });
      if (userByEmail) return userByEmail;
    }

    // Проверяем телефон с различными вариантами нормализации
    if (phone) {
      const normalizedPhone = this.normalizePhone(phone);
      if (normalizedPhone) {
        // Проверяем точное совпадение
        const userByPhone = await prisma.user.findFirst({
          where: {
            projectId: this.projectId,
            phone: normalizedPhone
          }
        });
        if (userByPhone) return userByPhone;

        // Проверяем без форматирования (только цифры)
        const digitsOnly = phone.replace(/\D/g, '');
        if (digitsOnly.length >= 10) {
          const userByDigits = await prisma.user.findFirst({
            where: {
              projectId: this.projectId,
              phone: {
                contains: digitsOnly.slice(-10) // последние 10 цифр
              }
            }
          });
          if (userByDigits) return userByDigits;
        }
      }
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

  public saveMigrationReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      projectId: this.projectId,
      stats: this.stats,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        successRate:
          this.stats.total > 0
            ? (this.stats.successful / this.stats.total) * 100
            : 0,
        hasErrors: this.errors.length > 0,
        hasWarnings: this.warnings.length > 0
      }
    };

    const reportPath = path.join(
      process.cwd(),
      `migration-report-${Date.now()}.json`
    );

    try {
      // Проверяем, что директория существует
      const dir = path.dirname(reportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Отчет сохранен: ${reportPath}`);
    } catch (error) {
      console.error(
        `❌ Ошибка сохранения отчета: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      console.log('📊 Статистика миграции:');
      console.log(JSON.stringify(this.stats, null, 2));
    }
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.length > 3) {
    console.error(
      'Использование: npm run migrate-customers <csv-path> <project-id> [--dry-run]'
    );
    console.error(
      'Пример: npm run migrate-customers customers.csv proj_123456'
    );
    console.error(
      'Пример с dry-run: npm run migrate-customers customers.csv proj_123456 --dry-run'
    );
    console.error(
      'Примечание: CSV файл должен содержать колонки: Имя, Фамилия, Email, Телефон, Сумма покупок'
    );
    process.exit(1);
  }

  const [csvPath, projectId] = args;
  const isDryRun = args.includes('--dry-run');

  // Обработка прерываний для корректного завершения
  let migrationService: AirtableMigrationService | null = null;

  const cleanup = async () => {
    console.log('\n⚠️  Получен сигнал прерывания, завершаем миграцию...');
    if (migrationService) {
      migrationService.saveMigrationReport();
    }
    await prisma.$disconnect();
    process.exit(130);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    migrationService = new AirtableMigrationService(projectId, {
      dryRun: isDryRun,
      batchSize: 50,
      skipValidation: false
    });
    await migrationService.migrateFromCSV(csvPath);
    console.log(
      `\n🎉 ${isDryRun ? 'Пробная миграция' : 'Миграция'} успешно завершена!`
    );
    if (isDryRun) {
      console.log('💡 Для выполнения реальной миграции уберите флаг --dry-run');
    }
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    if (migrationService) {
      migrationService.saveMigrationReport();
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск скрипта если он вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AirtableMigrationService };
