/**
 * @file: scripts/check-workflow-nodes.ts
 * @description: Проверка нод в workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-16
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';

async function checkWorkflowNodes() {
  try {
    console.log('🔍 Проверяем ноды в workflow...\n');

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

    const nodes =
      (workflowVersion.nodes as unknown as Record<
        string,
        { type?: string; data?: { label?: string } }
      >) || {};
    const connections =
      (
        workflowVersion as typeof workflowVersion & {
          connections?: Array<{
            source: string;
            target: string;
            type?: string;
          }>;
        }
      ).connections || [];

    console.log(`✅ Найдена версия workflow: ${workflowVersion.version}`);
    console.log(`  Workflow ID: ${workflowVersion.workflowId}`);
    console.log(`  Entry Node ID: ${workflowVersion.entryNodeId}`);
    console.log(`  Количество нод: ${Object.keys(nodes).length}\n`);

    // Показываем все ноды
    console.log('📋 Список нод:');
    Object.entries(nodes).forEach(([id, node], index) => {
      console.log(
        `  ${index + 1}. ${id} (${node.type}) - ${node.data?.label || 'Без названия'}`
      );
    });

    // Проверяем entry node
    console.log(`\n🎯 Entry Node: ${workflowVersion.entryNodeId}`);
    const entryNode = nodes[workflowVersion.entryNodeId];
    if (entryNode) {
      console.log(`  ✅ Entry node найден: ${entryNode.type}`);
      console.log(`  Label: ${entryNode.data?.label || 'Без названия'}`);
    } else {
      console.log(`  ❌ Entry node не найден!`);
    }

    // Проверяем connections
    console.log(`\n🔗 Connections: ${connections.length}`);
    if (connections.length > 0) {
      connections.forEach((conn, index) => {
        console.log(
          `  ${index + 1}. ${conn.source} → ${conn.target} (${conn.type})`
        );
      });
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке нод:', error);
  } finally {
    await db.$disconnect();
  }
}

checkWorkflowNodes();
