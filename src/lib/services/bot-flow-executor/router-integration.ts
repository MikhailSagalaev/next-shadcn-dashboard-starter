/**
 * @file: src/lib/services/bot-flow-executor/router-integration.ts
 * @description: Интеграция с Grammy Router для маршрутизации команд
 * @project: SaaS Bonus System
 * @dependencies: Grammy Router, FlowExecutor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Composer, Context } from 'grammy';
import { logger } from '@/lib/logger';
import { FlowExecutor } from './flow-executor';

import type { BotConstructorSession } from '../bot-session.service';

// Временные заглушки для Grammy Router
type SessionFlavor<T> = {
  session: T;
};

// Расширенный контекст
type BotConstructorContext = Context & SessionFlavor<BotConstructorSession>;

// Заглушка для router
const router = (routes: Record<string, any>) => ({
  route:
    (key: string | ((ctx: any) => string | number | symbol)) =>
    (ctx: any) => {},
  otherwise: (handler: any) => (ctx: any) => {}
});

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
    const route = router((ctx) => {
      const update = ctx.update;

      if (update.message) {
        const message = update.message;

        // Контакт
        if (message.contact) {
          return 'contact';
        }

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
    this.composer.use(
      route.route((ctx) => {
        const update = ctx.update;
        if (update.message?.contact) return 'contact';
        if (update.message?.text?.startsWith('/')) return 'command';
        if (update.message?.text) return 'text';
        if (update.callback_query) return 'callback';
        if (update.message) return 'other_message';
        if (update.inline_query) return 'inline';
        return 'unknown';
      })
    );

    // Обработка контактов
    this.composer.route((ctx) => 'contact', this.handleContact.bind(this));

    // Обработка команд
    this.composer.route((ctx) => 'command', this.handleCommand.bind(this));

    // Обработка текстовых сообщений
    this.composer.route((ctx) => 'text', this.handleTextMessage.bind(this));

    // Обработка callback'ов
    this.composer.route((ctx) => 'callback', this.handleCallback.bind(this));

    // Обработка других типов
    this.composer.route(
      (ctx) => 'other_message',
      this.handleOtherMessage.bind(this)
    );
    this.composer.route((ctx) => 'inline', this.handleInlineQuery.bind(this));
    this.composer.route((ctx) => 'unknown', this.handleUnknown.bind(this));
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

    // ✨ НОВОЕ: Проверяем, ждёт ли workflow ввод пользователя
    const telegramUserId = ctx.from?.id?.toString();
    if (telegramUserId) {
      const resumed = await this.checkAndResumeWaitingWorkflow(
        ctx,
        'input',
        text
      );
      if (resumed) {
        return; // Workflow возобновлён, дальше не обрабатываем
      }
    }

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

    logger.info('🔵 CALLBACK RECEIVED', {
      callbackData,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      projectId: this.projectId,
      timestamp: new Date().toISOString()
    });

    // Отвечаем на callback
    await ctx.answerCallbackQuery();

    // ✨ НОВОЕ: Проверяем, ждёт ли workflow callback
    const telegramUserId = ctx.from?.id?.toString();
    if (telegramUserId) {
      logger.info('🔍 CHECKING FOR WAITING WORKFLOW', {
        telegramUserId,
        callbackData,
        chatId: ctx.chat?.id
      });

      const resumed = await this.checkAndResumeWaitingWorkflow(
        ctx,
        'callback',
        callbackData
      );

      logger.info(
        resumed ? '✅ WORKFLOW RESUMED' : '❌ NO WAITING WORKFLOW FOUND',
        {
          callbackData,
          resumed
        }
      );

      if (resumed) {
        return; // Workflow возобновлён
      }
    }

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
   * Обработка контактов
   * Возобновляет workflow execution, который ожидает контакт
   */
  private async handleContact(ctx: BotConstructorContext): Promise<void> {
    const contact = ctx.message?.contact;
    const telegramUserId = ctx.from?.id?.toString();

    if (!contact || !telegramUserId) {
      logger.warn('Contact or user ID missing', {
        hasContact: !!contact,
        hasTelegramUserId: !!telegramUserId
      });
      return;
    }

    logger.info('Contact received', {
      phoneNumber: contact.phone_number,
      firstName: contact.first_name,
      userId: contact.user_id,
      telegramUserId,
      projectId: this.projectId
    });

    // ✨ НОВОЕ: Используем универсальный метод возобновления
    await this.checkAndResumeWaitingWorkflow(ctx, 'contact', contact);
  }

  /**
   * ✨ НОВОЕ: Универсальный метод для проверки и возобновления waiting workflow
   * Обрабатывает все типы ожидания: contact, callback, input
   */
  private async checkAndResumeWaitingWorkflow(
    ctx: BotConstructorContext,
    waitType: 'contact' | 'callback' | 'input',
    data: any
  ): Promise<boolean> {
    const telegramUserId = ctx.from?.id?.toString();

    if (!telegramUserId) {
      return false;
    }

    try {
      // Импортируем здесь чтобы избежать circular dependencies
      const { db } = await import('@/lib/db');
      const { SimpleWorkflowProcessor } = await import(
        '../simple-workflow-processor'
      );

      // Ищем workflow execution в состоянии waiting
      // ✅ КРИТИЧНО: Для callback query chat находится в callbackQuery.message.chat
      const chatId = (
        ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id
      )?.toString();

      logger.info('🔎 SEARCHING FOR WAITING EXECUTION', {
        projectId: this.projectId,
        status: 'waiting',
        telegramChatId: chatId,
        waitType,
        hasChat: !!ctx.chat,
        hasCallbackChat: !!ctx.callbackQuery?.message?.chat,
        timestamp: new Date().toISOString()
      });

      const waitingExecution = await db.workflowExecution.findFirst({
        where: {
          projectId: this.projectId,
          status: 'waiting',
          telegramChatId: chatId,
          waitType:
            waitType === 'input'
              ? ({ in: ['input', 'contact'] } as any)
              : waitType
        },
        include: {
          workflow: true
        }
      });

      if (!waitingExecution) {
        logger.warn('⚠️ NO WAITING EXECUTION FOUND', {
          projectId: this.projectId,
          telegramChatId: chatId,
          waitType,
          hasChat: !!ctx.chat,
          hasCallbackChat: !!ctx.callbackQuery?.message?.chat
        });
        return false; // Нет waiting workflow
      }

      logger.info('✅ FOUND WAITING WORKFLOW EXECUTION', {
        executionId: waitingExecution.id,
        workflowId: waitingExecution.workflowId,
        currentNodeId: waitingExecution.currentNodeId,
        status: waitingExecution.status,
        waitType: waitingExecution.waitType,
        timestamp: new Date().toISOString()
      });

      // Обрабатываем данные в зависимости от типа ожидания
      let userId: string | undefined;
      let userData: any = {};

      if (waitType === 'contact') {
        const contact = data;
        const raw = contact.phone_number;

        // Используем функцию normalizePhone для получения нормализованного номера (как в БД)
        const { normalizePhone } = await import('@/lib/phone');
        const normalized = normalizePhone(raw);

        // Создаем все возможные варианты для поиска
        const candidates = new Set<string>();

        // Добавляем нормализованный вариант (основной, как сохранен в БД)
        if (normalized) {
          candidates.add(normalized);
        }

        // Добавляем исходный номер (на случай, если он сохранен с пробелами)
        candidates.add(raw);

        // Извлекаем только цифры
        const digits = raw.replace(/[^0-9]/g, '');

        // Добавляем варианты с цифрами
        if (digits) {
          candidates.add(digits);

          // Для РФ номеров добавляем все варианты
          if (digits.length === 11) {
            if (digits.startsWith('8')) {
              // 8XXXXXXXXXX → +7XXXXXXXXXX
              candidates.add('+7' + digits.slice(1));
              candidates.add('7' + digits.slice(1));
              candidates.add('8' + digits.slice(1));
            } else if (digits.startsWith('7')) {
              // 7XXXXXXXXXX → +7XXXXXXXXXX
              candidates.add('+7' + digits.slice(1));
              candidates.add('7' + digits.slice(1));
              candidates.add('8' + digits.slice(1));
            }
          } else if (digits.length === 10) {
            // 10 цифр → +7XXXXXXXXXX
            candidates.add('+7' + digits);
            candidates.add('7' + digits);
            candidates.add('8' + digits);
          }

          // Варианты с пробелами (на случай, если в БД сохранен с форматированием)
          if (digits.length === 11 && digits.startsWith('7')) {
            const formatted = `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
            candidates.add(formatted);
          } else if (digits.length === 11 && digits.startsWith('8')) {
            const formatted = `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
            candidates.add(formatted);
          } else if (digits.length === 10) {
            const formatted = `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
            candidates.add(formatted);
          }
        }

        logger.info('📞 Contact received, normalized candidates', {
          raw,
          normalized,
          digitsOnly: digits,
          candidates: Array.from(candidates),
          projectId: this.projectId
        });

        // Используем UserService.findUserByContact для поиска (он уже имеет всю логику)
        const { UserService } = await import('@/lib/services/user.service');
        const existing = await UserService.findUserByContact(
          this.projectId,
          undefined,
          raw
        );

        // Если не нашли через UserService, проверяем по telegramId
        let userByTelegram = null;
        if (!existing) {
          const { db } = await import('@/lib/db');
          userByTelegram = await db.user.findFirst({
            where: {
              projectId: this.projectId,
              telegramId: BigInt(telegramUserId)
            }
          });
        }

        const existingUser = existing || userByTelegram;

        logger.info('🔍 User search result in router-integration', {
          found: !!existingUser,
          userIdInDB: existingUser?.id,
          phoneInDB: existingUser?.phone,
          phoneNormalized: normalized,
          telegramIdInDB: existingUser?.telegramId?.toString(),
          searchedCandidates: Array.from(candidates),
          searchMethod: existing ? 'findUserByContact' : 'telegramId'
        });

        if (existingUser) {
          const { db } = await import('@/lib/db');
          await db.user.update({
            where: { id: existingUser.id },
            data: {
              telegramId: BigInt(telegramUserId),
              telegramUsername: ctx.from?.username,
              isActive: true
            }
          });
          // Если реферер был отложен до подтверждения контакта (см.
          // createUser/pendingReferralMetadata) — резолвим его сейчас,
          // когда у пользователя уже точно есть telegramId для уведомлений.
          await UserService.resolvePendingReferralOnActivation(existingUser.id);
          logger.info('✅ Matched and updated existing user', {
            userId: existingUser.id,
            phoneInDB: existingUser.phone,
            phoneNormalized: normalized,
            newTelegramId: telegramUserId
          });
          userId = existingUser.id;
        } else {
          logger.warn('❌ User not found by phone', {
            rawPhone: raw,
            normalizedPhone: normalized,
            candidates: Array.from(candidates),
            projectId: this.projectId
          });
        }
        userData = {
          contactReceived: {
            phoneNumber: contact.phone_number,
            firstName: contact.first_name,
            lastName: contact.last_name,
            userId: userId,
            receivedAt: new Date().toISOString()
          }
        };
      } else if (waitType === 'callback') {
        userData = {
          callbackReceived: { data, receivedAt: new Date().toISOString() }
        };
      } else if (waitType === 'input') {
        userData = {
          inputReceived: { text: data, receivedAt: new Date().toISOString() }
        };
      }

      // Обновляем execution: устанавливаем status = 'running'
      await db.workflowExecution.update({
        where: { id: waitingExecution.id },
        data: {
          status: 'running',
          waitType: null,
          userId: userId || waitingExecution.userId || undefined
        }
      });

      // ✅ ИНВАЛИДИРУЕМ КЕШ WAITING EXECUTION
      try {
        const { WorkflowRuntimeService } = await import(
          '../workflow-runtime.service'
        );
        await WorkflowRuntimeService.invalidateWaitingExecutionCache(
          this.projectId,
          chatId,
          waitType
        );
      } catch (cacheError) {
        console.warn(
          'Failed to invalidate waiting execution cache:',
          cacheError
        );
      }

      // ✨ ИСПРАВЛЕНО: Определяем nextNodeId в зависимости от типа ожидания
      let nextNodeId: string;

      if (waitType === 'contact') {
        // ✅ ИСПРАВЛЕНО: Для контактов используем currentNodeId и идём по connections
        // Это позволяет правильно обрабатывать контакт на этапе request-phone
        // вместо перехода к глобальному check-contact-user
        nextNodeId = waitingExecution.currentNodeId || 'start-trigger';
        logger.info('📞 Contact received during waiting execution', {
          currentNodeId: waitingExecution.currentNodeId,
          nextNodeId,
          executionId: waitingExecution.id
        });
      } else if (waitType === 'callback') {
        // ✨ ДЛЯ CALLBACK: Ищем trigger.callback ноду с соответствующим callbackData
        const callbackData = data;

        // Получаем все ноды workflow
        const workflowNodes = waitingExecution.workflow.nodes as any[];

        // Ищем trigger.callback ноду с matching callbackData
        const callbackTriggerNode = workflowNodes.find(
          (node: any) =>
            node.type === 'trigger.callback' &&
            node.data?.config?.callbackData === callbackData
        );

        if (callbackTriggerNode) {
          nextNodeId = callbackTriggerNode.id;
          logger.info('✅ Found matching callback trigger node', {
            callbackData,
            triggerNodeId: nextNodeId,
            triggerLabel: callbackTriggerNode.data?.label
          });
        } else {
          logger.warn(
            '⚠️ No matching callback trigger found, using current node',
            {
              callbackData,
              availableTriggers: workflowNodes
                .filter((n: any) => n.type === 'trigger.callback')
                .map((n: any) => ({
                  id: n.id,
                  callbackData: n.data?.config?.callbackData
                }))
            }
          );
          // Fallback к текущей ноде
          nextNodeId = waitingExecution.currentNodeId || 'start-trigger';
        }
      } else {
        // Для input используем текущую ноду
        nextNodeId = waitingExecution.currentNodeId || 'start-trigger';
      }

      logger.info('🚀 RESUMING WORKFLOW', {
        nextNodeId,
        currentNodeId: waitingExecution.currentNodeId,
        waitType,
        executionId: waitingExecution.id,
        workflowId: waitingExecution.workflowId,
        callbackData: waitType === 'callback' ? data : undefined
      });

      // Получаем нужную версию workflow для возобновления
      const { ExecutionContextManager } = await import(
        '../workflow/execution-context-manager'
      );
      const workflowVersion = await db.workflowVersion.findFirst({
        where: {
          workflowId: waitingExecution.workflowId,
          version: waitingExecution.version
        }
      });

      if (!workflowVersion) {
        logger.error('Workflow version not found for execution', {
          workflowId: waitingExecution.workflowId,
          version: waitingExecution.version
        });
        await ctx.reply('❌ Ошибка сценария: версия workflow не найдена.');
        return false;
      }

      const context = await ExecutionContextManager.resumeContext(
        waitingExecution.id,
        chatId,
        telegramUserId,
        ctx.from?.username,
        waitType === 'input' ? data : undefined,
        waitType === 'callback' ? data : undefined
      );

      // Пробрасываем контакт в контекст для {{telegram.contact.phoneNumber}}
      if (waitType === 'contact' && data) {
        (context as any).telegram.contact = {
          phoneNumber: data.phone_number,
          firstName: data.first_name,
          lastName: data.last_name,
          userId: data.user_id
        };

        // ✅ ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ: Проверяем параметры
        logger.info('🔍 checkAndResumeWaitingWorkflow parameters', {
          waitType,
          hasData: !!data,
          dataType: typeof data,
          dataKeys: data ? Object.keys(data) : 'no data',
          executionId: waitingExecution.id
        });

        // ✨ ВАЖНО: Сохраняем contactReceived как workflow-переменную для использования в {{contactReceived.phoneNumber}}
        (context as any).contactReceived = {
          phoneNumber: data.phone_number,
          firstName: data.first_name,
          lastName: data.last_name,
          userId: userId,
          receivedAt: new Date().toISOString()
        };

        // ✨ КРИТИЧНО: Сохраняем contactReceived в workflow_variables для доступа в нодах
        const contactReceivedData = {
          phoneNumber: data.phone_number,
          firstName: data.first_name,
          lastName: data.last_name,
          userId: userId,
          receivedAt: new Date().toISOString()
        };

        logger.info('💾 Saving contactReceived to workflow variables', {
          executionId: waitingExecution.id,
          contactReceivedData,
          userId
        });

        // ✅ КРИТИЧНО: Сохраняем contactReceived в workflow_variables с явным указанием scope 'session'
        // ВАЖНО: Сохраняем ДО запуска workflow, чтобы переменные были доступны
        await context.variables.set(
          'contactReceived',
          contactReceivedData,
          'session'
        );

        // ✅ КРИТИЧНО: Сохраняем projectId в workflow_variables
        await context.variables.set('projectId', this.projectId, 'session');

        // ✅ ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ: Проверяем, что переменные действительно сохранились
        const savedContactReceived = await context.variables.get(
          'contactReceived',
          'session'
        );
        const savedProjectId = await context.variables.get(
          'projectId',
          'session'
        );

        logger.info(
          '✅ contactReceived and projectId saved to workflow variables',
          {
            executionId: waitingExecution.id,
            projectId: this.projectId,
            savedContactReceived: savedContactReceived ? 'SAVED' : 'NOT SAVED',
            savedProjectId: savedProjectId ? 'SAVED' : 'NOT SAVED',
            contactReceivedData,
            savedContactReceivedData: savedContactReceived,
            projectIdValue: this.projectId
          }
        );

        // ✅ КРИТИЧНО: Проверяем, что переменная действительно доступна
        if (!savedContactReceived) {
          logger.error('❌ CRITICAL: contactReceived not saved to variables!', {
            executionId: waitingExecution.id,
            contactReceivedData,
            attempt: 'retry'
          });
          // Пробуем сохранить еще раз
          await context.variables.set(
            'contactReceived',
            contactReceivedData,
            'session'
          );
          const retryCheck = await context.variables.get(
            'contactReceived',
            'session'
          );
          logger.info('🔄 Retry save result', {
            saved: !!retryCheck,
            retryCheck
          });
        }
      } else if (waitType === 'callback' && data) {
        (context as any).callbackReceived = {
          data,
          receivedAt: new Date().toISOString()
        };

        // ✨ КРИТИЧНО: Сохраняем callbackReceived в workflow_variables
        await context.variables.set('callbackReceived', {
          data,
          receivedAt: new Date().toISOString()
        });
      } else if (waitType === 'input' && data) {
        (context as any).inputReceived = {
          text: data,
          receivedAt: new Date().toISOString()
        };

        // ✨ КРИТИЧНО: Сохраняем inputReceived в workflow_variables
        await context.variables.set('inputReceived', {
          text: data,
          receivedAt: new Date().toISOString()
        });
      }

      // Продолжаем выполнение workflow с существующим executionId
      const processor = new SimpleWorkflowProcessor(
        workflowVersion as any,
        this.projectId
      );

      // Используем resumeWorkflow для продолжения существующего execution
      await processor.resumeWorkflow(context, nextNodeId);

      logger.info('Workflow resumed successfully', {
        executionId: waitingExecution.id,
        waitType,
        nextNodeId
      });

      return true; // Workflow возобновлён
    } catch (error) {
      logger.error('Failed to resume waiting workflow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        telegramUserId,
        projectId: this.projectId,
        waitType
      });

      await ctx.reply(
        '❌ Произошла ошибка при обработке вашего ответа.\n' +
          'Пожалуйста, попробуйте позже или обратитесь к администратору.'
      );

      return false;
    }
  }

  /**
   * Определяет следующую ноду после waiting state
   */
  private getNextNodeAfterWaiting(
    workflow: any,
    currentNodeId: string | undefined | null
  ): string | null {
    if (!currentNodeId || !workflow.connections) {
      logger.warn(
        'getNextNodeAfterWaiting: missing currentNodeId or connections',
        {
          currentNodeId,
          hasConnections: !!workflow.connections
        }
      );
      return null;
    }

    const connections = workflow.connections as any[];
    logger.info('getNextNodeAfterWaiting: searching for connections', {
      currentNodeId,
      totalConnections: connections.length,
      allConnections: connections.map((c) => ({
        source: c.source,
        target: c.target
      }))
    });

    const nextConnection = connections.find(
      (conn: any) => conn.source === currentNodeId
    );

    logger.info('getNextNodeAfterWaiting: found connection', {
      currentNodeId,
      nextConnection: nextConnection
        ? { source: nextConnection.source, target: nextConnection.target }
        : null,
      nextNodeId: nextConnection?.target || null
    });

    return nextConnection?.target || null;
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
