/**
 * @file: src/lib/services/bot-flow-executor/node-handlers/node-handler.ts
 * @description: Базовый интерфейс для обработчиков нод
 * @project: SaaS Bonus System
 * @dependencies: Grammy, Flow types
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import type { BotConstructorContext } from '../../bot-session.service';
import type { BotFlow } from '@/types/bot-constructor';

export interface NodeExecutionResult {
  nextNodeId?: string;
  endFlow?: boolean;
  waitForInput?: boolean;
  error?: string;
  variables?: Record<string, any>;
}

export interface NodeHandler {
  execute(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult>;
}

export abstract class BaseNodeHandler implements NodeHandler {
  abstract execute(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult>;

  /**
   * Получение значения переменной из сессии или контекста
   */
  protected getVariableValue(
    ctx: BotConstructorContext,
    variableName: string
  ): any {
    // Получаем из сессии
    if (ctx.session?.variables?.[variableName] !== undefined) {
      return ctx.session.variables[variableName];
    }

    // Получаем из контекста Grammy
    switch (variableName) {
      case 'userId':
        return ctx.from?.id;
      case 'userName':
        return ctx.from?.username;
      case 'firstName':
        return ctx.from?.first_name;
      case 'lastName':
        return ctx.from?.last_name;
      case 'messageText':
        return ctx.message?.text;
      case 'messageId':
        return ctx.message?.message_id;
      case 'chatId':
        return ctx.chat?.id;
      case 'currentHour':
        return new Date().getHours();
      case 'currentDay':
        return new Date().getDate();
      case 'currentMonth':
        return new Date().getMonth() + 1;
      case 'currentYear':
        return new Date().getFullYear();
      default:
        return undefined;
    }
  }

  /**
   * Установка значения переменной в сессии
   */
  protected setVariableValue(
    ctx: BotConstructorContext,
    variableName: string,
    value: any
  ): void {
    if (!ctx.session) return;

    ctx.session.variables = ctx.session.variables || {};
    ctx.session.variables[variableName] = value;
  }

  /**
   * Поиск следующей ноды по соединениям
   */
  protected findNextNodeId(
    flow: BotFlow,
    currentNodeId: string,
    condition?: string
  ): string | undefined {
    const connections = flow.connections.filter(
      (c) => c.sourceNodeId === currentNodeId
    );

    if (condition) {
      // Ищем соединение по условию
      const conditionalConnection = connections.find(
        (c) => c.type === condition
      );
      if (conditionalConnection) {
        return conditionalConnection.targetNodeId;
      }
    }

    // Возвращаем первое доступное соединение
    return connections[0]?.targetNodeId;
  }

  /**
   * Валидация конфигурации ноды
   */
  protected validateNodeConfig(
    node: any,
    requiredFields: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    requiredFields.forEach((field) => {
      const value = this.getNestedValue(node.data?.config, field);
      if (value === undefined || value === null || value === '') {
        errors.push(`Поле "${field}" обязательно для заполнения`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Получение вложенного значения из объекта
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
