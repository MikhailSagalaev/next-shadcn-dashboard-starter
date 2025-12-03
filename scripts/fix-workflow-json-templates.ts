/**
 * @file: scripts/fix-workflow-json-templates.ts
 * @description: Исправление JSON шаблонов workflow - удаление захардкоженных приветственных бонусов
 * @project: SaaS Bonus System
 * @created: 2025-12-03
 */

import * as fs from 'fs';
import * as path from 'path';

const jsonFiles = [
  'Система лояльности.json',
  'Система лояльности (исправленная) (импорт) (1).json',
  'temp_workflow.json',
  'temp_workflow_fixed.json',
  'temp_fixed.json'
];

interface WorkflowNode {
  id: string;
  type: string;
  data?: any;
}

interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

function fixWorkflowJson(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Файл не найден: ${filePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const workflow = JSON.parse(content);

    const nodes: WorkflowNode[] = workflow.nodes || [];
    const connections: WorkflowConnection[] = workflow.connections || [];

    // Ноды для удаления
    const nodesToRemove = new Set([
      'add-welcome-bonus',
      'check-welcome-bonus',
      'check-bonus-exists'
    ]);

    // Также ищем по конфигурации
    for (const node of nodes) {
      const config = node.data?.config?.['action.database_query'];
      if (
        config?.query === 'add_bonus' &&
        config?.parameters?.type === 'WELCOME'
      ) {
        nodesToRemove.add(node.id);
      }
    }

    const originalNodeCount = nodes.length;
    const newNodes = nodes.filter((node) => !nodesToRemove.has(node.id));

    if (newNodes.length === originalNodeCount) {
      console.log(`✅ ${path.basename(filePath)}: нет нод для удаления`);
      return false;
    }

    // Перенаправляем connections
    const newConnections: WorkflowConnection[] = [];
    const redirectMap = new Map<string, string>();

    for (const conn of connections) {
      if (nodesToRemove.has(conn.source) && nodesToRemove.has(conn.target)) {
        continue;
      }

      if (nodesToRemove.has(conn.target)) {
        const nextConn = connections.find((c) => c.source === conn.target);
        if (nextConn && !nodesToRemove.has(nextConn.target)) {
          redirectMap.set(conn.source, nextConn.target);
        }
        continue;
      }

      if (nodesToRemove.has(conn.source)) {
        continue;
      }

      newConnections.push(conn);
    }

    for (const [source, target] of redirectMap) {
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
    workflow.nodes = newNodes;
    workflow.connections = newConnections;

    // Также исправляем текст сообщений
    for (const node of workflow.nodes) {
      if (node.data?.config?.message?.text) {
        let text = node.data.config.message.text;
        // Убираем упоминания конкретных сумм приветственных бонусов
        text = text.replace(
          /💰 Вам начислено \d+ приветственных бонусов!/g,
          '💰 Приветственные бонусы начислены (если настроены в проекте)!'
        );
        text = text.replace(
          /Вам начислены \d+ приветственных бонусов/g,
          'Приветственные бонусы начислены автоматически'
        );
        node.data.config.message.text = text;
      }
    }

    // Сохраняем
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

    console.log(
      `✅ ${path.basename(filePath)}: удалено ${originalNodeCount - newNodes.length} нод`
    );
    return true;
  } catch (error) {
    console.log(`❌ Ошибка обработки ${filePath}:`, error);
    return false;
  }
}

console.log('🔧 Исправление JSON шаблонов workflow...\n');

let fixed = 0;
for (const file of jsonFiles) {
  if (fixWorkflowJson(file)) {
    fixed++;
  }
}

console.log(`\n🎉 Готово! Исправлено файлов: ${fixed}`);
