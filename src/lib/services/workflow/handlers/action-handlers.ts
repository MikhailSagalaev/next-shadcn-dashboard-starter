/**
 * @file: src/lib/services/workflow/handlers/action-handlers.ts
 * @description: Обработчики для action нод
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext, QueryExecutor
 * @created: 2025-01-13
 * @updated: 2025-10-14 - Добавлен безопасный QueryExecutor
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import { QueryExecutor } from '../query-executor';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';

/**
 * Обработчик для action.database_query
 * ✅ БЕЗОПАСНО: Использует whitelist запросов вместо raw SQL
 */
export class DatabaseQueryHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.database_query';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.database_query'];

      if (!config) {
        throw new Error('Database query configuration is missing');
      }

      if (!config.query) {
        throw new Error('Query type is required');
      }

      // Проверяем, что запрос в whitelist
      if (!QueryExecutor.isQueryAvailable(config.query)) {
        const availableQueries = QueryExecutor.getAvailableQueries();
        throw new Error(
          `Unauthorized query type: ${config.query}. ` +
          `Available queries: ${availableQueries.join(', ')}`
        );
      }

      // Разрешаем переменные в параметрах
      const resolvedParams = this.resolveParameters(config.parameters, context);

      this.logStep(context, node, 'Executing safe database query', 'info', {
        queryType: config.query,
        params: Object.keys(resolvedParams)
      });

      // ✅ Выполняем БЕЗОПАСНЫЙ запрос через QueryExecutor
      const result = await QueryExecutor.execute(
        context.services.db,
        config.query,
        resolvedParams
      );

      // Сохраняем результат в переменную если указано
      if (config.assignTo) {
        await this.setVariable(config.assignTo, result, context, 'session');
        this.logStep(context, node, `Query result assigned to variable: ${config.assignTo}`, 'debug');
      }

      // Обрабатываем resultMapping если есть
      if (config.resultMapping && typeof result === 'object') {
        for (const [key, varName] of Object.entries(config.resultMapping)) {
          const value = (result as any)[key];
          if (value !== undefined) {
            await this.setVariable(varName as string, value, context, 'session');
          }
        }
      }

      this.logStep(context, node, 'Database query executed successfully', 'info', {
        hasResult: !!result
      });

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Database query failed', 'error', { error });
      throw error;
    }
  }

  /**
   * Разрешает переменные в параметрах запроса
   */
  private resolveParameters(parameters: any, context: ExecutionContext): Record<string, any> {
    if (!parameters || typeof parameters !== 'object') {
      return {};
    }

    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      resolved[key] = this.resolveValue(value, context);
    }

    // ✅ Всегда добавляем projectId из контекста
    if (!resolved.projectId) {
      resolved.projectId = context.projectId;
    }

    return resolved;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Database query configuration is required');
      return { isValid: false, errors };
    }

    if (!config.query || typeof config.query !== 'string') {
      errors.push('Query type is required and must be a string');
    } else if (!QueryExecutor.isQueryAvailable(config.query)) {
      const availableQueries = QueryExecutor.getAvailableQueries();
      errors.push(
        `Invalid query type: ${config.query}. ` +
        `Available: ${availableQueries.join(', ')}`
      );
    }

    if (config.parameters && typeof config.parameters !== 'object') {
      errors.push('Parameters must be an object');
    }

    if (config.assignTo && typeof config.assignTo !== 'string') {
      errors.push('assignTo must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для action.set_variable
 */
export class SetVariableHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.set_variable';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.set_variable'];

      if (!config) {
        throw new Error('Set variable configuration is missing');
      }

      if (!config.variableName) {
        throw new Error('Variable name is required');
      }

      // Разрешаем переменные в значении
      const resolvedValue = this.resolveValue(config.variableValue, context);

      this.logStep(context, node, 'Setting variable', 'debug', {
        variableName: config.variableName,
        scope: config.scope || 'session',
        hasTTL: !!config.ttl
      });

      // Устанавливаем переменную
      await this.setVariable(
        config.variableName,
        resolvedValue,
        context,
        config.scope || 'session',
        config.ttl
      );

      this.logStep(context, node, `Variable ${config.variableName} set successfully`, 'info');

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to set variable', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Set variable configuration is required');
      return { isValid: false, errors };
    }

    if (!config.variableName || typeof config.variableName !== 'string') {
      errors.push('Variable name is required and must be a string');
    }

    if (config.scope && !['global', 'project', 'user', 'session'].includes(config.scope)) {
      errors.push('Scope must be one of: global, project, user, session');
    }

    if (config.ttl && (typeof config.ttl !== 'number' || config.ttl <= 0)) {
      errors.push('TTL must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для action.get_variable
 */
export class GetVariableHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.get_variable';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.get_variable'];

      if (!config) {
        throw new Error('Get variable configuration is missing');
      }

      if (!config.variableName) {
        throw new Error('Variable name is required');
      }

      this.logStep(context, node, 'Getting variable', 'debug', {
        variableName: config.variableName,
        scope: 'session', // Пока только session scope
        assignTo: config.assignTo
      });

      // Получаем переменную
      const value = await this.getVariable(config.variableName, context, 'session');

      // Если указано assignTo, сохраняем в другую переменную
      if (config.assignTo) {
        const finalValue = value !== undefined ? value : config.defaultValue;
        await this.setVariable(config.assignTo, finalValue, context, 'session');
        this.logStep(context, node, `Variable ${config.variableName} assigned to ${config.assignTo}`, 'info');
      }

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to get variable', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Get variable configuration is required');
      return { isValid: false, errors };
    }

    if (!config.variableName || typeof config.variableName !== 'string') {
      errors.push('Variable name is required and must be a string');
    }

    if (config.assignTo && typeof config.assignTo !== 'string') {
      errors.push('assignTo must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
