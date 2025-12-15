/**
 * @file: scripts/grant-free-3-months.ts
 * @description: Промо-скрипт для начисления 3 бесплатных месяцев всем существующим администраторам
 * @project: SaaS Bonus System
 * @created: 2025-12-10
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PROMO_REASON = 'promo_3m_2025';

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  const admins = await prisma.adminAccount.findMany({
    select: { id: true }
  });

  const paidPlan =
    (await prisma.subscriptionPlan.findFirst({
      where: { isActive: true, isPublic: true, price: { gt: 0 } },
      orderBy: { sortOrder: 'asc' }
    })) ||
    (await prisma.subscriptionPlan.findFirst({
      where: { slug: { in: ['pro', 'professional'] } }
    }));

  if (!paidPlan) {
    console.warn('No paid plan found; aborting promo.');
    return;
  }

  for (const admin of admins) {
    const existing = await prisma.subscription.findFirst({
      where: {
        adminAccountId: admin.id,
        status: { in: ['active', 'trial'] }
      },
      include: { plan: true }
    });

    const alreadyPromo = existing
      ? await prisma.subscriptionHistory.findFirst({
          where: {
            subscriptionId: existing.id,
            action: 'promo_extension',
            reason: PROMO_REASON
          }
        })
      : null;

    if (alreadyPromo) {
      continue;
    }

    if (!existing) {
      const start = new Date();
      const end = addMonths(start, 3);
      const subscription = await prisma.subscription.create({
        data: {
          adminAccountId: admin.id,
          planId: paidPlan.id,
          status: 'trial',
          startDate: start,
          trialEndDate: end,
          endDate: end
        }
      });

      await prisma.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          action: 'promo_extension',
          toPlanId: paidPlan.id,
          reason: PROMO_REASON,
          performedBy: 'system'
        }
      });
    } else {
      const now = new Date();
      const base = existing.endDate && existing.endDate > now ? existing.endDate : now;
      const newEnd = addMonths(base, 3);

      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          endDate: newEnd,
          trialEndDate: existing.trialEndDate && existing.trialEndDate > now ? existing.trialEndDate : newEnd
        }
      });

      await prisma.subscriptionHistory.create({
        data: {
          subscriptionId: existing.id,
          action: 'promo_extension',
          fromPlanId: existing.planId,
          toPlanId: existing.planId,
          reason: PROMO_REASON,
          performedBy: 'system'
        }
      });
    }
  }

  console.log('Promo 3 months processed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
