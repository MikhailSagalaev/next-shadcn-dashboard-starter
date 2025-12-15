/**
 * @file: src/lib/services/workflow/handlers/base-handler.ts
 * @description: Базовый класс для обработчиков нод
 * @project: SaaS Bonus System
 * @dependencies: NodeHandler, ExecutionContext
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import type {
  NodeHandler,
  ValidationResult,
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  HandlerResult
} from '@/types/workflow';

/**
 * Базовый класс для обработчиков нод
 * Предоставляет общую логику валидации и выполнения
 */
export abstract class BaseNodeHandler implements NodeHandler {
  /**
   * Проверяет, может ли этот handler обработать указанный тип ноды
   */
  abstract canHandle(nodeType: WorkflowNodeType): boolean;

  /**
   * Выполняет ноду
   */
  abstract execute(node: WorkflowNode, context: ExecutionContext): Promise<HandlerResult>;

  /**
   * Валидирует конфигурацию ноды
   */
  validate(config: any): Promise<ValidationResult> {
    // Базовая валидация - всегда успешная
    return Promise.resolve({
      isValid: true,
      errors: []
    });
  }

  /**
   * Логирует шаг выполнения
   */
  protected logStep(
    context: ExecutionContext,
    node: WorkflowNode,
    message: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    data?: any
  ): void {
    context.logger[level](message, {
      executionId: context.executionId,
      step: context.step,
      nodeId: node.id,
      nodeType: node.type,
      status: level === 'error' ? 'error' : 'ok',
      ...data
    });
  }

  /**
   * Получает значение из конфигурации с поддержкой переменных
   * ⚠️ Синхронная версия - для простых значений без async переменных
   */
  protected resolveValue(
    value: any,
    context: ExecutionContext
  ): any {
    if (typeof value === 'string') {
      // Простая замена без async - для telegram контекста
      return value.replace(/\{\{([^}]+)\}\}/g, (match: string, varPath: string) => {
        try {
          const resolved = this.getVariableValueSync(varPath, context);
          return resolved !== undefined ? String(resolved) : match;
        } catch (error) {
          return match;
        }
      });
    }

    // Для объектов рекурсивно разрешаем переменные
    if (typeof value === 'object' && value !== null) {
      const resolved: any = Array.isArray(value) ? [] : {};

      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveValue(val, context);
      }

      return resolved;
    }

    return value;
  }

  /**
   * Синхронное получение значения переменной из Telegram контекста
   * Используется только для telegram.* переменных
   */
  protected getVariableValueSync(varPath: string, context: ExecutionContext): any {
    const parts = varPath.split('.');

    // Telegram переменные
    if (parts[0] === 'telegram') {
      const telegramContext: any = context.telegram;
      let value = telegramContext;
      
      for (let i = 1; i < parts.length; i++) {
        value = value?.[parts[i]];
      }
      
      return value || '';
    }

    // Для других переменных возвращаем placeholder
    // Они должны разрешаться через async методы
    return varPath;
  }

  /**
   * Устанавливает переменную в контекст
   */
  protected setVariable(
    key: string,
    value: any,
    context: ExecutionContext,
    scope: 'global' | 'project' | 'user' | 'session' = 'session',
    ttl?: number
  ): Promise<void> {
    return context.variables.set(key, value, scope, ttl);
  }

  /**
   * Получает переменную из контекста
   */
  protected getVariable(
    key: string,
    context: ExecutionContext,
    scope: 'global' | 'project' | 'user' | 'session' = 'session'
  ): Promise<any> {
    return context.variables.get(key, scope);
  }
}
