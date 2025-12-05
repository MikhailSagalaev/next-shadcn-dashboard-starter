/**
 * @file: debug-referrals.ts
 * @description: Отладка привязки реферальных связей
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // Примеры email из CSV
  const csvContent = fs.readFileSync('Users-Grid view (4).csv', 'utf-8');
  const lines = csvContent.split('\n').slice(1, 6);

  console.log('=== Примеры email из CSV ===');
  for (const line of lines) {
    const parts = line.split(',');
    console.log(`ID: ${parts[0]}, Email: ${parts[1]}`);
  }

  // Примеры email из БД
  console.log('\n=== Примеры email из БД ===');
  const dbUsers = await prisma.user.findMany({
    take: 5,
    select: { id: true, email: true }
  });
  dbUsers.forEach((u) => console.log(`ID: ${u.id}, Email: ${u.email}`));

  // Проверяем конкретный email
  const testEmail = 'vomih@lisr.ru';
  const found = await prisma.user.findFirst({
    where: { email: testEmail }
  });
  console.log(`\nПоиск ${testEmail}: ${found ? 'найден' : 'не найден'}`);

  // Проверяем по частичному совпадению
  const similar = await prisma.user.findMany({
    where: { email: { contains: 'lisr' } },
    take: 3
  });
  console.log(`Похожие email (содержат 'lisr'): ${similar.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
