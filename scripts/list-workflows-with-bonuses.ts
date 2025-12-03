/**
 * @file: scripts/list-workflows-with-bonuses.ts
 * @description: Скрипт для просмотра всех workflow и поиска нод с начислением бонусов
 * @project: SaaS Bonus System
 * @created: 2025-12-03
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listWorkflows() {
  console.log('📋 Список всех workflow и нод с бонусами:\n');

  const workflows = await prisma.workflow.findMany({
    select: {
      id: true,
      name: true,
      projectId: true,
      nodes: true,
      project: {
        select: {
          name: true,
          referralProgram: {
            select: {
              welcomeBonus: true
            }
          }
        }
      }
    }
  });

  for (const workflow of workflows) {
    const nodes = workflow.nodes as unknown as any[];
    if (!Array.isArray(nodes)) continue;

    const welcomeBonus = Number(
      workflow.project?.referralProgram?.welcomeBonus || 0
    );

    console.log(`\n📁 Проект: ${workflow.project?.name || 'Неизвестно'}`);
    console.log(`   Workflow: "${workflow.name}" (ID: ${workflow.id})`);
    console.log(`   Приветственный бонус в настройках: ${welcomeBonus}`);

    // Ищем ноды с add_bonus
    const bonusNodes = nodes.filter((node) => {
      const config = node.data?.config?.['action.database_query'];
      return config?.query === 'add_bonus';
    });

    if (bonusNodes.length > 0) {
      console.log(`   🎁 Ноды начисления бонусов:`);
      for (const node of bonusNodes) {
        const config = node.data?.config?.['action.database_query'];
        const params = config?.parameters || {};
        console.log(`      - ID: ${node.id}`);
        console.log(`        Label: ${node.data?.label || 'N/A'}`);
        console.log(`        Type: ${params.type || 'N/A'}`);
        console.log(`        Amount: ${params.amount || 'N/A'}`);
      }
    } else {
      console.log(`   ✅ Нет нод ручного начисления бонусов`);
    }
  }

  console.log('\n\n📊 Итого workflow:', workflows.length);
}

listWorkflows()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
