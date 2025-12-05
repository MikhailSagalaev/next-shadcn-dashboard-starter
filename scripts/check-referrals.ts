/**
 * @file: check-referrals.ts
 * @description: Проверка реферальных связей в базе данных
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Общая статистика
  const totalUsers = await prisma.user.count();
  const usersWithReferrer = await prisma.user.count({
    where: { referredBy: { not: null } }
  });
  const usersWithReferralCode = await prisma.user.count({
    where: { referralCode: { not: null } }
  });

  console.log('\n=== Статистика реферальных связей ===');
  console.log(`Всего пользователей: ${totalUsers}`);
  console.log(`Пользователей с реферером (referredBy): ${usersWithReferrer}`);
  console.log(`Пользователей с реферальным кодом: ${usersWithReferralCode}`);

  // Топ рефереров
  const topReferrers = await prisma.user.findMany({
    where: {
      referrals: { some: {} }
    },
    include: {
      _count: { select: { referrals: true } }
    },
    orderBy: {
      referrals: { _count: 'desc' }
    },
    take: 10
  });

  if (topReferrers.length > 0) {
    console.log('\n=== Топ рефереров ===');
    topReferrers.forEach((user, i) => {
      console.log(
        `${i + 1}. ${user.email || user.phone || user.id} - ${user._count.referrals} рефералов`
      );
    });
  }

  // Примеры реферальных связей
  const referralExamples = await prisma.user.findMany({
    where: { referredBy: { not: null } },
    include: {
      referrer: { select: { id: true, email: true, firstName: true } }
    },
    take: 5
  });

  if (referralExamples.length > 0) {
    console.log('\n=== Примеры реферальных связей ===');
    referralExamples.forEach((user) => {
      console.log(
        `${user.email || user.id} <- приглашён ${user.referrer?.email || user.referrer?.id}`
      );
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
