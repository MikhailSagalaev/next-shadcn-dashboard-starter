/**
 * @file: scripts/import-minicosmetics-users.ts
 * @description: Скрипт импорта пользователей из CSV файла Mini Cosmetics
 * @project: SaaS Bonus System
 * @dependencies: Prisma, csv-parser, fs, path
 * @created: 2025-11-02
 * @author: AI Assistant + User
 */

import { db } from '../src/lib/db';
import { UserService } from '../src/lib/services/user.service';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

// Интерфейс для данных из CSV
interface MiniCosmeticsUser {
  ID: string;
  'First Name': string;
  'Last Name': string;
  return?: string;
  ВИЗИТ?: string;
  'Подписка на телеграм канал'?: string;
  'User ID': string; // Telegram User ID
  Nickname: string; // Telegram username
  Gender?: string;
  'Last Access': string;
  'Created At': string;
  'Channel Name': string;
  'Channel ID': string;
  'Channel Resource': string;
  'UTM Source'?: string;
  'UTM Medium'?: string;
  'UTM Campaign'?: string;
  'UTM Term'?: string;
  'UTM Content'?: string;
  RS?: string;
  Roistat?: string;
  'Roistat Visit'?: string;
  'Openstat Service'?: string;
  'Openstat Campaign'?: string;
  'Openstat Ad'?: string;
  'Openstat Source'?: string;
  From?: string;
  GClientID?: string;
  'YM UID'?: string;
  'YM Counter'?: string;
  gclid?: string;
  yclid?: string;
  fbclid?: string;
  'RB ClickID'?: string;
  phone?: string;
  email?: string;
  'ПОДПИСКА НА КАНАЛ'?: string;
  ПРОМОКОД?: string;
  'Повторный запуск'?: string;
  Попытки?: string;
  Задание?: string;
  ПОПЫТКА?: string;
  incoming_message_text?: string;
}

async function importMiniCosmeticsUsers() {
  const csvFilePath = path.join(process.cwd(), 'export_minicosmetics_2025-10-03T13_10_20.148Z.csv');

  // Проверяем существование файла
  if (!fs.existsSync(csvFilePath)) {
    console.error('❌ CSV файл не найден:', csvFilePath);
    process.exit(1);
  }

  // Получаем projectId из аргументов командной строки или используем значение по умолчанию
  const projectId = process.argv[2] || 'cmfa8oqx000019e372pk9547l'; // Из предыдущих логов

  console.log('🚀 Начинаем импорт пользователей Mini Cosmetics');
  console.log('📁 Файл:', csvFilePath);
  console.log('🏢 Проект ID:', projectId);

  // Проверяем существование проекта
  const project = await db.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    console.error('❌ Проект не найден:', projectId);
    process.exit(1);
  }

  console.log('✅ Проект найден:', project.name);

  const users: MiniCosmeticsUser[] = [];
  let processedCount = 0;
  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Читаем CSV файл
  const stream = fs.createReadStream(csvFilePath)
    .pipe(csv({
      separator: ',',
      quote: '"',
      escape: '"'
    }));

  // Собираем все данные из CSV
  for await (const row of stream) {
    users.push(row as MiniCosmeticsUser);
  }

  console.log(`📊 Найдено записей в CSV: ${users.length}`);

  // Импортируем пользователей
  for (const csvUser of users) {
    try {
      processedCount++;

      // Пропускаем заголовок
      if (csvUser.ID === 'ID') continue;

      // Логируем прогресс каждые 100 пользователей
      if (processedCount % 100 === 0) {
        console.log(`🔄 Обработано: ${processedCount}/${users.length}`);
      }

      // Извлекаем данные пользователя
      const userData = {
        projectId,
        firstName: csvUser['First Name']?.trim() || null,
        lastName: csvUser['Last Name']?.trim() || null,
        phone: csvUser.phone?.trim() || null,
        email: csvUser.email?.trim().toLowerCase() || null,
        telegramId: csvUser['User ID'] ? BigInt(csvUser['User ID']) : null,
        telegramUsername: csvUser.Nickname?.trim() || null,

        // UTM метки
        utmSource: csvUser['UTM Source']?.trim() || null,
        utmMedium: csvUser['UTM Medium']?.trim() || null,
        utmCampaign: csvUser['UTM Campaign']?.trim() || null,
        utmTerm: csvUser['UTM Term']?.trim() || null,
        utmContent: csvUser['UTM Content']?.trim() || null,

        // Преобразуем дату создания
        registeredAt: csvUser['Created At'] ? new Date(csvUser['Created At']) : new Date(),
      };

      // Проверяем, что у пользователя есть хотя бы один контакт
      if (!userData.email && !userData.phone && !userData.telegramId) {
        console.log(`⚠️ Пропускаем пользователя ${csvUser.ID}: нет контактных данных`);
        skippedCount++;
        continue;
      }

      // Проверяем, существует ли уже пользователь в этом проекте по ВСЕМ возможным критериям
      let existingUser = null;
      let searchCriteria = '';

      // Проверяем по telegramId (самый уникальный)
      if (userData.telegramId) {
        existingUser = await db.user.findFirst({
          where: {
            projectId,
            telegramId: userData.telegramId
          }
        });
        if (existingUser) {
          searchCriteria = `telegramId: ${userData.telegramId}`;
        }
      }

      // Если не нашли по telegramId, проверяем по email
      if (!existingUser && userData.email) {
        existingUser = await db.user.findFirst({
          where: {
            projectId,
            email: userData.email
          }
        });
        if (existingUser) {
          searchCriteria = `email: ${userData.email}`;
        }
      }

      // Если не нашли по email, проверяем по телефону
      if (!existingUser && userData.phone) {
        existingUser = await db.user.findFirst({
          where: {
            projectId,
            phone: userData.phone
          }
        });
        if (existingUser) {
          searchCriteria = `phone: ${userData.phone}`;
        }
      }

      if (existingUser) {
        // Пользователь уже существует - пропускаем без обновления
        console.log(`⚠️ Пользователь уже существует: ${searchCriteria}`);
        skippedCount++;
        continue;
      }

      // Перед созданием дополнительно проверяем на конфликты
      const conflictChecks = [];

      if (userData.email) {
        const emailConflict = await db.user.findFirst({
          where: { projectId, email: userData.email }
        });
        if (emailConflict) {
          conflictChecks.push(`email уже занят: ${userData.email}`);
        }
      }

      if (userData.phone) {
        const phoneConflict = await db.user.findFirst({
          where: { projectId, phone: userData.phone }
        });
        if (phoneConflict) {
          conflictChecks.push(`phone уже занят: ${userData.phone}`);
        }
      }

      if (userData.telegramId) {
        const telegramConflict = await db.user.findFirst({
          where: { projectId, telegramId: userData.telegramId }
        });
        if (telegramConflict) {
          conflictChecks.push(`telegramId уже занят: ${userData.telegramId}`);
        }
      }

      if (conflictChecks.length > 0) {
        console.log(`⚠️ Конфликт данных для пользователя ${csvUser.ID}: ${conflictChecks.join(', ')}`);
        skippedCount++;
        continue;
      }

      // Создаем нового пользователя
      try {
        const newUser = await UserService.createUser(userData);
        importedCount++;
        console.log(`✅ Импортирован пользователь: ${newUser.firstName || ''} ${newUser.lastName || ''} (${newUser.email || newUser.phone || newUser.telegramUsername || 'ID: ' + newUser.id})`);
      } catch (createError) {
        console.error(`❌ Ошибка создания пользователя ${csvUser.ID}:`, createError);
        errorCount++;
        continue;
      }

    } catch (error) {
      errorCount++;
      console.error(`❌ Ошибка импорта пользователя ${csvUser.ID}:`, error);
    }
  }

  console.log('\n🎉 Импорт завершен!');
  console.log(`📊 Статистика:`);
  console.log(`  ✅ Импортировано: ${importedCount}`);
  console.log(`  ⚠️ Пропущено (уже существуют): ${skippedCount}`);
  console.log(`  ❌ Ошибок: ${errorCount}`);
  console.log(`  📝 Всего обработано: ${processedCount}`);

  await db.$disconnect();
}

// Запуск импорта
if (require.main === module) {
  importMiniCosmeticsUsers().catch(console.error);
}

export { importMiniCosmeticsUsers };
