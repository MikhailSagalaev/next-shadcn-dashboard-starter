/**
 * @file: src/lib/telegram/bot-manager.ts
 * @description: Менеджер для управления экземплярами Telegram ботов
 * @project: SaaS Bonus System
 * @dependencies: Grammy, Node.js Map
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

// Типизация восстановлена для обеспечения безопасности типов

import {
  Bot,
  Context,
  SessionFlavor,
  webhookCallback,
  GrammyError,
  HttpError
} from 'grammy';
import { run } from '@grammyjs/runner';
import { createBot } from './bot';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { BotSettings } from '@/types/api';
import { setupGlobalErrorHandler } from './global-error-handler';

// Типизация контекста (совпадает с bot.ts)
interface SessionData {
  step?: string;
  projectId?: string;
  awaitingContact?: boolean;
}

type MyContext = Context & SessionFlavor<SessionData>;

interface BotInstance {
  bot: Bot<MyContext>;
  webhook: ReturnType<typeof webhookCallback> | null; // null в dev режиме (polling), webhookCallback в prod режиме
  isActive: boolean;
  projectId: string;
  lastUpdated: Date;
  isPolling?: boolean; // Флаг для отслеживания состояния polling
}

/**
 * Менеджер для управления несколькими экземплярами ботов
 * Поддерживает создание, обновление и деактивацию ботов для разных проектов
 */
class BotManager {
  private bots: Map<string, BotInstance> = new Map();
  private readonly WEBHOOK_BASE_URL: string;
  private readonly operationLocks: Map<string, Promise<any>> = new Map();

  constructor() {
    // Берем публичный базовый URL приложения. Предпочитаем NEXT_PUBLIC_APP_URL,
    // затем APP_URL, и только затем dev-значение. Это позволяет в продакшене
    // работать по IP/HTTP без хаков и автоматически выбирать режим.
    this.WEBHOOK_BASE_URL =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'http://localhost:5006';

    // Активируем глобальный обработчик ошибок для 409 конфликтов
    setupGlobalErrorHandler();

    logger.info('BotManager инициализирован', {
      webhookBaseUrl: this.WEBHOOK_BASE_URL,
      isLocalDevelopment: process.env.NODE_ENV === 'development',
      component: 'bot-manager'
    });
  }

  /**
   * Получение экземпляра бота по projectId
   */
  getBot(projectId: string): BotInstance | undefined {
    return this.bots.get(projectId);
  }

  /**
   * Получение состояния всех ботов для отладки
   */
  getAllBotsStatus(): Array<{
    projectId: string;
    token: string;
    isActive: boolean;
    isPolling: boolean;
  }> {
    return Array.from(this.bots.entries()).map(([projectId, botInstance]) => ({
      projectId,
      token: '***' + botInstance.bot.token.slice(-4),
      isActive: botInstance.isActive,
      isPolling: botInstance.isPolling
    }));
  }

  /**
   * Получение всех активных ботов
   */
  getAllBots(): Array<[string, BotInstance]> {
    return Array.from(this.bots.entries());
  }

  /**
   * Отправка расширенного уведомления с медиа и кнопками
   */
  async sendRichBroadcastMessage(
    projectId: string,
    userIds: string[],
    message: string,
    options: {
      imageUrl?: string;
      buttons?: Array<{
        text: string;
        url?: string;
        callback_data?: string;
      }>;
      parseMode?: 'Markdown' | 'HTML';
    } = {}
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors: string[];
  }> {
    try {
      const botInstance = this.bots.get(projectId);
      if (!botInstance || !botInstance.isActive) {
        throw new Error('Бот не активен для этого проекта');
      }

      const { imageUrl, buttons, parseMode = 'Markdown' } = options;
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Создаем inline keyboard если есть кнопки
      let replyMarkup = undefined;
      if (buttons && buttons.length > 0) {
        const { InlineKeyboard } = await import('grammy');
        const keyboard = new InlineKeyboard();

        buttons.forEach((button, index) => {
          if (button.url) {
            keyboard.url(button.text, button.url);
          } else if (button.callback_data) {
            keyboard.text(button.text, button.callback_data);
          }

          // Добавляем перенос строки каждые 2 кнопки
          if ((index + 1) % 2 === 0 && index < buttons.length - 1) {
            keyboard.row();
          }
        });

        replyMarkup = keyboard;
      }

      // Отправляем сообщения пользователям с ограничением параллелизма
      const CONCURRENCY = 20; // безопасно для Telegram (30 msg/sec)
      logger.info(
        'Начинаем рассылку',
        {
          projectId,
          recipients: userIds.length,
          hasImage: !!imageUrl,
          buttons: buttons?.length || 0,
          parseMode
        },
        'bot-manager'
      );

      const sendToUser = async (userId: string) => {
        try {
          const user = await db.user.findUnique({ where: { id: userId } });
          if (!user || !user.telegramId) {
            failedCount++;
            errors.push(
              `Пользователь ${userId}: не найден или не привязан к Telegram`
            );
            return;
          }

          try {
            if (imageUrl) {
              await botInstance.bot.api.sendPhoto(
                user.telegramId.toString(),
                imageUrl,
                {
                  caption: message,
                  parse_mode: parseMode,
                  reply_markup: replyMarkup
                }
              );
            } else {
              await botInstance.bot.api.sendMessage(
                user.telegramId.toString(),
                message,
                {
                  parse_mode: parseMode,
                  reply_markup: replyMarkup
                }
              );
            }
          } catch (primaryError) {
            // fallback без parse_mode на случай ошибок парсинга разметки
            const msg =
              primaryError instanceof Error
                ? primaryError.message
                : String(primaryError);
            if (
              /parse/i.test(msg) ||
              /can't parse/i.test(msg) ||
              /entities/i.test(msg)
            ) {
              if (imageUrl) {
                await botInstance.bot.api.sendPhoto(
                  user.telegramId.toString(),
                  imageUrl,
                  {
                    caption: message,
                    reply_markup: replyMarkup
                  }
                );
              } else {
                await botInstance.bot.api.sendMessage(
                  user.telegramId.toString(),
                  message,
                  {
                    reply_markup: replyMarkup
                  }
                );
              }
            } else {
              throw primaryError;
            }
          }

          sentCount++;
          logger.info(
            `Расширенное уведомление отправлено пользователю ${userId}`,
            {
              projectId,
              userId,
              messageLength: message.length,
              hasImage: !!imageUrl,
              buttonsCount: buttons?.length || 0
            },
            'bot-manager'
          );
        } catch (error) {
          failedCount++;
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Пользователь ${userId}: ${errorMsg}`);
          logger.error(
            `Ошибка отправки расширенного уведомления пользователю ${userId}`,
            { projectId, userId, error: errorMsg },
            'bot-manager'
          );
        }
      };

      for (let i = 0; i < userIds.length; i += CONCURRENCY) {
        const batch = userIds.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map((id) => sendToUser(id)));
      }

      logger.info(
        `Расширенные уведомления отправлены`,
        {
          projectId,
          totalUsers: userIds.length,
          sentCount,
          failedCount,
          errorsCount: errors.length
        },
        'bot-manager'
      );

      return {
        success: sentCount > 0,
        sentCount,
        failedCount,
        errors
      };
    } catch (error) {
      logger.error(
        `Ошибка отправки расширенных уведомлений`,
        {
          projectId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'bot-manager'
      );

      return {
        success: false,
        sentCount: 0,
        failedCount: userIds.length,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Экстренная остановка ВСЕХ ботов с указанным токеном (для решения 409 конфликтов)
   */
  async emergencyStopBotsWithToken(token: string): Promise<void> {
    logger.info(`🔍 ПОИСК БОТОВ С ТОКЕНОМ ***${token.slice(-4)}`, {
      token: '***' + token.slice(-4),
      allBots: Array.from(this.bots.entries()).map(([id, bot]) => ({
        projectId: id,
        token: '***' + bot.bot.token.slice(-4),
        isActive: bot.isActive,
        isPolling: bot.isPolling
      })),
      component: 'bot-manager'
    });

    const botsWithToken = Array.from(this.bots.entries()).filter(
      ([_, botInstance]) => botInstance.bot.token === token
    );

    if (botsWithToken.length === 0) {
      logger.info(`ℹ️ Боты с токеном ***${token.slice(-4)} не найдены`, {
        component: 'bot-manager'
      });
      return;
    }

    logger.warn(`🚨 ЭКСТРЕННАЯ ОСТАНОВКА БОТОВ С ТОКЕНОМ ***${token.slice(-4)}`, {
      botCount: botsWithToken.length,
      projectIds: botsWithToken.map(([id]) => id),
      botsDetails: botsWithToken.map(([id, bot]) => ({
        projectId: id,
        isActive: bot.isActive,
        isPolling: bot.isPolling,
        token: '***' + bot.bot.token.slice(-4)
      })),
      component: 'bot-manager'
    });

    const promises = botsWithToken.map(async ([projectId, botInstance]) => {
      try {
        // Принудительно помечаем как неактивный
        botInstance.isPolling = false;
        botInstance.isActive = false;

        // Удаляем webhook
        try {
          await botInstance.bot.api.deleteWebhook({
            drop_pending_updates: true
          });
        } catch (webhookError) {
          // Игнорируем ошибки webhook
        }

        // Останавливаем polling
        try {
          await botInstance.bot.stop();
        } catch (stopError) {
          // Игнорируем ошибки остановки
        }

        // Удаляем из карты
        this.bots.delete(projectId);

        logger.info(`✅ Экстренная остановка бота ${projectId} - успешно`, {
          projectId,
          component: 'bot-manager'
        });
      } catch (error) {
        logger.error(`❌ Экстренная остановка бота ${projectId} - ошибка`, {
          projectId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'bot-manager'
        });
      }
    });

    await Promise.allSettled(promises);

    logger.warn(`🚨 Экстренная остановка ботов с токеном завершена`, {
      component: 'bot-manager'
    });

    // Дополнительная задержка для очистки Telegram API
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  /**
   * Экстренная остановка ВСЕХ ботов (для решения 409 конфликтов)
   */
  async emergencyStopAll(): Promise<void> {
    logger.warn(`🚨 ЭКСТРЕННАЯ ОСТАНОВКА ВСЕХ БОТОВ`, {
      botCount: this.bots.size,
      component: 'bot-manager'
    });

    const promises = Array.from(this.bots.keys()).map(async (projectId) => {
      try {
        await this.stopBot(projectId);
        logger.info(`Экстренная остановка бота ${projectId} - успешно`, {
          projectId,
          component: 'bot-manager'
        });
      } catch (error) {
        logger.error(`Экстренная остановка бота ${projectId} - ошибка`, {
          projectId,
          error: error instanceof Error ? error.message : 'Unknown error',
          component: 'bot-manager'
        });
      }
    });

    await Promise.allSettled(promises);

    // Принудительно очищаем все операции
    this.operationLocks.clear();
    this.bots.clear();

    // Дополнительная задержка для полной очистки Telegram API
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.warn(`🚨 Экстренная остановка завершена`, {
      component: 'bot-manager'
    });
  }

  /**
   * Создание и запуск нового бота с улучшенной архитектурой
   * Решает проблему конфликта между командами и рассылками
   */
  async createBot(
    projectId: string,
    botSettings: BotSettings
  ): Promise<BotInstance> {
    // Проверяем, не выполняется ли уже операция для этого проекта
    const existingOperation = this.operationLocks.get(projectId);
    if (existingOperation) {
      logger.info(
        `Операция создания бота уже выполняется, ожидаем завершения`,
        {
          projectId,
          component: 'bot-manager'
        }
      );
      return existingOperation;
    }

    // Создаем новую операцию с блокировкой
    const operation = this._createBotInternal(projectId, botSettings);
    this.operationLocks.set(projectId, operation);

    try {
      const result = await operation;
      return result;
    } finally {
      // Убираем блокировку после завершения
      this.operationLocks.delete(projectId);
    }
  }

  /**
   * Внутренний метод создания бота
   */
  private async _createBotInternal(
    projectId: string,
    botSettings: BotSettings
  ): Promise<BotInstance> {
    try {
      logger.info(`🚀 СОЗДАНИЕ БОТА ${projectId}`, {
        projectId,
        token: '***' + botSettings.botToken.slice(-4),
        username: botSettings.botUsername,
        existingBots: Array.from(this.bots.keys()),
        existingTokens: Array.from(this.bots.values()).map(b => '***' + b.bot.token.slice(-4)),
        component: 'bot-manager'
      });

      // КРИТИЧНО: Останавливаем существующий бот если есть
      await this.stopBot(projectId);

      // Добавляем задержку для избежания конфликтов Telegram API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Создаем новый экземпляр бота
      const bot = createBot(botSettings.botToken, projectId, botSettings);

      // ВАЖНО: Инициализируем бота согласно документации Grammy
      await bot.init();
      logger.info(`✅ БОТ ИНИЦИАЛИЗИРОВАН: @${bot.botInfo.username}`, {
        projectId,
        token: '***' + botSettings.botToken.slice(-4),
        botId: bot.botInfo.id,
        username: bot.botInfo.username,
        firstName: bot.botInfo.first_name,
        allBotsInManager: this.getAllBotsStatus(),
        component: 'bot-manager'
      });

      // Определяем возможность работы через webhook: нужен HTTPS.
      // Если HTTPS нет (IP/HTTP), принудительно используем polling.
      const isWebhookCapable = this.WEBHOOK_BASE_URL.startsWith('https://');
      const isLocalDevelopment = process.env.NODE_ENV === 'development';
      
      // В локальной разработке принудительно используем polling
      if (isLocalDevelopment) {
        logger.info('🏠 ЛОКАЛЬНАЯ РАЗРАБОТКА - принудительно используем polling', {
          projectId,
          webhookBaseUrl: this.WEBHOOK_BASE_URL,
          component: 'bot-manager'
        });
        
        // Удаляем webhook если он установлен
        try {
          await bot.api.deleteWebhook({ drop_pending_updates: true });
          logger.info('✅ Webhook удален для локальной разработки', {
            projectId,
            component: 'bot-manager'
          });
        } catch (webhookError) {
          logger.warn('⚠️ Ошибка удаления webhook (возможно не установлен)', {
            projectId,
            error: webhookError instanceof Error ? webhookError.message : 'Unknown',
            component: 'bot-manager'
          });
        }
      }

      const finalMode = isLocalDevelopment ? 'Local Development (polling)' : 
                       isWebhookCapable ? 'Production (webhook)' : 'Polling (no-https)';
      
      logger.info(`Режим работы: ${finalMode}`, {
        projectId,
        isDev: !isWebhookCapable,
        isLocalDevelopment,
        baseUrl: this.WEBHOOK_BASE_URL,
        nodeEnv: process.env.NODE_ENV,
        component: 'bot-manager'
      });

      let webhook = null;
      let isPolling = false;

      // ИСПРАВЛЕННОЕ РЕШЕНИЕ: Используем правильный режим для каждой среды
      if (isLocalDevelopment) {
        // В локальной разработке всегда используем polling
        logger.info('🏠 Локальная разработка - запускаем polling', {
          projectId,
          component: 'bot-manager'
        });
        
        // Запускаем grammY runner (long polling, параллельная обработка)
        try {
          logger.info(`🚀 ЗАПУСК GRAMMY RUNNER (ЛОКАЛЬНАЯ РАЗРАБОТКА)`, {
            projectId,
            token: '***' + bot.token.slice(-4),
            botInfo: bot.botInfo ? {
              id: bot.botInfo.id,
              username: bot.botInfo.username,
              firstName: bot.botInfo.first_name
            } : null,
            component: 'bot-manager'
          });

          void run(bot); // runner сам управляет polling и параллельностью

          isPolling = true;
          logger.info(`✅ RUNNER ИНИЦИИРОВАН (ЛОКАЛЬНАЯ РАЗРАБОТКА)`, {
            projectId,
            token: '***' + bot.token.slice(-4),
            component: 'bot-manager'
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';

          if (errorMessage.includes('409') || errorMessage.includes('terminated by other getUpdates')) {
            logger.error('❌ 409 КОНФЛИКТ ПРИ ЛОКАЛЬНОМ ЗАПУСКЕ', {
              projectId,
              token: '***' + bot.token.slice(-4),
              error: errorMessage,
              allBotsInManager: this.getAllBotsStatus(),
              component: 'bot-manager'
            });
            
            // Создаем BotInstance даже при конфликте, но без запуска
            const botInstance: BotInstance = {
              bot,
              webhook: null, // null в dev режиме (polling)
              isActive: false,
              isPolling: false,
              lastUpdated: new Date(),
              projectId
            };
            
            this.bots.set(projectId, botInstance);
            return botInstance;
          }
          
          logger.error('Ошибка в запросе:', {
            projectId,
            description: errorMessage,
            component: 'bot-manager'
          });
          throw error;
        }
      } else if (!isWebhookCapable) {
        // Без HTTPS: используем polling (webhook потребует TLS)
        logger.info(`Development режим: настраиваем polling для бота`, {
          projectId,
          component: 'bot-manager'
        });

        // Очищаем webhook для polling режима
        try {
          await bot.api.deleteWebhook({ drop_pending_updates: true });
          logger.info(`Webhook очищен для polling режима`, {
            projectId,
            component: 'bot-manager'
          });
        } catch (error) {
          logger.warn(`Не удалось очистить webhook`, {
            projectId,
            error:
              error instanceof Error ? error.message : 'Неизвестная ошибка',
            component: 'bot-manager'
          });
        }

        // Добавляем обработчик ошибок
        bot.catch((err) => {
          const ctx = err.ctx;
          const e = err.error;

          logger.error(
            `Ошибка при обработке обновления ${ctx?.update?.update_id}:`,
            {
              projectId,
              error: e instanceof Error ? e.message : 'Неизвестная ошибка',
              component: 'bot-manager'
            }
          );

          if (e instanceof GrammyError) {
            // Специальная обработка ошибки 409 (конфликт getUpdates)
            if (e.error_code === 409) {
              logger.error('❌ 409 КОНФЛИКТ GETUPDATES', {
                projectId,
                token: '***' + bot.token.slice(-4),
                description: e.description,
                error_code: e.error_code,
                allBotsInManager: Array.from(this.bots.entries()).map(([pid, botInstance]) => ({
                  projectId: pid,
                  token: '***' + botInstance.bot.token.slice(-4),
                  isActive: botInstance.isActive,
                  isPolling: botInstance.isPolling
                })),
                component: 'bot-manager'
              });
              
              // Не перезапускаем бота автоматически, просто логируем
              return;
            }
            
            logger.error('Ошибка в запросе:', {
              projectId,
              description: e.description,
              error_code: e.error_code,
              component: 'bot-manager'
            });
          } else if (e instanceof HttpError) {
            logger.error('Не удалось связаться с Telegram:', {
              projectId,
              error: e.message,
              component: 'bot-manager'
            });
          } else {
            logger.error('Неизвестная ошибка:', {
              projectId,
              error: e instanceof Error ? e.message : String(e),
              component: 'bot-manager'
            });
          }
        });

        // Проверяем конфликты токенов для polling
        const existingBot = Array.from(this.bots.values()).find(
          (botInstance) =>
            botInstance.bot.token === bot.token &&
            botInstance.projectId !== projectId &&
            botInstance.isPolling
        );

        if (existingBot) {
          logger.warn(
            `Конфликт токенов: останавливаем предыдущий бот в проекте ${existingBot.projectId}`,
            {
              projectId,
              existingProjectId: existingBot.projectId,
              component: 'bot-manager'
            }
          );
          
          // Останавливаем предыдущий бот
          try {
            await this.stopBot(existingBot.projectId);
            logger.info(`Предыдущий бот остановлен`, {
              projectId: existingBot.projectId,
              component: 'bot-manager'
            });
          } catch (error) {
            logger.error(`Ошибка остановки предыдущего бота`, {
              projectId: existingBot.projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
              component: 'bot-manager'
            });
          }
        }

        // Проверяем, что нет других активных ботов с тем же токеном
        const remainingConflict = Array.from(this.bots.values()).find(
          (botInstance) =>
            botInstance.bot.token === bot.token &&
            botInstance.projectId !== projectId
        );

        if (!remainingConflict) {
          // Принудительно удаляем webhook перед запуском polling
          try {
            await bot.api.deleteWebhook({ drop_pending_updates: true });
            logger.info(`Webhook удален перед запуском polling`, {
              projectId,
              component: 'bot-manager'
            });
            
            // Дополнительная задержка для очистки Telegram API
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logger.warn(`Не удалось удалить webhook перед polling`, {
              projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
              component: 'bot-manager'
            });
          }

          // Запускаем grammY runner (long polling, параллельная обработка)
          try {
            logger.info(`🚀 ЗАПУСК GRAMMY RUNNER`, {
              projectId,
              token: '***' + bot.token.slice(-4),
              botInfo: bot.botInfo ? {
                id: bot.botInfo.id,
                username: bot.botInfo.username,
                firstName: bot.botInfo.first_name
              } : null,
              component: 'bot-manager'
            });

            void run(bot); // runner сам управляет polling и параллельностью

            isPolling = true;
            logger.info(`✅ RUNNER ИНИЦИИРОВАН (POLLING)`, {
              projectId,
              token: '***' + bot.token.slice(-4),
              component: 'bot-manager'
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Неизвестная ошибка';

            if (
              errorMessage.includes('409') ||
              errorMessage.includes('terminated by other getUpdates')
            ) {
              logger.error('❌ 409 КОНФЛИКТ ПРИ ЛОКАЛЬНОМ ЗАПУСКЕ', {
                projectId,
                token: '***' + bot.token.slice(-4),
                error: errorMessage,
                allBotsInManager: this.getAllBotsStatus(),
                component: 'bot-manager'
              });
              
              // Создаем BotInstance даже при конфликте, но без запуска
              const botInstance: BotInstance = {
                bot,
                webhook: null, // null в dev режиме (polling)
                isActive: false,
                isPolling: false,
                lastUpdated: new Date(),
                projectId
              };
              
              this.bots.set(projectId, botInstance);
              return botInstance;
            } else {
              logger.error(`Ошибка запуска polling`, {
                projectId,
                error: errorMessage,
                component: 'bot-manager'
              });
              throw error;
            }
          }
        }
      } else {
        // Production режим - создаем webhook callback и настраиваем webhook
        logger.info(`Production режим: создаем webhook callback для бота`, {
          projectId,
          component: 'bot-manager'
        });
        webhook = webhookCallback(bot, 'std/http');
        // Production режим - настраиваем webhook только если есть HTTPS
        const webhookUrl = `${this.WEBHOOK_BASE_URL}/api/telegram/webhook/${projectId}`;
        if (webhookUrl.startsWith('https://')) {
          // Проверяем конфликты токенов для webhook
          const existingWebhookBot = Array.from(this.bots.values()).find(
            (botInstance) =>
              botInstance.bot.token === bot.token &&
              botInstance.projectId !== projectId &&
              !botInstance.isPolling
          );

          if (existingWebhookBot) {
            logger.warn(
              `Конфликт токенов webhook: останавливаем предыдущий бот в проекте ${existingWebhookBot.projectId}`,
              {
                projectId,
                existingProjectId: existingWebhookBot.projectId,
                component: 'bot-manager'
              }
            );
            
            // Останавливаем предыдущий бот
            try {
              await this.stopBot(existingWebhookBot.projectId);
              logger.info(`Предыдущий webhook бот остановлен`, {
                projectId: existingWebhookBot.projectId,
                component: 'bot-manager'
              });
            } catch (error) {
              logger.error(`Ошибка остановки предыдущего webhook бота`, {
                projectId: existingWebhookBot.projectId,
                error: error instanceof Error ? error.message : 'Unknown error',
                component: 'bot-manager'
              });
            }
          }

          try {
            logger.info(`Production режим: устанавливаем webhook для бота`, {
              projectId,
              webhookUrl,
              component: 'bot-manager'
            });

            await bot.api.setWebhook(webhookUrl, {
              allowed_updates: [
                'message',
                'callback_query',
                'inline_query',
                'chosen_inline_result'
              ],
              drop_pending_updates: true
            });

            logger.info(`Webhook установлен для бота`, {
              projectId,
              webhookUrl,
              component: 'bot-manager'
            });
          } catch (error) {
            logger.error(`Ошибка установки webhook для бота`, {
              projectId,
              error:
                error instanceof Error ? error.message : 'Неизвестная ошибка',
              component: 'bot-manager'
            });
          }
        } else {
          // Невалидный кейс сюда не попадёт, так как isWebhookCapable=true только при https
        }
      }

      // Создаем и сохраняем BotInstance ПОСЛЕ настройки
      const botInstance: BotInstance = {
        bot,
        webhook: webhook as any, // null в dev режиме, webhookCallback в prod режиме
        isActive: botSettings.isActive,
        projectId,
        lastUpdated: new Date(),
        isPolling // true в dev (polling), false в prod (webhook)
      };

      this.bots.set(projectId, botInstance);
      
      // Синхронизируем isActive в БД при успешном запуске
      try {
        await db.botSettings.update({
          where: { projectId },
          data: { isActive: true }
        });
        logger.info(`✅ Статус бота синхронизирован с БД (isActive=true)`, {
          projectId,
          component: 'bot-manager'
        });
      } catch (dbError) {
        logger.error(`Ошибка синхронизации статуса бота в БД`, {
          projectId,
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          component: 'bot-manager'
        });
      }
      
      logger.info(`Бот для проекта ${projectId} создан и активирован`, {
        projectId,
        mode: isPolling ? 'polling' : 'webhook',
        isPolling,
        hasWebhook: !!webhook,
        component: 'bot-manager'
      });

      // Дополнительная диагностика состояния бота
      try {
        const botInfo = await bot.api.getMe();
        logger.info(`Диагностика бота ${projectId}:`, {
          projectId,
          botId: botInfo.id,
          username: botInfo.username,
          canJoinGroups: botInfo.can_join_groups,
          canReadAllGroupMessages: botInfo.can_read_all_group_messages,
          supportsInlineQueries: botInfo.supports_inline_queries,
          mode: isPolling ? 'polling' : 'webhook',
          component: 'bot-manager'
        });
      } catch (error) {
        logger.error(`Ошибка диагностики бота ${projectId}:`, {
          projectId,
          error: error instanceof Error ? error.message : 'Unknown',
          component: 'bot-manager'
        });
      }

      return botInstance;
    } catch (error) {
      logger.error(`Ошибка создания бота для проекта ${projectId}`, {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'bot-manager'
      });
      throw error;
    }
  }

  /**
   * Обновление настроек бота
   */
  async updateBot(
    projectId: string,
    botSettings: BotSettings
  ): Promise<BotInstance> {
    const existingBot = this.bots.get(projectId);

    logger.info('🔄 UPDATE BOT ВЫЗВАН', {
      projectId,
      existingBot: existingBot ? {
        token: '***' + existingBot.bot.token.slice(-4),
        isActive: existingBot.isActive,
        isPolling: existingBot.isPolling
      } : null,
      newToken: '***' + botSettings.botToken.slice(-4),
      allBotsInManager: this.getAllBotsStatus(),
      component: 'bot-manager'
    });

    // Если токен изменился, сначала останавливаем старый бот, затем создаем новый
    if (!existingBot || existingBot.bot.token !== botSettings.botToken) {
      logger.info('🔄 ТОКЕН БОТА ИЗМЕНИЛСЯ, ПЕРЕСОЗДАЕМ БОТА', {
        projectId,
        oldToken: existingBot?.bot.token ? '***' + existingBot.bot.token.slice(-4) : 'none',
        newToken: '***' + botSettings.botToken.slice(-4),
        component: 'bot-manager'
      });

      // Сначала останавливаем существующий бот
      if (existingBot) {
        try {
          await this.stopBot(projectId);
          logger.info('Старый бот остановлен перед обновлением токена', {
            projectId,
            component: 'bot-manager'
          });
        } catch (error) {
          logger.warn('Ошибка остановки старого бота, продолжаем создание нового', {
            projectId,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            component: 'bot-manager'
          });
        }
      }

      // Принудительно удаляем из карты ботов
      this.bots.delete(projectId);

      // Ждем дольше, чтобы избежать конфликтов
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Создаем новый бот
      return this.createBot(projectId, botSettings);
    }

    // Обновляем статус активности
    existingBot.isActive = botSettings.isActive;
    existingBot.lastUpdated = new Date();

    // Если бот деактивирован, останавливаем его
    if (!botSettings.isActive) {
      try {
        await this.stopBot(projectId);
        logger.info(`Бот для проекта ${projectId} деактивирован`, {
          projectId,
          component: 'bot-manager'
        });
      } catch (error) {
        logger.error(`Ошибка деактивации бота ${projectId}`, {
          projectId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'bot-manager'
        });
      }
    }

    this.bots.set(projectId, existingBot);
    return existingBot;
  }

  /**
   * Остановка и удаление бота (форсированная)
   */
  async stopBot(projectId: string): Promise<void> {
    const botInstance = this.bots.get(projectId);

    if (botInstance) {
      try {
        logger.info(`🚨 ФОРСИРОВАННАЯ ОСТАНОВКА БОТА ${projectId}`, {
          projectId,
          token: '***' + botInstance.bot.token.slice(-4),
          isPolling: botInstance.isPolling,
          isActive: botInstance.isActive,
          component: 'bot-manager'
        });

        // КРИТИЧНО: Принудительно помечаем как неактивный СРАЗУ
        botInstance.isPolling = false;
        botInstance.isActive = false;

        // Удаляем webhook ПЕРВЫМ делом для предотвращения конфликтов
        try {
          await botInstance.bot.api.deleteWebhook({
            drop_pending_updates: true
          });
          logger.info(`✅ Webhook удален для бота ${projectId}`, {
            projectId,
            component: 'bot-manager'
          });
        } catch (webhookError) {
          logger.warn(`⚠️ Ошибка удаления webhook для бота ${projectId}`, {
            projectId,
            error: webhookError instanceof Error ? webhookError.message : 'Неизвестная ошибка',
            component: 'bot-manager'
          });
        }

        // Останавливаем polling с коротким таймаутом
        try {
          const stopPromise = botInstance.bot.stop();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Stop timeout')), 1000)
          );

          await Promise.race([stopPromise, timeoutPromise]);
          logger.info(`✅ Polling остановлен для бота ${projectId}`, {
            projectId,
            component: 'bot-manager'
          });
        } catch (stopError) {
          logger.warn(`⚠️ Принудительная остановка polling для бота ${projectId}`, {
            projectId,
            error: stopError instanceof Error ? stopError.message : 'Timeout',
            component: 'bot-manager'
          });
        }

        // Дополнительная задержка для полной очистки Telegram API
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        logger.error(`❌ Критическая ошибка остановки бота ${projectId}`, {
          projectId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'bot-manager'
        });
      }

      // КРИТИЧНО: Удаляем из map в любом случае
      this.bots.delete(projectId);
      
      // Синхронизируем isActive в БД при остановке
      try {
        await db.botSettings.update({
          where: { projectId },
          data: { isActive: false }
        });
        logger.info(`✅ Статус бота синхронизирован с БД (isActive=false)`, {
          projectId,
          component: 'bot-manager'
        });
      } catch (dbError) {
        logger.error(`Ошибка синхронизации статуса бота в БД`, {
          projectId,
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          component: 'bot-manager'
        });
      }
      
      logger.info(`🗑️ Бот ${projectId} удален из менеджера`, {
        projectId,
        component: 'bot-manager'
      });
    } else {
      logger.info(`ℹ️ Бот ${projectId} не найден в менеджере`, {
        projectId,
        component: 'bot-manager'
      });
    }
  }

  /**
   * Загрузка всех активных ботов из базы данных
   */
  async loadAllBots(): Promise<void> {
    try {
      const allBotSettings = await db.botSettings.findMany({
        where: { isActive: true },
        include: { project: true }
      });

      logger.info(`Загрузка ${allBotSettings.length} активных ботов...`, {
        component: 'bot-manager'
      });

      for (const botSettings of allBotSettings) {
        try {
          // Преобразуем настройки для BotManager
          const botSettingsForManager = {
            ...botSettings,
            welcomeMessage:
              typeof botSettings.welcomeMessage === 'string'
                ? botSettings.welcomeMessage
                : 'Добро пожаловать! 🎉\n\nЭто бот бонусной программы.'
          };
          await this.createBot(
            botSettings.projectId,
            botSettingsForManager as any
          );
        } catch (error) {
          logger.error(`Ошибка загрузки бота ${botSettings.projectId}`, {
            projectId: botSettings.projectId,
            error:
              error instanceof Error ? error.message : 'Неизвестная ошибка',
            component: 'bot-manager'
          });
        }
      }

      logger.info(`Загружено ${this.bots.size} ботов`, {
        component: 'bot-manager'
      });
    } catch (error) {
      logger.error('Ошибка загрузки ботов из базы данных', {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'bot-manager'
      });
    }
  }

  /**
   * Получение статистики ботов
   */
  getStats() {
    const total = this.bots.size;
    const active = Array.from(this.bots.values()).filter(
      (bot) => bot.isActive
    ).length;
    const inactive = total - active;

    return {
      total,
      active,
      inactive,
      bots: Array.from(this.bots.entries()).map(([projectId, instance]) => ({
        projectId,
        isActive: instance.isActive,
        isPolling: instance.isPolling || false,
        lastUpdated: instance.lastUpdated
      }))
    };
  }

  /**
   * Получение экземпляра бота для проекта
   */
  getBotInstance(projectId: string): BotInstance | undefined {
    return this.bots.get(projectId);
  }

  /**
   * Получение webhook handler для конкретного проекта
   * Всегда возвращает webhook (unified webhook architecture)
   */
  getWebhookHandler(projectId: string) {
    const botInstance = this.bots.get(projectId);

    if (!botInstance || !botInstance.isActive) {
      logger.warn(`Bot instance не найден или неактивен`, {
        projectId,
        exists: !!botInstance,
        isActive: botInstance?.isActive,
        component: 'bot-manager'
      });
      return null;
    }

    if (!botInstance.webhook) {
      logger.error(`Webhook handler отсутствует для активного бота`, {
        projectId,
        component: 'bot-manager'
      });
      return null;
    }

    logger.info(`Webhook handler найден для проекта`, {
      projectId,
      component: 'bot-manager'
    });

    return botInstance.webhook;
  }

  /**
   * Проверка состояния бота
   */
  async checkBotHealth(projectId: string): Promise<{
    isRunning: boolean;
    webhookInfo?: any;
    error?: string;
  }> {
    const botInstance = this.bots.get(projectId);

    if (!botInstance) {
      return { isRunning: false, error: 'Бот не найден' };
    }

    try {
      const webhookInfo = await botInstance.bot.api.getWebhookInfo();
      return {
        isRunning: true,
        webhookInfo
      };
    } catch (error) {
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
}

// Создаем глобальный экземпляр менеджера
const globalForBotManager = globalThis as unknown as {
  botManager: BotManager | undefined;
};

export const botManager = globalForBotManager.botManager ?? new BotManager();

if (process.env.NODE_ENV !== 'production') {
  globalForBotManager.botManager = botManager;
}

// Автоматическая загрузка ботов при инициализации модуля
// ОТКЛЮЧАЕМ автозагрузку - будем загружать только по требованию
// botManager.loadAllBots().catch(error => {
//   logger.error('Ошибка автоматической загрузки ботов:', {
//     error: error instanceof Error ? error.message : 'Неизвестная ошибка',
//     component: 'bot-manager'
//   });
// });

