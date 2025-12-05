/**
 * @file: link-referrals-from-csv.ts
 * @description: Привязка реферальных связей из CSV файла Airtable
 * @usage: npx tsx scripts/link-referrals-from-csv.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CsvRow {
  airtableId: string;
  email: string;
  refererId: string | null;
}

function parseCSV(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const idIndex = headers.findIndex((h) => h.trim() === 'ID');
  const emailIndex = headers.findIndex((h) => h.trim() === 'Email');
  const refererIndex = headers.findIndex((h) => h.trim() === 'Referer');

  console.log(
    `Найдены колонки: ID=${idIndex}, Email=${emailIndex}, Referer=${refererIndex}`
  );

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Простой парсинг CSV (учитываем кавычки)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const airtableId = values[idIndex] || '';
    const email = values[emailIndex] || '';
    const refererId = values[refererIndex] || null;

    if (airtableId && email) {
      rows.push({
        airtableId,
        email: email.toLowerCase(),
        refererId: refererId && refererId.startsWith('rec') ? refererId : null
      });
    }
  }

  return rows;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'Users-Full.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('Файл не найден:', csvPath);
    process.exit(1);
  }

  console.log('Парсинг CSV файла...');
  const csvRows = parseCSV(csvPath);
  console.log(`Найдено ${csvRows.length} записей в CSV`);

  // Создаём маппинг Airtable ID -> Email
  const airtableIdToEmail = new Map<string, string>();
  csvRows.forEach((row) => {
    airtableIdToEmail.set(row.airtableId, row.email);
  });

  // Считаем записи с рефереррами
  const rowsWithReferer = csvRows.filter((r) => r.refererId);
  console.log(`Записей с реферером: ${rowsWithReferer.length}`);

  // Получаем всех пользователей из БД
  console.log('\nЗагрузка пользователей из БД...');
  const users = await prisma.user.findMany({
    select: { id: true, email: true }
  });

  // Создаём маппинг Email -> User ID
  const emailToUserId = new Map<string, string>();
  users.forEach((user) => {
    if (user.email) {
      emailToUserId.set(user.email.toLowerCase(), user.id);
    }
  });
  console.log(`Пользователей в БД: ${users.length}`);

  // Привязываем реферальные связи
  let linked = 0;
  let notFoundUser = 0;
  let notFoundReferer = 0;
  let errors = 0;

  console.log('\nПривязка реферальных связей...');

  for (const row of rowsWithReferer) {
    // Находим пользователя по email
    const userId = emailToUserId.get(row.email);
    if (!userId) {
      notFoundUser++;
      continue;
    }

    // Находим email реферера по Airtable ID
    const refererEmail = airtableIdToEmail.get(row.refererId!);
    if (!refererEmail) {
      notFoundReferer++;
      continue;
    }

    // Находим ID реферера в БД
    const refererId = emailToUserId.get(refererEmail.toLowerCase());
    if (!refererId) {
      notFoundReferer++;
      continue;
    }

    // Обновляем пользователя
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referredBy: refererId }
      });
      linked++;

      if (linked % 100 === 0) {
        console.log(`Привязано: ${linked}...`);
      }
    } catch (err) {
      errors++;
    }
  }

  console.log('\n=== Результат ===');
  console.log(`Успешно привязано: ${linked}`);
  console.log(`Пользователь не найден в БД: ${notFoundUser}`);
  console.log(`Реферер не найден: ${notFoundReferer}`);
  console.log(`Ошибок: ${errors}`);

  // Проверяем результат
  const usersWithReferrer = await prisma.user.count({
    where: { referredBy: { not: null } }
  });
  console.log(`\nВсего пользователей с реферером в БД: ${usersWithReferrer}`);

  await prisma.$disconnect();
}

main().catch(console.error);
