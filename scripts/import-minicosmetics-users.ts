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

  // Определяем заголовки CSV файла
  const csvHeaders = [
    'ID', 'First Name', 'Last Name', 'return', 'ВИЗИТ', 'Подписка на телеграм канал',
    'User ID', 'Nickname', 'Gender', 'Last Access', 'Created At', 'Channel Name',
    'Channel ID', 'Channel Resource', 'UTM Source', 'UTM Medium', 'UTM Campaign',
    'UTM Term', 'UTM Content', 'RS', 'Roistat', 'Roistat Visit', 'Openstat Service',
    'Openstat Campaign', 'Openstat Ad', 'Openstat Source', 'From', 'GClientID',
    'YM UID', 'YM Counter', 'gclid', 'yclid', 'fbclid', 'RB ClickID', 'phone',
    'email', 'ПОДПИСКА НА КАНАЛ', 'ПРОМОКОД', 'Повторный запуск', 'Попытки',
    'Задание', 'ПОПЫТКА', 'incoming_message_text'
  ];

  // Читаем CSV файл
  const stream = fs.createReadStream(csvFilePath)
    .pipe(csv({
      separator: ',',
      quote: '"',
      escape: '"',
      headers: csvHeaders
    }));

  // Собираем все данные из CSV
  for await (const row of stream) {
    users.push(row as MiniCosmeticsUser);
  }

  console.log(`📊 Найдено записей в CSV: ${users.length}`);
  
  // Проверяем первую строку - должна быть заголовок
  if (users.length > 0 && users[0].ID === 'ID') {
    console.log('✅ Первая строка - заголовок, пропускаем');
  }

  // Импортируем пользователей
  for (const csvUser of users) {
    try {
      processedCount++;

      // Пропускаем заголовок
      if (csvUser.ID === 'ID' || csvUser.ID === undefined || !csvUser['User ID'] || csvUser['User ID'] === 'User ID') {
        continue;
      }

      // Логируем прогресс каждые 100 пользователей
      if (processedCount % 100 === 0) {
        console.log(`🔄 Обработано: ${processedCount}/${users.length}`);
      }

      // Валидация и преобразование telegramId
      let telegramId: bigint | null = null;
      if (csvUser['User ID']) {
        const userIdStr = String(csvUser['User ID']).trim();
        // Проверяем, что это число, а не заголовок
        if (userIdStr && userIdStr !== 'User ID' && /^\d+$/.test(userIdStr)) {
          try {
            telegramId = BigInt(userIdStr);
          } catch (error) {
            console.log(`⚠️ Пропускаем пользователя ${csvUser.ID}: некорректный User ID: ${userIdStr}`);
            skippedCount++;
            continue;
          }
        }
      }

      // Извлекаем данные пользователя
      const userData = {
        projectId,
        firstName: csvUser['First Name']?.trim() || null,
        lastName: csvUser['Last Name']?.trim() || null,
        phone: csvUser.phone?.trim() || null,
        email: csvUser.email?.trim().toLowerCase() || null,
        telegramId,
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

      // Проверяем, что у пользователя есть хотя бы один контакт
      const orConditions = [
        ...(userData.telegramId ? [{ telegramId: userData.telegramId }] : []),
        ...(userData.email ? [{ email: userData.email }] : []),
        ...(userData.phone ? [{ phone: userData.phone }] : []),
      ];

      if (orConditions.length === 0) {
        console.log(`⚠️ Пропускаем пользователя ${csvUser.ID}: нет контактных данных`);
        skippedCount++;
        continue;
      }

      // Создаем нового пользователя напрямую через Prisma (без UserService)
      // Проверка существования выполняется базой данных через уникальные индексы
      try {
        const newUser = await db.user.create({
          data: {
            projectId: userData.projectId,
            email: userData.email,
            phone: userData.phone,
            firstName: userData.firstName,
            lastName: userData.lastName,
            telegramId: userData.telegramId,
            telegramUsername: userData.telegramUsername,
            isActive: false, // Импортированные пользователи неактивны до регистрации на сайте
            registeredAt: userData.registeredAt || new Date(),
            currentLevel: 'Базовый',
            totalPurchases: 0,
            utmSource: userData.utmSource,
            utmMedium: userData.utmMedium,
            utmCampaign: userData.utmCampaign,
            utmTerm: userData.utmTerm,
            utmContent: userData.utmContent
          }
        });
        importedCount++;
        if (importedCount % 100 === 0 || importedCount <= 10) {
          console.log(`✅ Импортирован пользователь ${importedCount}: ${newUser.firstName || ''} ${newUser.lastName || ''} (telegram: ${newUser.telegramId?.toString() || 'N/A'})`);
        }
      } catch (createError: any) {
        // Если ошибка уникальности - пользователь уже существует, пропускаем
        if (createError.code === 'P2002') {
          // Логируем детали ошибки для первых 10
          if (skippedCount < 10) {
            console.log(`⚠️ Ошибка уникальности P2002 для пользователя ${csvUser.ID}:`, {
              telegramId: userData.telegramId?.toString(),
              meta: createError.meta
            });
          }
          
          skippedCount++;
          if (skippedCount % 1000 === 0 || skippedCount <= 10) {
            const field = createError.meta?.target || 'unknown';
            console.log(`⚠️ Пользователь ${csvUser.ID} уже существует (${field}): ${userData.telegramId?.toString() || userData.email || userData.phone}`);
          }
        } else {
          console.error(`❌ Ошибка создания пользователя ${csvUser.ID}:`, createError.message || createError);
          errorCount++;
        }
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
