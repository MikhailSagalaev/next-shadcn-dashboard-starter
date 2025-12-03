/**
 * @file: scripts/fix-welcome-bonus-workflow.ts
 * @description: Скрипт для удаления захардкоженных нод начисления приветственных бонусов из workflow
 * @project: SaaS Bonus System
 * @created: 2025-12-03
 * @author: AI Assistant + User
 *
 * Проблема: В workflow захардкожено значение 555 для приветственных бонусов,
 * хотя activate_user уже автоматически начисляет бонусы из настроек проекта.
 *
 * Решение: Удалить ноды add-welcome-bonus и связанные проверки из всех workflow.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WorkflowNode {
  id: string;
  type: string;
  data?: {
    label?: string;
    config?: {
      'action.database_query'?: {
        query?: string;
        parameters?: {
          type?: string;
          amount?: string | number;
        };
      };
    };
  };
}

interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

async function fixWelcomeBonusWorkflows() {
  console.log(
    '🔍 Поиск workflow с захардкоженными приветственными бонусами...\n'
  );

  const workflows = await prisma.workflow.findMany({
    select: {
      id: true,
      name: true,
      projectId: true,
      nodes: true,
      connections: true,
      project: {
        select: {
          name: true
        }
      }
    }
  });

  let fixedCount = 0;

  for (const workflow of workflows) {
    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const connections = workflow.connections as unknown as WorkflowConnection[];

    if (!Array.isArray(nodes)) continue;

    // Ищем ноды для удаления:
    // 1. add-welcome-bonus - нода начисления приветственных бонусов
    // 2. check-welcome-bonus - проверка наличия бонусов
    // 3. check-bonus-exists - условие проверки
    const nodesToRemove = new Set<string>();

    for (const node of nodes) {
      // Проверяем по ID
      if (
        [
          'add-welcome-bonus',
          'check-welcome-bonus',
          'check-bonus-exists'
        ].includes(node.id)
      ) {
        nodesToRemove.add(node.id);
        continue;
      }

      // Проверяем по конфигурации - ноды add_bonus с типом WELCOME
      const queryConfig = node.data?.config?.['action.database_query'];
      if (
        queryConfig?.query === 'add_bonus' &&
        queryConfig?.parameters?.type === 'WELCOME'
      ) {
        nodesToRemove.add(node.id);
        continue;
      }

      // Проверяем по label
      const label = node.data?.label?.toLowerCase() || '';
      if (
        label.includes('приветственн') &&
        (label.includes('бонус') || label.includes('начисл'))
      ) {
        nodesToRemove.add(node.id);
      }
    }

    if (nodesToRemove.size === 0) continue;

    console.log(
      `📋 Workflow: "${workflow.name}" (проект: ${workflow.project?.name || workflow.projectId})`
    );
    console.log(`   Найдено нод для удаления: ${nodesToRemove.size}`);
    nodesToRemove.forEach((id) => console.log(`   - ${id}`));

    // Фильтруем ноды
    const newNodes = nodes.filter((node) => !nodesToRemove.has(node.id));

    // Фильтруем и перенаправляем connections
    // Если connection идёт к удаляемой ноде, нужно перенаправить на следующую
    const newConnections: WorkflowConnection[] = [];
    const redirectMap = new Map<string, string>(); // source -> new target

    for (const conn of connections) {
      if (nodesToRemove.has(conn.source) && nodesToRemove.has(conn.target)) {
        // Оба конца удаляются - пропускаем
        continue;
      }

      if (nodesToRemove.has(conn.target)) {
        // Target удаляется - ищем куда перенаправить
        const nextConn = connections.find((c) => c.source === conn.target);
        if (nextConn && !nodesToRemove.has(nextConn.target)) {
          redirectMap.set(conn.source, nextConn.target);
        }
        continue;
      }

      if (nodesToRemove.has(conn.source)) {
        // Source удаляется - пропускаем, будет перенаправлено
        continue;
      }

      newConnections.push(conn);
    }

    // Добавляем перенаправленные connections
    for (const [source, target] of redirectMap) {
      // Находим оригинальный connection для сохранения handles
      const originalConn = connections.find((c) => c.source === source);
      const targetConn = connections.find((c) => c.target === target);

      newConnections.push({
        id: `${source}-${target}-redirected`,
        source,
        target,
        sourceHandle: originalConn?.sourceHandle,
        targetHandle: targetConn?.targetHandle
      });
    }

    // Обновляем workflow
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        nodes: newNodes as any,
        connections: newConnections as any
      }
    });

    console.log(
      `   ✅ Исправлено! Удалено ${nodesToRemove.size} нод, осталось ${newNodes.length}\n`
    );
    fixedCount++;
  }

  console.log(`\n🎉 Готово! Исправлено workflow: ${fixedCount}`);

  if (fixedCount > 0) {
    console.log(
      '\n⚠️  ВАЖНО: Приветственные бонусы теперь начисляются автоматически'
    );
    console.log(
      '   через activate_user из настроек проекта (referralProgram.welcomeBonus).'
    );
    console.log(
      '   Убедитесь, что в настройках проекта указана правильная сумма.'
    );
  }
}

// Запуск
fixWelcomeBonusWorkflows()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
