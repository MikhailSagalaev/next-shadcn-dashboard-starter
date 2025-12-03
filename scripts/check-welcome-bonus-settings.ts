/**
 * @file: scripts/check-welcome-bonus-settings.ts
 * @description: Проверка настроек приветственных бонусов во всех проектах
 * @project: SaaS Bonus System
 * @created: 2025-12-03
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSettings() {
  console.log('📋 Проверка настроек приветственных бонусов:\n');

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      domain: true,
      referralProgram: {
        select: {
          welcomeBonus: true
        }
      },
      workflows: {
        select: {
          id: true,
          name: true,
          isActive: true
        }
      }
    }
  });

  for (const project of projects) {
    const welcomeBonus = Number(project.referralProgram?.welcomeBonus || 0);

    console.log(`\n📁 Проект: ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Домен: ${project.domain || 'не указан'}`);
    console.log(`   Приветственный бонус: ${welcomeBonus}`);
    console.log(
      `   Workflow: ${project.workflows.length > 0 ? project.workflows.map((w) => `${w.name} (${w.isActive ? 'активен' : 'неактивен'})`).join(', ') : 'нет'}`
    );
  }

  // Проверяем последние начисления WELCOME бонусов
  console.log('\n\n📊 Последние 10 начислений WELCOME бонусов:');

  const welcomeBonuses = await prisma.bonus.findMany({
    where: { type: 'WELCOME' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: {
        select: {
          email: true,
          phone: true,
          project: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  for (const bonus of welcomeBonuses) {
    console.log(
      `   - ${Number(bonus.amount)} бонусов | ${bonus.user.project?.name} | ${bonus.user.email || bonus.user.phone} | ${bonus.createdAt.toISOString()}`
    );
  }

  console.log('\n\n📊 Итого проектов:', projects.length);
}

checkSettings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
