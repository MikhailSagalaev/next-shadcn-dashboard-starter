/**
 * @file: src/lib/services/workflow/handlers/switch-handler.ts
 * @description: Обработчик для flow.switch (множественный выбор)
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';

/**
 * Case для switch
 */
export interface SwitchCase {
  value: any;
  label?: string;
}

/**
 * Конфигурация для flow.switch
 */
export interface SwitchConfig {
  variable: string;  // Переменная для проверки
  cases: SwitchCase[];  // Список вариантов
  hasDefault?: boolean;  // Есть ли default case
}

/**
 * Обработчик для flow.switch
 * Множественный выбор (switch/case) на основе значения переменной
 */
export class SwitchHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'flow.switch';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['flow.switch'] as SwitchConfig;

      if (!config) {
        throw new Error('Switch configuration is missing');
      }

      if (!config.variable) {
        throw new Error('Variable is required for switch');
      }

      // Получаем значение переменной
      const variableValue = await this.getVariable(config.variable, context, 'session');

      this.logStep(context, node, 'Executing switch', 'info', {
        variable: config.variable,
        value: variableValue,
        casesCount: config.cases?.length || 0
      });

      // Сохраняем результат для использования в getNextNodeId
      // Находим индекс matching case
      let matchedCaseIndex = -1;

      if (config.cases && Array.isArray(config.cases)) {
        for (let i = 0; i < config.cases.length; i++) {
          const caseValue = this.resolveValue(config.cases[i].value, context);
          
          if (this.valuesMatch(variableValue, caseValue)) {
            matchedCaseIndex = i;
            break;
          }
        }
      }

      // Если не нашли совпадение и есть default
      if (matchedCaseIndex === -1 && config.hasDefault) {
        matchedCaseIndex = config.cases?.length || 0; // default - последний
      }

      // Сохраняем результат в контекст
      await this.setVariable('switch_result', matchedCaseIndex, context, 'session');

      this.logStep(context, node, `Switch matched case: ${matchedCaseIndex}`, 'debug', {
        matchedValue: matchedCaseIndex >= 0 ? config.cases?.[matchedCaseIndex]?.value : 'default'
      });

      // Следующий нод определяется по connections с типом case_0, case_1, ..., default
      return null;

    } catch (error) {
      this.logStep(context, node, 'Switch execution failed', 'error', { error });
      throw error;
    }
  }

  /**
   * Проверяет совпадение значений с учетом типов
   */
  private valuesMatch(value1: any, value2: any): boolean {
    // Строгое сравнение
    if (value1 === value2) {
      return true;
    }

    // Сравнение с приведением типов для чисел и строк
    if (typeof value1 === 'number' && typeof value2 === 'string') {
      return value1 === Number(value2);
    }

    if (typeof value1 === 'string' && typeof value2 === 'number') {
      return Number(value1) === value2;
    }

    // Сравнение строк без учета регистра
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return value1.toLowerCase() === value2.toLowerCase();
    }

    return false;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Switch configuration is required');
      return { isValid: false, errors };
    }

    if (!config.variable || typeof config.variable !== 'string') {
      errors.push('Variable is required and must be a string');
    }

    if (!config.cases || !Array.isArray(config.cases)) {
      errors.push('Cases are required and must be an array');
    } else {
      if (config.cases.length === 0) {
        errors.push('At least one case is required');
      }

      // Проверяем каждый case
      for (let i = 0; i < config.cases.length; i++) {
        const caseItem = config.cases[i];

        if (caseItem.value === undefined) {
          errors.push(`Case ${i} must have a value`);
        }
      }

      // Проверяем на дубликаты
      const values = config.cases.map((c: SwitchCase) => c.value);
      const uniqueValues = new Set(values);
      if (values.length !== uniqueValues.size) {
        errors.push('Case values must be unique');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

