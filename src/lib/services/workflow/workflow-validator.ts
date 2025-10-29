/**
 * @file: src/lib/services/workflow/workflow-validator.ts
 * @description: Проверка корректности workflow (орфанные ноды, циклы, типы)
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import type { WorkflowConnection, WorkflowNode } from '@/types/workflow';

export interface WorkflowValidationError {
  message: string;
  type: 'error' | 'warning';
  nodeId?: string;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: WorkflowValidationError[];
}

export function validateWorkflow(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];

  if (nodes.length === 0) {
    errors.push({ type: 'error', message: 'Workflow пуст. Добавьте хотя бы одну ноду.' });
    return { isValid: false, errors };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const triggerNodes = nodes.filter((node) => node.type.startsWith('trigger.'));

  if (triggerNodes.length === 0) {
    errors.push({ type: 'error', message: 'Workflow должен содержать хотя бы один триггер.' });
  }

  // Проверяем, что все connections ссылаются на существующие ноды
  for (const connection of connections) {
    if (!nodeMap.has(connection.source)) {
      errors.push({
        type: 'error',
        message: `Connection ${connection.id} ссылается на несуществующую source-ноду (${connection.source}).`
      });
    }
    if (!nodeMap.has(connection.target)) {
      errors.push({
        type: 'error',
        message: `Connection ${connection.id} ссылается на несуществующую target-ноду (${connection.target}).`
      });
    }
  }

  const adjacency = buildAdjacencyMap(nodes, connections);

  // Поиск циклов
  const cycleErrors = detectCycles(nodes, adjacency);
  errors.push(...cycleErrors);

  // Поиск орфанных нод (не достижимых из триггеров)
  const orphanErrors = detectOrphans(nodes, triggerNodes, adjacency);
  errors.push(...orphanErrors);

  return {
    isValid: errors.filter((error) => error.type === 'error').length === 0,
    errors
  };
}

function buildAdjacencyMap(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
) {
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));

  for (const connection of connections) {
    if (!adjacency.has(connection.source)) {
      adjacency.set(connection.source, new Set());
    }
    adjacency.get(connection.source)!.add(connection.target);
  }

  return adjacency;
}

function detectCycles(
  nodes: WorkflowNode[],
  adjacency: Map<string, Set<string>>
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  const visit = (nodeId: string) => {
    if (inStack.has(nodeId)) {
      errors.push({
        type: 'error',
        message: `Обнаружен циклический переход, начинающийся с ноды ${nodeId}.`,
        nodeId
      });
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    inStack.add(nodeId);

    const neighbours = adjacency.get(nodeId) ?? new Set();
    neighbours.forEach(visit);

    inStack.delete(nodeId);
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  }

  return errors;
}

function detectOrphans(
  nodes: WorkflowNode[],
  triggerNodes: WorkflowNode[],
  adjacency: Map<string, Set<string>>
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  if (triggerNodes.length === 0) {
    return errors; // эта ошибка уже добавлена ранее
  }

  const reachable = new Set<string>();
  const queue = [...triggerNodes.map((node) => node.id)];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const neighbours = adjacency.get(nodeId) ?? new Set();
    neighbours.forEach((targetId) => queue.push(targetId));
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        type: 'warning',
        message: `Нода '${node.data?.label ?? node.id}' не связана с триггерами и не будет выполняться.`,
        nodeId: node.id
      });
    }
  }

  return errors;
}

