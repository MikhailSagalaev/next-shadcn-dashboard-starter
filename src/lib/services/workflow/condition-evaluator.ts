/**
 * @file: src/lib/services/workflow/condition-evaluator.ts
 * @description: Безопасный Condition Evaluator с AST для сложных выражений
 * @project: SaaS Bonus System
 * @dependencies: acorn (AST parser), safe-eval utilities
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { parse } from 'acorn';
import { generate } from 'astring';
import { logger } from '@/lib/logger';
import type { ExecutionContext } from '@/types/workflow';

/**
 * Безопасный evaluator для условий с поддержкой AST
 */
export class ConditionEvaluator {
  private static readonly ALLOWED_IDENTIFIERS = new Set([
    // Переменные контекста
    'user', 'session', 'project', 'global',
    // Математические функции
    'Math', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    // Строковые функции
    'String', 'Number', 'Boolean',
    // Массивные функции
    'Array', 'Object',
    // Утилиты
    'Date', 'RegExp'
  ]);

  private static readonly ALLOWED_NODE_TYPES = new Set([
    'Program', 'ExpressionStatement', 'CallExpression', 'MemberExpression',
    'Identifier', 'Literal', 'BinaryExpression', 'LogicalExpression',
    'UnaryExpression', 'ConditionalExpression', 'ArrayExpression',
    'ObjectExpression', 'Property', 'FunctionExpression', 'ArrowFunctionExpression'
  ]);

  /**
   * Оценивает сложное условие с поддержкой AST
   */
  static async evaluate(expression: string, context: ExecutionContext): Promise<boolean> {
    try {
      logger.debug('Evaluating complex condition', {
        expression: expression.substring(0, 100),
        executionId: context.executionId
      });

      // Парсим AST
      const ast = parse(expression, {
        ecmaVersion: 2020,
        allowReturnOutsideFunction: true
      });

      // Валидируем AST
      this.validateAST(ast);

      // Создаем безопасный контекст выполнения
      const safeContext = this.createSafeContext(context);

      // Выполняем выражение в безопасном контексте
      const result = this.executeAST(ast, safeContext);

      const finalResult = Boolean(result);
      logger.debug('Condition evaluated successfully', {
        expression: expression.substring(0, 50),
        result: finalResult
      });

      return finalResult;
    } catch (error) {
      logger.error('Failed to evaluate condition', {
        expression: expression.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Condition evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Создает безопасный контекст выполнения
   */
  private static createSafeContext(context: ExecutionContext): Record<string, any> {
    return {
      // Переменные из контекста
      user: context.variables,
      session: context.variables,
      project: context.variables,
      global: context.variables,

      // Безопасные утилиты
      Math,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      String,
      Number,
      Boolean,
      Array,
      Object,
      Date,
      RegExp: class SafeRegExp {
        constructor(pattern: string | RegExp, flags?: string) {
          return new RegExp(pattern as string, flags);
        }
        test(str: string): boolean {
          return (this as any).test(str);
        }
        exec(str: string): RegExpExecArray | null {
          return (this as any).exec(str);
        }
      },

      // Функции для работы с переменными
      get: (key: string, scope: string = 'session') => {
        try {
          return context.variables.getSync(key, scope as any);
        } catch {
          return undefined;
        }
      },

      // Хелперы
      isEmpty: (value: any) => value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0),

      notEmpty: (value: any) => !(value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0))
    };
  }

  /**
   * Валидирует AST на безопасность
   */
  private static validateAST(node: any): void {
    if (!node || typeof node !== 'object') {
      throw new Error('Invalid AST node');
    }

    if (!this.ALLOWED_NODE_TYPES.has(node.type)) {
      throw new Error(`Disallowed AST node type: ${node.type}`);
    }

    // Рекурсивно проверяем дочерние ноды
    for (const key in node) {
      if (key === 'type' || key === 'start' || key === 'end') continue;

      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item && typeof item === 'object' && item.type) {
            this.validateAST(item);
          }
        });
      } else if (value && typeof value === 'object' && value.type) {
        this.validateAST(value);
      } else if (key === 'name' && typeof value === 'string') {
        // Проверяем идентификаторы
        if (!this.ALLOWED_IDENTIFIERS.has(value) &&
            !value.startsWith('$') && // Разрешаем переменные с $
            !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
          throw new Error(`Disallowed identifier: ${value}`);
        }
      }
    }
  }

  /**
   * Выполняет AST в безопасном контексте
   */
  private static executeAST(ast: any, context: Record<string, any>): any {
    // Преобразуем AST обратно в код для выполнения
    const code = generate(ast);

    // Создаем функцию с безопасным контекстом
    const func = new Function(...Object.keys(context), `return (${code});`);

    // Выполняем в безопасном контексте
    return func(...Object.values(context));
  }

  /**
   * Проверяет, является ли выражение сложным (требует AST)
   */
  static isComplexExpression(expression: string): boolean {
    // Простые проверки на сложность
    return expression.includes('&&') ||
           expression.includes('||') ||
           expression.includes('>') ||
           expression.includes('<') ||
           expression.includes('>=') ||
           expression.includes('<=') ||
           expression.includes('===') ||
           expression.includes('!==') ||
           expression.includes('!') ||
           expression.includes('?') ||
           expression.includes(':') ||
           /\b(Math|parseInt|parseFloat|isNaN|isFinite)\b/.test(expression) ||
           /\b(get|isEmpty|notEmpty)\b/.test(expression);
  }

  /**
   * Простая оценка для базовых условий (обратная совместимость)
   */
  static evaluateSimple(variable: any, operator: string, expected: any, caseSensitive: boolean = false): boolean {
    const normalizeString = (value: any): string => {
      const str = String(value || '');
      return caseSensitive ? str : str.toLowerCase();
    };

    switch (operator) {
      case 'equals':
      case '==':
      case '===':
        return variable === expected;

      case 'not_equals':
      case '!=':
      case '!==':
        return variable !== expected;

      case 'contains':
        return normalizeString(variable).includes(normalizeString(expected));

      case 'not_contains':
        return !normalizeString(variable).includes(normalizeString(expected));

      case 'greater':
      case '>':
        return Number(variable) > Number(expected);

      case 'less':
      case '<':
        return Number(variable) < Number(expected);

      case 'greater_equal':
      case '>=':
        return Number(variable) >= Number(expected);

      case 'less_equal':
      case '<=':
        return Number(variable) <= Number(expected);

      case 'is_empty':
        return !variable || (typeof variable === 'string' && variable.trim() === '');

      case 'is_not_empty':
        return variable && (typeof variable !== 'string' || variable.trim() !== '');

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }
}
