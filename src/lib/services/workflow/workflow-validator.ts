/**
 * @file: src/lib/services/workflow/workflow-validator.ts
 * @description: Проверка корректности workflow (орфанные ноды, циклы, типы, goto_node)
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 * @updated: 2026-01-06
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
    errors.push({
      type: 'error',
      message: 'Workflow пуст. Добавьте хотя бы одну ноду.'
    });
    return { isValid: false, errors };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const triggerNodes = nodes.filter((node) => node.type.startsWith('trigger.'));

  if (triggerNodes.length === 0) {
    errors.push({
      type: 'error',
      message: 'Workflow должен содержать хотя бы один триггер.'
    });
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

  // ✨ НОВОЕ: Валидация goto_node ссылок в кнопках и flow.jump
  const gotoErrors = validateGotoNodes(nodes, nodeMap);
  errors.push(...gotoErrors);

  return {
    isValid: errors.filter((error) => error.type === 'error').length === 0,
    errors
  };
}

/**
 * ✨ НОВОЕ: Валидация goto_node ссылок в кнопках и flow.jump
 * Проверяет, что все goto_node ссылаются на существующие ноды
 */
export function validateGotoNodes(
  nodes: WorkflowNode[],
  nodeMap?: Map<string, WorkflowNode>
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  // Создаем nodeMap если не передан
  const existingNodes =
    nodeMap || new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    const config = node.data?.config;
    if (!config) continue;

    // Проверяем inline keyboard buttons
    const inlineConfig = config['message.keyboard.inline'];
    if (inlineConfig?.buttons) {
      const inlineErrors = validateButtonsGotoNodes(
        inlineConfig.buttons,
        existingNodes,
        node.id,
        node.data?.label || node.id
      );
      errors.push(...inlineErrors);
    }

    // Проверяем reply keyboard buttons (могут иметь goto_node в actions)
    const replyConfig = config['message.keyboard.reply'];
    if (replyConfig?.buttons) {
      const replyErrors = validateReplyButtonsGotoNodes(
        replyConfig.buttons,
        existingNodes,
        node.id,
        node.data?.label || node.id
      );
      errors.push(...replyErrors);
    }

    // Проверяем message node с keyboard
    const messageConfig = config.message;
    if (messageConfig?.keyboard?.buttons) {
      const messageErrors = validateButtonsGotoNodes(
        messageConfig.keyboard.buttons,
        existingNodes,
        node.id,
        node.data?.label || node.id
      );
      errors.push(...messageErrors);
    }

    // Проверяем flow.jump
    const jumpConfig = config['flow.jump'];
    if (jumpConfig?.targetNodeId) {
      if (!existingNodes.has(jumpConfig.targetNodeId)) {
        errors.push({
          type: 'error',
          message: `Нода '${node.data?.label || node.id}' (flow.jump) ссылается на несуществующую ноду '${jumpConfig.targetNodeId}'.`,
          nodeId: node.id
        });
      }
    }

    // Проверяем flow.switch cases (если есть goto в cases)
    const switchConfig = config['flow.switch'];
    if (switchConfig?.cases) {
      for (const caseItem of switchConfig.cases) {
        if (
          (caseItem as any).gotoNode &&
          !existingNodes.has((caseItem as any).gotoNode)
        ) {
          errors.push({
            type: 'error',
            message: `Нода '${node.data?.label || node.id}' (flow.switch) содержит case с несуществующей целевой нодой '${(caseItem as any).gotoNode}'.`,
            nodeId: node.id
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Валидация goto_node в inline кнопках
 */
function validateButtonsGotoNodes(
  buttons: any[][],
  existingNodes: Map<string, WorkflowNode>,
  nodeId: string,
  nodeLabel: string
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  if (!Array.isArray(buttons)) return errors;

  for (let rowIndex = 0; rowIndex < buttons.length; rowIndex++) {
    const row = buttons[rowIndex];
    if (!Array.isArray(row)) continue;

    for (let btnIndex = 0; btnIndex < row.length; btnIndex++) {
      const button = row[btnIndex];
      if (!button) continue;

      // Проверяем goto_node
      if (button.goto_node && !existingNodes.has(button.goto_node)) {
        errors.push({
          type: 'error',
          message: `Кнопка '${button.text || `[${rowIndex}][${btnIndex}]`}' в ноде '${nodeLabel}' ссылается на несуществующую ноду '${button.goto_node}'.`,
          nodeId
        });
      }

      // Проверяем callback_data с префиксом goto:
      if (
        button.callback_data &&
        typeof button.callback_data === 'string' &&
        button.callback_data.startsWith('goto:')
      ) {
        const targetNodeId = button.callback_data.substring(5);
        if (!existingNodes.has(targetNodeId)) {
          errors.push({
            type: 'error',
            message: `Кнопка '${button.text || `[${rowIndex}][${btnIndex}]`}' в ноде '${nodeLabel}' содержит callback_data с несуществующей целевой нодой '${targetNodeId}'.`,
            nodeId
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Валидация goto_node в reply кнопках (через actions)
 */
function validateReplyButtonsGotoNodes(
  buttons: any[][],
  existingNodes: Map<string, WorkflowNode>,
  nodeId: string,
  nodeLabel: string
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  if (!Array.isArray(buttons)) return errors;

  for (let rowIndex = 0; rowIndex < buttons.length; rowIndex++) {
    const row = buttons[rowIndex];
    if (!Array.isArray(row)) continue;

    for (let btnIndex = 0; btnIndex < row.length; btnIndex++) {
      const button = row[btnIndex];
      if (!button || !button.actions) continue;

      // Проверяем actions на наличие goto_node
      for (const action of button.actions) {
        if (action.type === 'goto_node' && action.targetNodeId) {
          if (!existingNodes.has(action.targetNodeId)) {
            errors.push({
              type: 'error',
              message: `Кнопка '${button.text || `[${rowIndex}][${btnIndex}]`}' в ноде '${nodeLabel}' содержит action с несуществующей целевой нодой '${action.targetNodeId}'.`,
              nodeId
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Получить список всех нод, на которые ссылаются goto_node
 * Полезно для проверки при удалении ноды
 */
export function getGotoNodeReferences(
  nodes: WorkflowNode[]
): Map<
  string,
  { sourceNodeId: string; sourceLabel: string; buttonText?: string }[]
> {
  const references = new Map<
    string,
    { sourceNodeId: string; sourceLabel: string; buttonText?: string }[]
  >();

  for (const node of nodes) {
    const config = node.data?.config;
    if (!config) continue;

    const sourceLabel = node.data?.label || node.id;

    // Собираем ссылки из inline keyboard
    const inlineConfig = config['message.keyboard.inline'];
    if (inlineConfig?.buttons) {
      collectButtonReferences(
        inlineConfig.buttons,
        node.id,
        sourceLabel,
        references
      );
    }

    // Собираем ссылки из message keyboard
    const messageConfig = config.message;
    if (messageConfig?.keyboard?.buttons) {
      collectButtonReferences(
        messageConfig.keyboard.buttons,
        node.id,
        sourceLabel,
        references
      );
    }

    // Собираем ссылки из flow.jump
    const jumpConfig = config['flow.jump'];
    if (jumpConfig?.targetNodeId) {
      addReference(references, jumpConfig.targetNodeId, {
        sourceNodeId: node.id,
        sourceLabel,
        buttonText: 'flow.jump'
      });
    }
  }

  return references;
}

/**
 * Собирает ссылки goto_node из кнопок
 */
function collectButtonReferences(
  buttons: any[][],
  sourceNodeId: string,
  sourceLabel: string,
  references: Map<
    string,
    { sourceNodeId: string; sourceLabel: string; buttonText?: string }[]
  >
): void {
  if (!Array.isArray(buttons)) return;

  for (const row of buttons) {
    if (!Array.isArray(row)) continue;

    for (const button of row) {
      if (!button) continue;

      if (button.goto_node) {
        addReference(references, button.goto_node, {
          sourceNodeId,
          sourceLabel,
          buttonText: button.text
        });
      }

      if (
        button.callback_data &&
        typeof button.callback_data === 'string' &&
        button.callback_data.startsWith('goto:')
      ) {
        const targetNodeId = button.callback_data.substring(5);
        addReference(references, targetNodeId, {
          sourceNodeId,
          sourceLabel,
          buttonText: button.text
        });
      }
    }
  }
}

/**
 * Добавляет ссылку в Map
 */
function addReference(
  references: Map<
    string,
    { sourceNodeId: string; sourceLabel: string; buttonText?: string }[]
  >,
  targetNodeId: string,
  ref: { sourceNodeId: string; sourceLabel: string; buttonText?: string }
): void {
  if (!references.has(targetNodeId)) {
    references.set(targetNodeId, []);
  }
  references.get(targetNodeId)!.push(ref);
}

/**
 * Проверяет, есть ли ссылки на указанную ноду
 * Полезно при удалении ноды для предупреждения пользователя
 */
export function checkNodeReferences(
  nodeId: string,
  nodes: WorkflowNode[]
): {
  hasReferences: boolean;
  references: {
    sourceNodeId: string;
    sourceLabel: string;
    buttonText?: string;
  }[];
} {
  const allReferences = getGotoNodeReferences(nodes);
  const nodeReferences = allReferences.get(nodeId) || [];

  return {
    hasReferences: nodeReferences.length > 0,
    references: nodeReferences
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
