/**
 * @file: scripts/check-trigger-config.ts
 * @description: Проверка конфигурации trigger нод
 * @project: SaaS Bonus System
 * @created: 2025-10-16
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';

async function checkTriggerConfig() {
  try {
    console.log('🔍 Проверяем конфигурацию trigger нод...\n');

    // Получаем активную версию workflow
    const workflowVersion = await db.workflowVersion.findFirst({
      where: {
        workflow: {
          projectId: 'cmgntgsdv0000v8mwfwwh30az',
          isActive: true
        },
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!workflowVersion) {
      console.log('❌ Активная версия workflow не найдена');
      return;
    }

    console.log(`✅ Найдена версия workflow: ${workflowVersion.version}`);
    console.log(`  Entry Node ID: ${workflowVersion.entryNodeId}\n`);

    // Проверяем trigger.command ноды
    console.log('🔍 Trigger.command ноды:');
    Object.entries(workflowVersion.nodes).forEach(([id, node]) => {
      if (node.type === 'trigger.command') {
        console.log(`  ID: ${id}`);
        console.log(`  Label: ${node.data?.label || 'Без названия'}`);
        console.log(`  Config:`, JSON.stringify(node.data?.config?.['trigger.command'], null, 2));
        console.log('');
      }
    });

    // Проверяем entry node
    const entryNode = workflowVersion.nodes[workflowVersion.entryNodeId];
    if (entryNode) {
      console.log(`🎯 Entry Node (${workflowVersion.entryNodeId}):`);
      console.log(`  Type: ${entryNode.type}`);
      console.log(`  Label: ${entryNode.data?.label || 'Без названия'}`);
      if (entryNode.type === 'trigger.command') {
        console.log(`  Config:`, JSON.stringify(entryNode.data?.config?.['trigger.command'], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке конфигурации:', error);
  } finally {
    await db.$disconnect();
  }
}

checkTriggerConfig();

