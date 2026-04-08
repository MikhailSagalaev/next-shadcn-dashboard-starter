/**
 * @file: src/lib/services/workflow/button-actions-executor.ts
 * @description: Executor для встроенных действий в кнопках (как у конкурентов)
 * @project: SaaS Bonus System
 * @dependencies: ExecutionContext, QueryExecutor
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { QueryExecutor } from './query-executor';
import { ProjectVariablesService } from '@/lib/services/project-variables.service';
import { UserVariablesService } from './user-variables.service';
import { sendPlatformMessage } from './platform-messaging';
import type { ExecutionContext } from '@/types/workflow';

/**
 * Типы действий, которые могут быть встроены в кнопки
 */
export interface ButtonAction {
  id?: string;
  type:
    | 'database_query'
    | 'send_message'
    | 'condition'
    | 'set_variable'
    | 'get_variable'
    | 'delay';

  // Для database_query
  query?: string;
  parameters?: Record<string, any>;
  assignTo?: string;

  // Для send_message
  text?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';

  // Для condition
  variable?: string;
  operator?:
    | 'is_empty'
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains';
  value?: any;
  true_actions?: ButtonAction[];
  false_actions?: ButtonAction[];

  // Для set_variable
  key?: string;

  // Для delay
  seconds?: number;
}

/**
 * Executor для выполнения встроенных действий в кнопках
 */
export class ButtonActionsExecutor {
  /**
   * Выполняет массив действий последовательно
   */
  static async executeActions(
    actions: ButtonAction[],
    context: ExecutionContext
  ): Promise<void> {
    logger.info('🎬 Начало выполнения встроенных действий', {
      actionsCount: actions.length,
      executionId: context.executionId
    });

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      logger.info(`📌 Выполнение действия ${i + 1}/${actions.length}`, {
        actionId: action.id || `action-${i}`,
        actionType: action.type,
        executionId: context.executionId
      });

      try {
        await this.executeAction(action, context);
      } catch (error) {
        logger.error(`❌ Ошибка при выполнении действия ${i + 1}`, {
          actionId: action.id || `action-${i}`,
          actionType: action.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionId: context.executionId
        });
        throw error;
      }
    }

    logger.info('✅ Все встроенные действия выполнены успешно', {
      actionsCount: actions.length,
      executionId: context.executionId
    });
  }

  /**
   * Выполняет одно действие
   */
  private static async executeAction(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    switch (action.type) {
      case 'database_query':
        await this.executeDatabaseQuery(action, context);
        break;

      case 'send_message':
        await this.executeSendMessage(action, context);
        break;

      case 'condition':
        await this.executeCondition(action, context);
        break;

      case 'set_variable':
        await this.executeSetVariable(action, context);
        break;

      case 'get_variable':
        await this.executeGetVariable(action, context);
        break;

      case 'delay':
        await this.executeDelay(action, context);
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * Выполняет database query
   */
  private static async executeDatabaseQuery(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    if (!action.query) {
      throw new Error('Database query is required');
    }

    logger.debug('🗄️ Executing database query', {
      query: action.query,
      hasParams: !!action.parameters
    });

    // Разрешаем переменные в параметрах
    const resolvedParams = this.resolveVariables(
      action.parameters || {},
      context
    );

    // Добавляем projectId
    if (!resolvedParams.projectId) {
      resolvedParams.projectId = context.projectId;
    }

    // Выполняем запрос
    const result = await QueryExecutor.execute(
      context.services.db,
      action.query,
      resolvedParams
    );

    // Сохраняем результат в переменную
    if (action.assignTo && result) {
      await context.variables.set(action.assignTo, result, 'session');
      logger.debug(`💾 Query result assigned to variable: ${action.assignTo}`);
    }

    logger.info('✅ Database query executed successfully');
  }

  /**
   * Отправляет сообщение
   */
  private static async executeSendMessage(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    if (!action.text) {
      throw new Error('Message text is required');
    }

    logger.debug('💬 Sending message', {
      textLength: action.text.length
    });

    // Разрешаем переменные в тексте
    const additionalVariables: Record<string, string> = {
      username: context.telegram.username || '',
      first_name: context.telegram.firstName || '',
      user_id: context.telegram.userId || '',
      chat_id: context.telegram.chatId || '',
      workflow_id: context.workflowId,
      execution_id: context.executionId,
      session_id: context.sessionId
    };

    // Если userId не задан в контексте — пытаемся определить по Telegram ID
    let userId = context.userId;
    if (!userId && context.telegram?.userId) {
      try {
        const found = await QueryExecutor.execute(
          context.services.db,
          'check_user_by_platform',
          {
            telegramId:
              context.platform === 'telegram'
                ? context.telegram.userId
                : undefined,
            maxId:
              context.platform === 'max' ? context.telegram.userId : undefined,
            projectId: context.projectId
          }
        );
        if (found?.id) {
          userId = found.id;
          logger.debug('Resolved userId from platformId', {
            userId,
            platform: context.platform
          });
        }
      } catch (e) {
        logger.warn('Failed resolve userId from platformId', {
          error: e,
          platform: context.platform
        });
      }
    }

    // Получаем переменные пользователя, если userId доступен
    if (userId) {
      try {
        logger.debug('Loading user variables for message', { userId });

        const userVariables = await UserVariablesService.getUserVariables(
          context.services.db,
          userId,
          context.projectId
        );

        logger.debug('User variables loaded', {
          variableCount: Object.keys(userVariables).length
        });

        // Добавляем переменные пользователя с префиксом user.
        Object.entries(userVariables).forEach(([key, value]) => {
          additionalVariables[key] = String(value);
        });
      } catch (error) {
        logger.warn('Failed to load user variables', { error, userId });

        // Добавляем базовые переменные даже без userId
        additionalVariables['user.firstName'] =
          context.telegram.firstName || 'Пользователь';
        additionalVariables['user.telegramUsername'] =
          context.telegram.username || '';
        additionalVariables['user.balanceFormatted'] = '0 бонусов';
        additionalVariables['user.currentLevel'] = 'Базовый';
        additionalVariables['user.referralCode'] = 'Недоступно';
        additionalVariables['user.referralLink'] = 'Недоступно';
      }
    } else {
      logger.debug('No userId available, using basic variables');

      // Добавляем базовые переменные даже без userId
      additionalVariables['user.firstName'] =
        context.telegram.firstName || 'Пользователь';
      additionalVariables['user.telegramUsername'] =
        context.telegram.username || '';
      additionalVariables['user.balanceFormatted'] = '0 бонусов';
      additionalVariables['user.currentLevel'] = 'Базовый';
      additionalVariables['user.referralCode'] = 'Недоступно';
      additionalVariables['user.referralLink'] = 'Недоступно';
    }

    let messageText = await ProjectVariablesService.replaceVariablesInText(
      context.projectId,
      action.text,
      additionalVariables
    );

    // Отправляем через платформо-независимый хелпер
    await sendPlatformMessage(context, messageText, {
      parseMode: action.parse_mode || 'HTML'
    });

    logger.info('✅ Message sent successfully');
  }

  /**
   * Выполняет условие (if-else)
   */
  private static async executeCondition(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    if (!action.variable || !action.operator) {
      throw new Error('Condition requires variable and operator');
    }

    logger.debug('🔀 Evaluating condition', {
      variable: action.variable,
      operator: action.operator
    });

    // Получаем значение переменной
    const variableValue = await context.variables.get(
      action.variable,
      'session'
    );

    // Оцениваем условие
    let conditionResult = false;

    switch (action.operator) {
      case 'is_empty':
        conditionResult =
          !variableValue ||
          variableValue === null ||
          variableValue === undefined;
        break;

      case 'equals':
        conditionResult = variableValue === action.value;
        break;

      case 'not_equals':
        conditionResult = variableValue !== action.value;
        break;

      case 'greater_than':
        conditionResult = Number(variableValue) > Number(action.value);
        break;

      case 'less_than':
        conditionResult = Number(variableValue) < Number(action.value);
        break;

      case 'contains':
        conditionResult = String(variableValue).includes(String(action.value));
        break;

      default:
        throw new Error(`Unknown operator: ${action.operator}`);
    }

    logger.info(`🎯 Condition evaluated: ${conditionResult}`, {
      variable: action.variable,
      operator: action.operator,
      value: action.value
    });

    // Выполняем соответствующие действия
    if (conditionResult && action.true_actions) {
      logger.debug('✅ Executing TRUE branch', {
        actionsCount: action.true_actions.length
      });
      await this.executeActions(action.true_actions, context);
    } else if (!conditionResult && action.false_actions) {
      logger.debug('❌ Executing FALSE branch', {
        actionsCount: action.false_actions.length
      });
      await this.executeActions(action.false_actions, context);
    }
  }

  /**
   * Устанавливает переменную
   */
  private static async executeSetVariable(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    if (!action.key) {
      throw new Error('Variable key is required');
    }

    const resolvedValue = this.resolveValue(action.value, context);

    await context.variables.set(action.key, resolvedValue, 'session');

    logger.info('💾 Variable set', { key: action.key });
  }

  /**
   * Получает переменную
   */
  private static async executeGetVariable(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    if (!action.key || !action.assignTo) {
      throw new Error('Variable key and assignTo are required');
    }

    const value = await context.variables.get(action.key, 'session');

    await context.variables.set(action.assignTo, value, 'session');

    logger.info('📥 Variable retrieved', {
      key: action.key,
      assignTo: action.assignTo
    });
  }

  /**
   * Выполняет задержку
   */
  private static async executeDelay(
    action: ButtonAction,
    context: ExecutionContext
  ): Promise<void> {
    const seconds = action.seconds || 1;

    logger.info(`⏳ Delaying for ${seconds} seconds`);

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

    logger.info('✅ Delay completed');
  }

  /**
   * Разрешает переменные в объекте параметров
   */
  private static resolveVariables(
    params: Record<string, any>,
    context: ExecutionContext
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      resolved[key] = this.resolveValue(value, context);
    }

    return resolved;
  }

  /**
   * Разрешает одно значение (поддерживает переменные вида {{name}})
   */
  private static resolveValue(value: any, context: ExecutionContext): any {
    if (typeof value === 'string') {
      // Заменяем {{telegram.userId}} и подобные
      return value.replace(
        /\{\{([^}]+)\}\}/g,
        (match: string, varPath: string) => {
          const parts = varPath.split('.');

          // Telegram переменные
          if (parts[0] === 'telegram') {
            const telegramContext: any = context.telegram;
            let result = telegramContext;

            for (let i = 1; i < parts.length; i++) {
              result = result?.[parts[i]];
            }

            return result !== undefined ? String(result) : match;
          }

          // Возвращаем как есть для других переменных
          return match;
        }
      );
    }

    return value;
  }
}

export default ButtonActionsExecutor;
