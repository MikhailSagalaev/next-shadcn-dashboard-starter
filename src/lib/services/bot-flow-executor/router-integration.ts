/**
 * @file: src/lib/services/bot-flow-executor/router-integration.ts
 * @description: Интеграция с Grammy Router для маршрутизации команд
 * @project: SaaS Bonus System
 * @dependencies: Grammy Router, FlowExecutor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Composer, Context } from 'grammy';
// import { router } from '@grammyjs/router';
// import { SessionFlavor } from 'grammy';
import { logger } from '@/lib/logger';
import { FlowExecutor } from './flow-executor';

import type { BotConstructorSession } from '../bot-session.service';

// Расширенный контекст
type BotConstructorContext = Context & SessionFlavor<BotConstructorSession>;

export class RouterIntegration {
  private composer: Composer<BotConstructorContext>;
  private flowExecutor: FlowExecutor;
  private projectId: string;

  constructor(
    composer: Composer<BotConstructorContext>,
    flowExecutor: FlowExecutor,
    projectId: string
  ) {
    this.composer = composer;
    this.flowExecutor = flowExecutor;
    this.projectId = projectId;
    this.setupRouter();
  }

  /**
   * Настройка роутера для обработки команд и сообщений
   */
  private setupRouter(): void {
    // Создаем роутер на основе типа обновления
    const route = router<BotConstructorContext>((ctx) => {
      const update = ctx.update;

      if (update.message) {
        const message = update.message;

        // Команды
        if (message.text?.startsWith('/')) {
          return 'command';
        }

        // Текстовые сообщения
        if (message.text) {
          return 'text';
        }

        // Другие типы сообщений
        return 'other_message';
      }

      if (update.callback_query) {
        return 'callback';
      }

      if (update.inline_query) {
        return 'inline';
      }

      return 'unknown';
    });

    // Обработчики для разных типов обновлений
    this.composer.use(route);

    // Обработка команд
    this.composer.route('command', this.handleCommand.bind(this));

    // Обработка текстовых сообщений
    this.composer.route('text', this.handleTextMessage.bind(this));

    // Обработка callback'ов
    this.composer.route('callback', this.handleCallback.bind(this));

    // Обработка других типов
    this.composer.route('other_message', this.handleOtherMessage.bind(this));
    this.composer.route('inline', this.handleInlineQuery.bind(this));
    this.composer.route('unknown', this.handleUnknown.bind(this));
  }

  /**
   * Обработка команд
   */
  private async handleCommand(ctx: BotConstructorContext): Promise<void> {
    const command = ctx.message?.text?.split(' ')[0]?.replace('/', '') || '';
    const args = ctx.message?.text?.split(' ').slice(1) || [];

    logger.info('Command received', {
      command,
      args,
      userId: ctx.from?.id,
      projectId: this.projectId
    });

    try {
      // Проверяем, есть ли активный поток у пользователя
      if (ctx.session?.currentFlowId) {
        // Если пользователь в потоке, передаем команду в поток
        await this.handleFlowCommand(ctx, command, args);
        return;
      }

      // Обрабатываем команду как новую
      switch (command) {
        case 'start':
          await this.handleStartCommand(ctx, args);
          break;

        case 'help':
          await this.handleHelpCommand(ctx);
          break;

        case 'menu':
          await this.handleMenuCommand(ctx);
          break;

        case 'cancel':
          await this.handleCancelCommand(ctx);
          break;

        default:
          // Проверяем, есть ли поток с таким названием команды
          await this.tryStartFlowByCommand(ctx, command, args);
          break;
      }
    } catch (error) {
      logger.error('Command handling error', {
        command,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await ctx.reply(
        '❌ Произошла ошибка при обработке команды. Попробуйте еще раз.'
      );
    }
  }

  /**
   * Обработка текстовых сообщений
   */
  private async handleTextMessage(ctx: BotConstructorContext): Promise<void> {
    const text = ctx.message?.text || '';

    logger.info('Text message received', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      userId: ctx.from?.id,
      projectId: this.projectId
    });

    // Проверяем, находится ли пользователь в активном потоке
    if (ctx.session?.currentFlowId) {
      // Передаем сообщение в поток для обработки
      await this.handleFlowMessage(ctx, text);
      return;
    }

    // Обрабатываем как обычное сообщение
    await this.handleRegularMessage(ctx, text);
  }

  /**
   * Обработка callback'ов
   */
  private async handleCallback(ctx: BotConstructorContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';

    logger.info('Callback received', {
      callbackData,
      userId: ctx.from?.id,
      projectId: this.projectId
    });

    // Отвечаем на callback
    await ctx.answerCallbackQuery();

    // Проверяем, находится ли пользователь в активном потоке
    if (ctx.session?.currentFlowId) {
      await this.handleFlowCallback(ctx, callbackData);
      return;
    }

    // Обрабатываем callback как новую команду
    if (callbackData.startsWith('flow_')) {
      // Запуск потока по callback
      const flowId = callbackData.replace('flow_', '');
      await this.flowExecutor.startFlow(ctx, flowId);
    } else if (callbackData.startsWith('cmd_')) {
      // Выполнение команды по callback
      const command = callbackData.replace('cmd_', '');
      await this.handleCallbackCommand(ctx, command);
    } else {
      await ctx.reply('❓ Неизвестная команда. Используйте /help для справки.');
    }
  }

  /**
   * Обработка других типов сообщений
   */
  private async handleOtherMessage(ctx: BotConstructorContext): Promise<void> {
    // Обработка фото, документов, стикеров и т.д.
    const messageType = this.getMessageType(ctx);

    logger.info('Other message type received', {
      messageType,
      userId: ctx.from?.id,
      projectId: this.projectId
    });

    if (ctx.session?.currentFlowId) {
      // Передаем в поток для обработки
      await this.handleFlowOtherMessage(ctx, messageType);
    } else {
      await ctx.reply(
        '📎 Я понимаю только текстовые сообщения. Используйте /help для справки.'
      );
    }
  }

  /**
   * Обработка inline запросов
   */
  private async handleInlineQuery(ctx: BotConstructorContext): Promise<void> {
    // Обработка inline запросов (для будущих расширений)
    logger.info('Inline query received', {
      query: ctx.inlineQuery?.query,
      userId: ctx.from?.id,
      projectId: this.projectId
    });
  }

  /**
   * Обработка неизвестных обновлений
   */
  private async handleUnknown(ctx: BotConstructorContext): Promise<void> {
    logger.warn('Unknown update type received', {
      updateType: Object.keys(ctx.update)[0],
      userId: ctx.from?.id,
      projectId: this.projectId
    });
  }

  // ============ КОМАНДЫ ============

  private async handleStartCommand(
    ctx: BotConstructorContext,
    args: string[]
  ): Promise<void> {
    const welcomeMessage = `👋 Добро пожаловать!

🤖 Я ваш персональный помощник для работы с бонусами.

📋 Доступные команды:
/help - Показать справку
/menu - Главное меню
/bonuses - Проверить баланс

💡 Выберите нужную команду или просто напишите сообщение.`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Меню', callback_data: 'cmd_menu' }],
          [{ text: '💰 Бонусы', callback_data: 'cmd_bonuses' }],
          [{ text: '❓ Помощь', callback_data: 'cmd_help' }]
        ]
      }
    });
  }

  private async handleHelpCommand(ctx: BotConstructorContext): Promise<void> {
    const helpMessage = `📖 Справка по командам:

🤖 Основные команды:
/start - Запустить бота заново
/help - Показать эту справку
/menu - Открыть главное меню
/cancel - Отменить текущую операцию

💰 Работа с бонусами:
/bonuses - Проверить баланс бонусов
/profile - Просмотреть профиль

🔧 Техническая информация:
/cancel - Прервать любую операцию

💡 Просто напишите сообщение, и я постараюсь помочь!`;

    await ctx.reply(helpMessage);
  }

  private async handleMenuCommand(ctx: BotConstructorContext): Promise<void> {
    const menuMessage = `🏠 Главное меню

Выберите раздел:`;

    await ctx.reply(menuMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Мои бонусы', callback_data: 'cmd_bonuses' }],
          [{ text: '👤 Профиль', callback_data: 'cmd_profile' }],
          [{ text: '📊 Статистика', callback_data: 'cmd_stats' }],
          [{ text: '❓ Помощь', callback_data: 'cmd_help' }]
        ]
      }
    });
  }

  private async handleCancelCommand(ctx: BotConstructorContext): Promise<void> {
    if (ctx.session?.currentFlowId) {
      // Отменяем активный поток
      await this.flowExecutor.endFlow(ctx, ctx.session.currentFlowId);
      await ctx.reply('✅ Операция отменена.');
    } else {
      await ctx.reply('ℹ️ Нет активных операций для отмены.');
    }
  }

  // ============ ПОТОКИ ============

  private async handleFlowCommand(
    ctx: BotConstructorContext,
    command: string,
    args: string[]
  ): Promise<void> {
    // Передаем команду в активный поток
    const flowId = ctx.session?.currentFlowId;
    if (flowId) {
      // Можно расширить FlowExecutor для обработки команд в контексте потока
      logger.info('Flow command received', { flowId, command, args });
    }
  }

  private async handleFlowMessage(
    ctx: BotConstructorContext,
    text: string
  ): Promise<void> {
    // Передаем текстовое сообщение в активный поток
    const flowId = ctx.session?.currentFlowId;
    if (flowId) {
      // Сохраняем введенный текст в сессии для обработки в следующей ноде
      ctx.session.lastInput = text;

      // Можно автоматически переходить к следующей ноде в потоке
      // await this.flowExecutor.processInput(ctx, flowId, text);
      logger.info('Flow message received', {
        flowId,
        text: text.substring(0, 50)
      });
    }
  }

  private async handleFlowCallback(
    ctx: BotConstructorContext,
    callbackData: string
  ): Promise<void> {
    // Передаем callback в активный поток
    const flowId = ctx.session?.currentFlowId;
    if (flowId) {
      // Обработка callback'ов в контексте потока
      logger.info('Flow callback received', { flowId, callbackData });
    }
  }

  private async handleFlowOtherMessage(
    ctx: BotConstructorContext,
    messageType: string
  ): Promise<void> {
    // Обработка других типов сообщений в потоке
    const flowId = ctx.session?.currentFlowId;
    if (flowId) {
      logger.info('Flow other message received', { flowId, messageType });
    }
  }

  private async tryStartFlowByCommand(
    ctx: BotConstructorContext,
    command: string,
    args: string[]
  ): Promise<void> {
    // Пытаемся найти поток по названию команды
    // В будущем можно добавить таблицу сопоставления команд и потоков

    // Пока просто отвечаем, что команда не найдена
    await ctx.reply(
      `❓ Команда "/${command}" не найдена. Используйте /help для списка доступных команд.`
    );
  }

  private async handleRegularMessage(
    ctx: BotConstructorContext,
    text: string
  ): Promise<void> {
    // Обработка обычных текстовых сообщений
    // Можно добавить NLP или простые правила

    const lowerText = text.toLowerCase();

    if (
      lowerText.includes('привет') ||
      lowerText.includes('здравствуй') ||
      lowerText.includes('hi') ||
      lowerText.includes('hello')
    ) {
      await ctx.reply(
        '👋 Привет! Чем могу помочь? Используйте /menu для просмотра доступных функций.'
      );
    } else if (lowerText.includes('спасибо') || lowerText.includes('thank')) {
      await ctx.reply('🙂 Пожалуйста! Всегда рад помочь.');
    } else {
      await ctx.reply(
        '💭 Я получил ваше сообщение. Для работы с бонусами используйте команды из /menu или напишите "помощь".'
      );
    }
  }

  private async handleCallbackCommand(
    ctx: BotConstructorContext,
    command: string
  ): Promise<void> {
    switch (command) {
      case 'menu':
        await this.handleMenuCommand(ctx);
        break;
      case 'help':
        await this.handleHelpCommand(ctx);
        break;
      case 'bonuses':
        await ctx.reply(
          '💰 Для проверки баланса бонусов используйте команду /bonuses'
        );
        break;
      case 'profile':
        await ctx.reply(
          '👤 Для просмотра профиля используйте команду /profile'
        );
        break;
      case 'stats':
        await ctx.reply('📊 Статистика пока в разработке');
        break;
      default:
        await ctx.reply('❓ Неизвестная команда');
    }
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

  private getMessageType(ctx: BotConstructorContext): string {
    const message = ctx.message;
    if (!message) return 'unknown';

    if (message.photo) return 'photo';
    if (message.document) return 'document';
    if (message.sticker) return 'sticker';
    if (message.voice) return 'voice';
    if (message.video) return 'video';
    if (message.audio) return 'audio';
    if (message.location) return 'location';
    if (message.contact) return 'contact';

    return 'other';
  }

  /**
   * Создание composer с router
   */
  static createRouterComposer(
    flowExecutor: FlowExecutor,
    projectId: string
  ): Composer<BotConstructorContext> {
    const composer = new Composer<BotConstructorContext>();

    // Создаем экземпляр интеграции
    new RouterIntegration(composer, flowExecutor, projectId);

    return composer;
  }
}

// Расширения для сессии
declare module '../bot-session.service' {
  interface BotConstructorSession {
    lastInput?: string;
  }
}
