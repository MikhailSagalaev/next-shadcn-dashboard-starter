/**
 * @file: src/lib/services/workflow/utils/node-utils.ts
 * @description: Утилиты для работы с нодами workflow - нормализация и сериализация
 * @project: SaaS Bonus System
 * @dependencies: @/types/workflow
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

import type { WorkflowNode } from '@/types/workflow';

/**
 * Нормализует nodes из различных форматов в Record<string, WorkflowNode>
 *
 * Поддерживаемые входные форматы:
 * - Record<string, WorkflowNode> (уже нормализованный объект)
 * - WorkflowNode[] (массив нод)
 * - string (JSON строка, которая может быть массивом или объектом)
 * - null/undefined (возвращает пустой объект)
 *
 * @param source - Исходные данные нод в любом поддерживаемом формате
 * @returns Record<string, WorkflowNode> - Нормализованный объект с nodeId в качестве ключей
 *
 * @example
 * // Из массива
 * const nodes = normalizeNodes([{ id: 'node-1', type: 'message', ... }]);
 * // Результат: { 'node-1': { id: 'node-1', type: 'message', ... } }
 *
 * @example
 * // Из JSON строки
 * const nodes = normalizeNodes('[{"id":"node-1","type":"message"}]');
 * // Результат: { 'node-1': { id: 'node-1', type: 'message', ... } }
 */
export function normalizeNodes(source: unknown): Record<string, WorkflowNode> {
  // Обработка null/undefined
  if (source === null || source === undefined) {
    return {};
  }

  // Если это строка - парсим JSON и рекурсивно обрабатываем
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      return normalizeNodes(parsed);
    } catch {
      // Невалидный JSON - возвращаем пустой объект
      return {};
    }
  }

  // Если это не объект - возвращаем пустой объект
  if (typeof source !== 'object') {
    return {};
  }

  // Если это массив - конвертируем в объект с id в качестве ключей
  if (Array.isArray(source)) {
    return source.reduce(
      (acc: Record<string, WorkflowNode>, node: WorkflowNode) => {
        if (node && typeof node === 'object' && node.id) {
          acc[node.id] = node;
        }
        return acc;
      },
      {}
    );
  }

  // Если это уже объект - проверяем что это валидный Record<string, WorkflowNode>
  // и возвращаем как есть
  const obj = source as Record<string, unknown>;

  // Проверяем, что все значения являются валидными нодами
  const result: Record<string, WorkflowNode> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isValidWorkflowNode(value)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Сериализует nodes из Record<string, WorkflowNode> в массив для сохранения в БД
 *
 * @param nodes - Объект нод с nodeId в качестве ключей
 * @returns WorkflowNode[] - Массив нод для сохранения
 *
 * @example
 * const array = serializeNodes({ 'node-1': { id: 'node-1', type: 'message', ... } });
 * // Результат: [{ id: 'node-1', type: 'message', ... }]
 */
export function serializeNodes(
  nodes: Record<string, WorkflowNode>
): WorkflowNode[] {
  if (!nodes || typeof nodes !== 'object') {
    return [];
  }

  return Object.values(nodes);
}

/**
 * Проверяет, является ли значение валидной WorkflowNode
 *
 * @param value - Значение для проверки
 * @returns boolean - true если значение является валидной нодой
 */
function isValidWorkflowNode(value: unknown): value is WorkflowNode {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as Record<string, unknown>;

  // Минимальные требования для валидной ноды: id и type
  return (
    typeof node.id === 'string' &&
    node.id.length > 0 &&
    typeof node.type === 'string' &&
    node.type.length > 0
  );
}

/**
 * Получает ноду по ID из нормализованного объекта нод
 *
 * @param nodes - Нормализованный объект нод
 * @param nodeId - ID ноды для поиска
 * @returns WorkflowNode | undefined - Найденная нода или undefined
 */
export function getNodeById(
  nodes: Record<string, WorkflowNode>,
  nodeId: string
): WorkflowNode | undefined {
  return nodes[nodeId];
}

/**
 * Получает все ноды определенного типа
 *
 * @param nodes - Нормализованный объект нод
 * @param type - Тип ноды для фильтрации
 * @returns WorkflowNode[] - Массив нод указанного типа
 */
export function getNodesByType(
  nodes: Record<string, WorkflowNode>,
  type: string
): WorkflowNode[] {
  return Object.values(nodes).filter((node) => node.type === type);
}

/**
 * Подсчитывает количество нод в объекте
 *
 * @param nodes - Нормализованный объект нод
 * @returns number - Количество нод
 */
export function countNodes(nodes: Record<string, WorkflowNode>): number {
  return Object.keys(nodes).length;
}
