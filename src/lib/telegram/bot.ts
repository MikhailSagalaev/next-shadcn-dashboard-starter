/**
 * @file: src/lib/telegram/bot.ts
 * @description: Фабрика создания Telegram ботов с поддержкой Workflow
 * @project: SaaS Bonus System
 * @dependencies: Grammy, FlowExecutor, WorkflowRuntime
 * @created: 2025-01-12
 * @updated: 2025-10-12
 * @author: AI Assistant + User
 */

import { Bot, Context, SessionFlavor } from 'grammy';
import { logger } from '@/lib/logger';
import {
  BotSessionService,
  BotConstructorSession
} from '@/lib/services/bot-session.service';
import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';

// Интерфейс для сессии (расширен для конструктора)
type MyContext = Context & SessionFlavor<BotConstructorSession>;

/**
 * Создание экземпляра бота с поддержкой Workflow
 */
export function createBot(token: string, projectId: string, botSettings?: any) {
  logger.info(`🤖 СОЗДАНИЕ ЭКЗЕМПЛЯРА БОТА`, {
    projectId,
    token: '***' + token.slice(-4),
    botSettings: botSettings ? {
      botUsername: botSettings.botUsername,
      isActive: botSettings.isActive
    } : null,
    component: 'bot-factory'
  });

  const bot = new Bot<MyContext>(token);

  // Настраиваем базовые middleware
  bot.use(BotSessionService.createSessionMiddleware(projectId));
  bot.use(BotSessionService.createActivityMiddleware());
  bot.use(BotSessionService.createTimeoutMiddleware());

  // Диагностический middleware для логирования всех сообщений
  bot.use(async (ctx, next) => {
    const updateType = ctx.update.message
      ? 'message'
      : ctx.update.callback_query
        ? 'callback_query'
        : ctx.update.inline_query
          ? 'inline_query'
          : 'other';

    logger.info(`📨 Получено обновление от пользователя`, {
      fromId: ctx.from?.id,
      username: ctx.from?.username,
      updateType,
      updateId: ctx.update.update_id,
      projectId,
      component: 'telegram-bot'
    });

    await next();
  });

  // Middleware для обработки через Workflow
  bot.use(async (ctx, next) => {
    try {
      // Получаем projectId из сессии
      const projectId = ctx.session?.projectId;
      if (!projectId) {
        logger.debug('Нет projectId в сессии, пропускаем workflow обработку', { session: ctx.session });
        await next();
        return;
      }

      // Определяем тип триггера
      let trigger: 'start' | 'message' | 'callback' = 'message';
      if (ctx.message?.text?.startsWith('/start')) {
        trigger = 'start';
      } else if (ctx.callbackQuery) {
        trigger = 'callback';
      }

      logger.info('🔍 Проверка наличия активного workflow', { trigger, projectId, userId: ctx.from?.id });

      // Проверяем наличие активного workflow ДО выполнения
      const hasActiveWorkflow = await WorkflowRuntimeService.hasActiveWorkflow(projectId);
      
      if (!hasActiveWorkflow) {
        logger.debug('❌ Активный workflow не найден, используем fallback', {
          projectId,
          trigger
        });
        // Только если workflow вообще не существует, идём к fallback
        await next();
        return;
      }

      // Выполняем workflow через новый сервис
      logger.info('🚀 Выполнение workflow', { trigger, projectId, userId: ctx.from?.id });
      const processed = await WorkflowRuntimeService.executeWorkflow(projectId, trigger, ctx);

      logger.info('📊 Результат выполнения workflow', { 
        processed, 
        projectId, 
        trigger,
        userId: ctx.from?.id 
      });

      // ✅ КРИТИЧНО: Всегда останавливаем middleware после попытки workflow
      // Даже если workflow вернул false (ошибка), НЕ вызываем fallback
      // Это предотвращает дублирование сообщений
      return;
      
    } catch (error) {
      logger.error('💥 Критическая ошибка при обработке workflow', {
        projectId: ctx.session?.projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // ✅ При критической ошибке тоже НЕ вызываем fallback
      // Workflow уже мог отправить сообщения
      return;
    }
  });

  // ==========================================
  // FALLBACK ОБРАБОТЧИКИ (если нет workflow)
  // ==========================================

  // Диагностическая команда для проверки работы бота
  bot.command('test', async (ctx) => {
    logger.info('Обработка команды /test (fallback)', { projectId });
    await ctx.reply('✅ Бот работает! Команда /test получена и обработана.\n\n⚠️ Активный workflow не найден, используется fallback режим.');
  });

  // Fallback для команды /start
  bot.command('start', async (ctx) => {
    logger.info('Обработка команды /start (fallback)', { projectId });
    
    await ctx.reply(
      '👋 Добро пожаловать!\n\n' +
      '⚠️ Для этого бота не настроен активный сценарий (workflow).\n\n' +
      '📝 Администратор должен:\n' +
      '1. Перейти в раздел "Шаблоны ботов"\n' +
      '2. Выбрать шаблон \n' +
      '3. Установить его для этого проекта\n' +
      '4. Активировать workflow\n\n' +
      '💡 После этого бот будет работать по настроенному сценарию.'
    );
  });

  // Fallback для всех остальных сообщений
  bot.on('message', async (ctx) => {
    logger.info('Обработка сообщения (fallback)', {
        projectId,
      messageType: ctx.message.text ? 'text' : 'other'
    });
    
    await ctx.reply(
      '⚠️ Бот работает в режиме fallback.\n\n' +
      'Для полноценной работы необходимо настроить и активировать workflow в панели управления.'
    );
  });

  // Fallback для callback queries
  bot.on('callback_query', async (ctx) => {
    logger.info('Обработка callback (fallback)', {
      projectId,
      data: ctx.callbackQuery.data
    });
    
    await ctx.answerCallbackQuery({
      text: '⚠️ Workflow не настроен'
    });
    
    await ctx.reply(
      '⚠️ Для обработки действий необходимо настроить workflow в панели управления.'
    );
  });

  logger.info(`✅ Бот создан успешно`, {
      projectId,
    component: 'bot-factory'
  });

  return bot;
}
