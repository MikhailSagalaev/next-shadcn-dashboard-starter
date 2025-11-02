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

      // Проверяем, существует ли уже пользователь
      let existingUser = null;
      let searchCriteria = '';

      if (userData.email) {
        existingUser = await UserService.findUserByContact(projectId, userData.email);
        searchCriteria = `email: ${userData.email}`;
      }
      if (!existingUser && userData.phone) {
        existingUser = await UserService.findUserByContact(projectId, undefined, userData.phone);
        searchCriteria = `phone: ${userData.phone}`;
      }
      if (!existingUser && userData.telegramId) {
        existingUser = await db.user.findFirst({
          where: {
            projectId,
            telegramId: userData.telegramId
          }
        });
        searchCriteria = `telegramId: ${userData.telegramId}`;
      }

      if (existingUser) {
        // Пользователь существует - обновляем данные, если они пустые
        const updateData: any = {};

        if (!existingUser.firstName && userData.firstName) {
          updateData.firstName = userData.firstName;
        }
        if (!existingUser.lastName && userData.lastName) {
          updateData.lastName = userData.lastName;
        }
        if (!existingUser.phone && userData.phone) {
          updateData.phone = userData.phone;
        }
        if (!existingUser.email && userData.email) {
          updateData.email = userData.email;
        }
        if (!existingUser.telegramId && userData.telegramId) {
          updateData.telegramId = userData.telegramId;
        }
        if (!existingUser.telegramUsername && userData.telegramUsername) {
          updateData.telegramUsername = userData.telegramUsername;
        }

        // Обновляем UTM метки, если они пустые
        if (!existingUser.utmSource && userData.utmSource) {
          updateData.utmSource = userData.utmSource;
        }
        if (!existingUser.utmMedium && userData.utmMedium) {
          updateData.utmMedium = userData.utmMedium;
        }
        if (!existingUser.utmCampaign && userData.utmCampaign) {
          updateData.utmCampaign = userData.utmCampaign;
        }
        if (!existingUser.utmTerm && userData.utmTerm) {
          updateData.utmTerm = userData.utmTerm;
        }
        if (!existingUser.utmContent && userData.utmContent) {
          updateData.utmContent = userData.utmContent;
        }

        if (Object.keys(updateData).length > 0) {
          await db.user.update({
            where: { id: existingUser.id },
            data: updateData
          });
          console.log(`🔄 Обновлен пользователь: ${searchCriteria} (${Object.keys(updateData).join(', ')})`);
        } else {
          console.log(`⚠️ Пользователь уже существует и обновление не требуется: ${searchCriteria}`);
        }
        skippedCount++;
        continue;
      }

      // Создаем нового пользователя
      try {
        const newUser = await UserService.createUser(userData);
        importedCount++;
        console.log(`✅ Импортирован пользователь: ${newUser.firstName || ''} ${newUser.lastName || ''} (${newUser.email || newUser.phone || newUser.telegramUsername || 'ID: ' + newUser.id})`);
      } catch (createError) {
        console.error(`❌ Ошибка создания пользователя ${csvUser.ID} (${searchCriteria}):`, createError);
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
