/**
 * @file: prisma/seed.ts
 * @description: Главный seed файл для заполнения базы данных начальными данными
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed тарифных планов
 */
async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

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

/**
 * Создание бесплатных подписок для всех существующих администраторов
 */
async function seedAdminSubscriptions() {
  console.log('🌱 Creating free subscriptions for existing admins...');

  // Получаем Free план
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: 'free' }
  });

  if (!freePlan) {
    console.log('  ⚠️  Free plan not found, skipping admin subscriptions...');
    return;
  }

  // Получаем всех администраторов без активных подписок
  const admins = await prisma.adminAccount.findMany({
    where: {
      subscriptions: {
        none: {
          status: 'active'
        }
      }
    }
  });

  console.log(`  📊 Found ${admins.length} admins without active subscriptions`);

  let created = 0;
  for (const admin of admins) {
    // Проверяем, нет ли уже подписки (даже неактивной)
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        adminAccountId: admin.id,
        planId: freePlan.id
      }
    });

    if (existingSubscription) {
      console.log(`  ⏭️  Admin ${admin.email || admin.id} already has a subscription, skipping...`);
      continue;
    }

    // Создаем бесплатную подписку
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 100); // 100 лет вперед = "бессрочная"

    await prisma.subscription.create({
      data: {
        adminAccountId: admin.id,
        planId: freePlan.id,
        status: 'active',
        startDate,
        endDate
      }
    });

    created++;
    console.log(`  ✅ Created free subscription for admin: ${admin.email || admin.id}`);
  }

  console.log(`✅ Created ${created} free subscriptions for admins!`);
}

/**
 * Главная функция seed
 */
async function main() {
  console.log('🚀 Starting database seed...\n');

  try {
    // 1. Создаем тарифные планы
    await seedSubscriptionPlans();
    console.log('');

    // 2. Создаем бесплатные подписки для администраторов
    await seedAdminSubscriptions();
    console.log('');

    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
