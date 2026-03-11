import type { WorkflowConnection, WorkflowNode } from '@/types/workflow';
import {
  validateWorkflow,
  type WorkflowValidationResult,
  type WorkflowValidationError
} from './workflow-validator';
import { nodeHandlersRegistry } from './node-handlers-registry';
import { initializeNodeHandlers } from './handlers';

/**
 * СЕРВЕРНАЯ валидация (включает клиентскую + глубокую проверку типов и конфигов)
 * Использует node-handlers-registry и может быть асинхронной.
 */
export async function validateWorkflowServer(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): Promise<WorkflowValidationResult> {
  // 1. Базовая валидация (топология)
  const basicResult = validateWorkflow(nodes, connections);
  const errors = [...basicResult.errors];

  // 2. Проверка типов нод (требует реестра)
  const typeErrors = validateNodeTypes(nodes);
  errors.push(...typeErrors);

  // 3. Глубокая валидация конфигурации (требует реестра и валидаторов хендлеров)
  const configErrors = await validateNodeConfigs(nodes);
  errors.push(...configErrors);

  return {
    isValid: errors.filter((error) => error.type === 'error').length === 0,
    errors
  };
}

/**
 * ✨ НОВОЕ: Проверка существования типов нод в реестре
 */
export function validateNodeTypes(
  nodes: WorkflowNode[]
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  try {
    // Убедимся, что хендлеры инициализированы в процессе Next.js API роута
    if (nodeHandlersRegistry.list().length === 0) {
      initializeNodeHandlers();
    }

    for (const node of nodes) {
      if (!nodeHandlersRegistry.has(node.type)) {
        errors.push({
          type: 'error',
          message: `Неизвестный тип ноды: '${node.type}'.`,
          nodeId: node.id
        });
      }
    }
  } catch (e) {
    console.warn(
      'Не удалось загрузить nodeHandlersRegistry для валидации типов:',
      e
    );
  }

  return errors;
}

/**
 * ✨ НОВОЕ: Глубокая валидация конфигурации нод через их хендлеры
 */
export async function validateNodeConfigs(
  nodes: WorkflowNode[]
): Promise<WorkflowValidationError[]> {
  const errors: WorkflowValidationError[] = [];

  try {
    if (nodeHandlersRegistry.list().length === 0) {
      initializeNodeHandlers();
    }

    for (const node of nodes) {
      const handler = nodeHandlersRegistry.get(node.type);
      if (handler) {
        let configToValidate = node.data?.config?.[node.type];

        try {
          const result = await handler.validate(configToValidate);
          if (!result.isValid) {
            for (const errorMsg of result.errors) {
              errors.push({
                type: 'error',
                message: `Ошибка в ноде '${node.data?.label || node.id}': ${errorMsg}`,
                nodeId: node.id
              });
            }
          }
        } catch (validationError: any) {
          errors.push({
            type: 'error',
            message: `Ошибка валидации ноды '${node.data?.label || node.id}': ${validationError.message}`,
            nodeId: node.id
          });
        }
      }
    }
  } catch (e) {
    console.warn('Не удалось провести глубокую валидацию конфигураций:', e);
  }

  return errors;
}
