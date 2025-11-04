/**
 * @file: prisma/seeds/subscription-plans.seed.ts
 * @description: Seed данные для тарифных планов
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Для тестирования и небольших проектов',
    price: 0,
    currency: 'RUB',
    interval: 'month',
    maxProjects: 1,
    maxUsersPerProject: 10,
    features: ['1 проект', '10 пользователей', 'Email поддержка'],
    isPublic: true,
    sortOrder: 1
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Для растущих бизнесов',
    price: 2990,
    currency: 'RUB',
    interval: 'month',
    maxProjects: 5,
    maxUsersPerProject: 1000,
    features: [
      '5 проектов',
      '1000 пользователей на проект',
      'Аналитика',
      'Приоритетная поддержка'
    ],
    isPublic: true,
    sortOrder: 2
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Для крупных компаний',
    price: 9990,
    currency: 'RUB',
    interval: 'month',
    maxProjects: 10,
    maxUsersPerProject: 999999,
    features: [
      '10 проектов',
      'Безлимит пользователей',
      'Кастомные интеграции',
      'Персональный менеджер',
      'SLA 99.9%'
    ],
    isPublic: true,
    sortOrder: 3
  }
];

export async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

  for (const planData of plans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { slug: planData.slug }
    });

    if (existing) {
      console.log(`  ⏭️  Plan ${planData.slug} already exists, skipping...`);
      continue;
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        ...planData,
        features: planData.features as any
      }
    });

    console.log(`  ✅ Created plan: ${plan.name} (${plan.slug})`);
  }

  console.log('✅ Subscription plans seeded!');
}

if (require.main === module) {
  seedSubscriptionPlans()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
