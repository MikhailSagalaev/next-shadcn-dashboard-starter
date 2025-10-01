/**
 * @file: src/lib/services/bot-flow-executor/flow-executor.ts
 * @description: Основной исполнитель потоков бота с интеграцией Grammy
 * @project: SaaS Bonus System
 * @dependencies: Grammy, BotFlowService, Node handlers
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Bot, Context, SessionFlavor } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { router } from '@grammyjs/router';
import { logger } from '@/lib/logger';
import { BotFlowService } from '../bot-flow.service';
import {
  BotSessionService,
  BotConstructorSession
} from '../bot-session.service';

import type { BotFlow, BotSession, NodeType } from '@/types/bot-constructor';

// Расширенный контекст для конструктора
type BotConstructorContext = Context & SessionFlavor<BotConstructorSession>;

export class FlowExecutor {
  private bot: Bot<BotConstructorContext>;
  private projectId: string;
  private activeFlows: Map<string, BotFlow> = new Map();
  private nodeHandlers: Map<NodeType, NodeHandler> = new Map();

  constructor(bot: Bot<BotConstructorContext>, projectId: string) {
    this.bot = bot;
    this.projectId = projectId;
    this.initializeNodeHandlers();
  }

  /**
   * Инициализация обработчиков нод
   */
  private initializeNodeHandlers(): void {
    // Импорт всех обработчиков нод
    const handlers = {
      start: this.handleStartNode.bind(this),
      message: this.handleMessageNode.bind(this),
      command: this.handleCommandNode.bind(this),
      callback: this.handleCallbackNode.bind(this),
      input: this.handleInputNode.bind(this),
      condition: this.handleConditionNode.bind(this),
      action: this.handleActionNode.bind(this),
      middleware: this.handleMiddlewareNode.bind(this),
      session: this.handleSessionNode.bind(this),
      end: this.handleEndNode.bind(this)
    };

    Object.entries(handlers).forEach(([type, handler]) => {
      this.nodeHandlers.set(type as NodeType, handler);
    });
  }

  /**
   * Запуск потока для пользователя
   */
  async startFlow(ctx: BotConstructorContext, flowId: string): Promise<void> {
    try {
      // Получаем поток
      const flow = await BotFlowService.getFlowById(flowId);
      if (!flow || flow.projectId !== this.projectId || !flow.isActive) {
        logger.warn('Flow not found or inactive', {
          flowId,
          projectId: this.projectId
        });
        return;
      }

      // Валидируем поток
      const validation = BotFlowService.validateFlow(
        flow.nodes,
        flow.connections
      );
      if (!validation.isValid) {
        logger.error('Flow validation failed', {
          flowId,
          errors: validation.errors
        });
        return;
      }

      // Компилируем поток
      const compilation = BotFlowService.compileFlow(flow);
      if (!compilation.success) {
        logger.error('Flow compilation failed', {
          flowId,
          errors: compilation.errors
        });
        return;
      }

      // Сохраняем активный поток
      this.activeFlows.set(flowId, flow);

      // Запускаем поток для пользователя
      await BotSessionService.startUserFlow(
        ctx,
        flowId,
        compilation.executableFlow?.entryPoints[0]
      );

      // Выполняем стартовую ноду
      if (compilation.executableFlow?.entryPoints[0]) {
        await this.executeNode(
          ctx,
          flowId,
          compilation.executableFlow.entryPoints[0]
        );
      }

      logger.info('Flow started successfully', {
        flowId,
        userId: ctx.from?.id,
        projectId: this.projectId
      });
    } catch (error) {
      logger.error('Failed to start flow', {
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId: this.projectId
      });
    }
  }

  /**
   * Выполнение ноды потока
   */
  async executeNode(
    ctx: BotConstructorContext,
    flowId: string,
    nodeId: string
  ): Promise<void> {
    try {
      const flow = this.activeFlows.get(flowId);
      if (!flow) {
        logger.warn('Flow not found in active flows', { flowId });
        return;
      }

      const node = flow.nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.warn('Node not found in flow', { flowId, nodeId });
        return;
      }

      const handler = this.nodeHandlers.get(node.type);
      if (!handler) {
        logger.error('No handler found for node type', {
          nodeType: node.type,
          nodeId
        });
        return;
      }

      // Выполняем ноду
      const result = await handler(ctx, flow, node);

      // Обрабатываем результат
      if (result.nextNodeId) {
        // Переходим к следующей ноде
        await this.executeNode(ctx, flowId, result.nextNodeId);
      } else if (result.endFlow) {
        // Завершаем поток
        await this.endFlow(ctx, flowId);
      }

      logger.info('Node executed successfully', {
        flowId,
        nodeId,
        nodeType: node.type,
        nextNodeId: result.nextNodeId,
        endFlow: result.endFlow
      });
    } catch (error) {
      logger.error('Failed to execute node', {
        flowId,
        nodeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Обработка ошибки - переход к fallback ноде или завершение
      await this.handleNodeError(ctx, flowId, nodeId, error);
    }
  }

  /**
   * Завершение потока
   */
  async endFlow(ctx: BotConstructorContext, flowId: string): Promise<void> {
    try {
      await BotSessionService.endUserFlow(ctx);

      this.activeFlows.delete(flowId);

      logger.info('Flow ended successfully', {
        flowId,
        userId: ctx.from?.id,
        projectId: this.projectId
      });
    } catch (error) {
      logger.error('Failed to end flow', {
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Обработка ошибок выполнения ноды
   */
  private async handleNodeError(
    ctx: BotConstructorContext,
    flowId: string,
    nodeId: string,
    error: unknown
  ): Promise<void> {
    try {
      // Логируем ошибку
      logger.error('Node execution error', {
        flowId,
        nodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: ctx.from?.id
      });

      // Отправляем пользователю сообщение об ошибке
      await ctx.reply('❌ Произошла ошибка. Попробуйте начать заново.');

      // Завершаем поток
      await this.endFlow(ctx, flowId);
    } catch (fallbackError) {
      logger.error('Failed to handle node error', {
        flowId,
        nodeId,
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown error'
      });
    }
  }

  // ============ ОБРАБОТЧИКИ НОД ============

  private async handleStartNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    // Стартовая нода просто переходит к следующей
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleMessageNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    const config = node.data.config.message;
    if (!config?.text) {
      throw new Error('Message node has no text configured');
    }

    // Отправляем сообщение
    const messageOptions: any = {
      parse_mode: config.parseMode || 'Markdown'
    };

    // Добавляем клавиатуру если настроена
    if (config.keyboard?.buttons && config.keyboard.buttons.length > 0) {
      if (config.keyboard.type === 'inline') {
        messageOptions.reply_markup = {
          inline_keyboard: config.keyboard.buttons
        };
      } else {
        messageOptions.reply_markup = {
          keyboard: config.keyboard.buttons,
          resize_keyboard: config.keyboard.resizeKeyboard,
          one_time_keyboard: config.keyboard.oneTimeKeyboard,
          selective: config.keyboard.selective
        };
      }
    }

    // Отправляем сообщение
    await ctx.reply(config.text, messageOptions);

    // Опции сообщения
    if (config.disablePreview) {
      // Отключаем превью ссылок
    }
    if (config.protectContent) {
      // Защищаем контент
    }

    // Переходим к следующей ноде
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleCommandNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    // Команды обрабатываются через Grammy router
    // Здесь просто логика перехода
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleCallbackNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    // Callback'и обрабатываются отдельно
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleInputNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    const config = node.data.config.input;

    // Отправляем запрос на ввод
    if (config?.prompt) {
      await ctx.reply(config.prompt);
    }

    // Устанавливаем таймаут если указан
    if (config?.timeout) {
      setTimeout(async () => {
        if (ctx.session?.currentFlowId === flow.id) {
          await ctx.reply('⏰ Время ожидания истекло.');
          await this.endFlow(ctx, flow.id);
        }
      }, config.timeout * 1000);
    }

    // Ожидаем ввода от пользователя (через conversation)
    return { waitForInput: true };
  }

  private async handleConditionNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    const config = node.data.config.condition;
    if (!config) {
      throw new Error('Condition node has no configuration');
    }

    // Получаем значение переменной
    const variableValue = this.getVariableValue(ctx, config.variable);

    // Выполняем сравнение
    const conditionMet = this.evaluateCondition(
      variableValue,
      config.operator,
      config.value
    );

    // Определяем следующую ноду
    const nextNodeId = conditionMet ? config.trueNodeId : config.falseNodeId;

    return { nextNodeId };
  }

  private async handleActionNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    const config = node.data.config.action;
    if (!config) {
      throw new Error('Action node has no configuration');
    }

    // Выполняем действие в зависимости от типа
    switch (config.type) {
      case 'grammy_api':
        await this.executeGrammyAction(ctx, config);
        break;
      case 'external_api':
        await this.executeExternalApiAction(ctx, config);
        break;
      case 'database':
        await this.executeDatabaseAction(ctx, config);
        break;
      case 'variable':
        this.executeVariableAction(ctx, config);
        break;
      case 'notification':
        await this.executeNotificationAction(ctx, config);
        break;
      default:
        logger.warn('Unknown action type', { actionType: config.type });
    }

    // Переходим к следующей ноде
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleMiddlewareNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    // Middleware обрабатывается на уровне Grammy
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleSessionNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    const config = node.data.config.session;
    if (!config) {
      throw new Error('Session node has no configuration');
    }

    // Выполняем операцию с сессией
    switch (config.operation) {
      case 'set':
        BotSessionService.setSessionVariable(ctx, config.key, config.value);
        break;
      case 'get':
        const value = BotSessionService.getSessionVariable(ctx, config.key);
        if (config.variableName) {
          BotSessionService.setSessionVariable(ctx, config.variableName, value);
        }
        break;
      case 'delete':
        // Удаление переменной (расширение BotSessionService)
        break;
      case 'increment':
        const currentValue =
          BotSessionService.getSessionVariable(ctx, config.key) || 0;
        BotSessionService.setSessionVariable(ctx, config.key, currentValue + 1);
        break;
      case 'decrement':
        const currentDecValue =
          BotSessionService.getSessionVariable(ctx, config.key) || 0;
        BotSessionService.setSessionVariable(
          ctx,
          config.key,
          currentDecValue - 1
        );
        break;
    }

    // Переходим к следующей ноде
    const outgoingConnections = flow.connections.filter(
      (c) => c.sourceNodeId === node.id
    );
    const nextNodeId = outgoingConnections[0]?.targetNodeId;

    return { nextNodeId };
  }

  private async handleEndNode(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    // Конечная нода завершает поток
    return { endFlow: true };
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

  private getVariableValue(
    ctx: BotConstructorContext,
    variableName: string
  ): any {
    // Получаем значение переменной из сессии или контекста
    const sessionValue = BotSessionService.getSessionVariable(
      ctx,
      variableName
    );
    if (sessionValue !== undefined) return sessionValue;

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

  private evaluateCondition(
    value: any,
    operator: string,
    compareValue: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return value == compareValue; // loose equality
      case 'not_equals':
        return value != compareValue;
      case 'contains':
        return String(value).includes(String(compareValue));
      case 'not_contains':
        return !String(value).includes(String(compareValue));
      case 'greater':
        return Number(value) > Number(compareValue);
      case 'less':
        return Number(value) < Number(compareValue);
      case 'greater_equal':
        return Number(value) >= Number(compareValue);
      case 'less_equal':
        return Number(value) <= Number(compareValue);
      case 'regex':
        try {
          return new RegExp(compareValue).test(String(value));
        } catch {
          return false;
        }
      case 'in_array':
        return Array.isArray(compareValue) && compareValue.includes(value);
      case 'is_empty':
        return !value || String(value).trim() === '';
      case 'is_not_empty':
        return value && String(value).trim() !== '';
      default:
        return false;
    }
  }

  private async executeGrammyAction(
    ctx: BotConstructorContext,
    config: any
  ): Promise<void> {
    // Выполнение Grammy API действий
    if (config.grammyMethod && config.grammyParams) {
      try {
        const method = config.grammyMethod;
        const params = config.grammyParams;

        // Динамический вызов метода Grammy
        if (method.startsWith('ctx.api.')) {
          const apiMethod = method.replace('ctx.api.', '');
          await (ctx.api as any)[apiMethod](params);
        } else if (method.startsWith('ctx.')) {
          const ctxMethod = method.replace('ctx.', '');
          await (ctx as any)[ctxMethod](params);
        }
      } catch (error) {
        logger.error('Failed to execute Grammy action', { error, config });
        throw error;
      }
    }
  }

  private async executeExternalApiAction(
    ctx: BotConstructorContext,
    config: any
  ): Promise<void> {
    // Выполнение внешних API вызовов
    if (config.url && config.method) {
      try {
        const response = await fetch(config.url, {
          method: config.method,
          headers: config.headers || {},
          body:
            config.method !== 'GET' ? JSON.stringify(config.body) : undefined
        });

        const result = await response.json();

        // Сохраняем результат в переменную если указано
        if (config.resultMapping && config.resultMapping.variable) {
          BotSessionService.setSessionVariable(
            ctx,
            config.resultMapping.variable,
            result
          );
        }
      } catch (error) {
        logger.error('Failed to execute external API action', {
          error,
          config
        });
        throw error;
      }
    }
  }

  private async executeDatabaseAction(
    ctx: BotConstructorContext,
    config: any
  ): Promise<void> {
    // Выполнение запросов к базе данных
    // Реализация зависит от конкретных требований
    logger.info('Database action execution (placeholder)', { config });
  }

  private executeVariableAction(ctx: BotConstructorContext, config: any): void {
    // Работа с переменными
    if (config.variableName && config.variableValue !== undefined) {
      BotSessionService.setSessionVariable(
        ctx,
        config.variableName,
        config.variableValue
      );
    }
  }

  private async executeNotificationAction(
    ctx: BotConstructorContext,
    config: any
  ): Promise<void> {
    // Отправка уведомлений
    logger.info('Notification action execution (placeholder)', { config });
  }
}

// Типы для результатов выполнения нод
interface NodeExecutionResult {
  nextNodeId?: string;
  endFlow?: boolean;
  waitForInput?: boolean;
  error?: string;
}

// Тип для обработчиков нод
type NodeHandler = (
  ctx: BotConstructorContext,
  flow: BotFlow,
  node: any
) => Promise<NodeExecutionResult>;
