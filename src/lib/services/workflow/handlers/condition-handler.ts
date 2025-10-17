/**
 * @file: src/lib/services/workflow/handlers/condition-handler.ts
 * @description: Обработчик для condition нод
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import { ConditionEvaluator } from '../condition-evaluator';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';

/**
 * Обработчик для condition нод
 */
export class ConditionHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'condition';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.condition;

      if (!config) {
        throw new Error('Condition configuration is missing');
      }

      // Оцениваем условие
      const result = await this.evaluateCondition(config, context);

      // DEBUG: Проверяем значение переменной
      const variableValue = await context.variables.get(config.variable, 'session');
      console.log(`🔍 ConditionHandler ${node.id}: variable="${config.variable}" = ${JSON.stringify(variableValue)} (${typeof variableValue})`);
      console.log(`🔍 ConditionHandler ${node.id}: operator="${config.operator}", result=${result}`);

      this.logStep(context, node, 'Condition evaluated', 'info', {
        variable: config.variable,
        operator: config.operator,
        expectedValue: config.value,
        actualResult: result,
        variableValue: variableValue
      });

      // Сохраняем результат условия для использования в getNextNodeId
      // Убеждаемся что result - это boolean, а не Promise
      const booleanResult = Boolean(result);
      context.variables.set('condition_result', booleanResult, 'session');

      this.logStep(context, node, `Condition result: ${result}`, 'debug');

      // Следующий нод определяется по connections с учетом типа (true/false)
      return null;

    } catch (error) {
      this.logStep(context, node, 'Condition evaluation failed', 'error', { error });
      throw error;
    }
  }

  /**
   * Оценивает условие
   */
  private async evaluateCondition(config: any, context: ExecutionContext): Promise<boolean> {
    const { expression, variable, operator, value, caseSensitive = false } = config;

    // Если есть expression - используем новый evaluator с AST
    if (expression && typeof expression === 'string') {
      if (ConditionEvaluator.isComplexExpression(expression)) {
        return await ConditionEvaluator.evaluate(expression, context);
      } else {
        // Для простых выражений тоже используем новый evaluator
        return await ConditionEvaluator.evaluate(expression, context);
      }
    }

    // Обратная совместимость: простое условие
    if (!variable) {
      throw new Error('Variable is required for simple condition');
    }

    // Получаем значение переменной
    let actualValue: any;
    try {
      actualValue = await this.getVariable(variable, context, 'session');
    } catch (error) {
      this.logStep(context, {} as WorkflowNode, `Variable ${variable} not found, using undefined`, 'warn');
      actualValue = undefined;
    }

    // Разрешаем переменные в ожидаемом значении
    const expectedValue = this.resolveValue(value, context);

    this.logStep(context, {} as WorkflowNode, 'Evaluating simple condition', 'debug', {
      variable,
      actualValue,
      operator,
      expectedValue
    });

    // Оцениваем простое условие
    return ConditionEvaluator.evaluateSimple(actualValue, operator, expectedValue, caseSensitive);
  }


  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Condition configuration is required');
      return { isValid: false, errors };
    }

    // Валидация для expression (новый способ)
    if (config.expression !== undefined) {
      if (typeof config.expression !== 'string') {
        errors.push('Expression must be a string');
      } else if (config.expression.trim() === '') {
        errors.push('Expression cannot be empty');
      } else {
        // Проверяем синтаксис выражения
        try {
          // Простая проверка - пытаемся распарсить
          ConditionEvaluator.evaluate(config.expression, {} as any);
        } catch (error) {
          errors.push(`Invalid expression syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      // Валидация для старого формата (обратная совместимость)
      if (!config.variable || typeof config.variable !== 'string') {
        errors.push('Variable is required and must be a string');
      }

      const validOperators = ['equals', 'not_equals', 'contains', 'not_contains', 'greater', 'less', 'is_empty', 'is_not_empty', '==', '!=', '===', '!==', '>', '<', '>=', '<='];
      if (!config.operator || !validOperators.includes(config.operator)) {
        errors.push(`Operator must be one of: ${validOperators.join(', ')}`);
      }

      // value может быть undefined для некоторых операторов
      if (config.operator && !['is_empty', 'is_not_empty'].includes(config.operator) && config.value === undefined) {
        errors.push('Value is required for this operator');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
