/**
 * @file: telegram-bot-validation.service.ts
 * @description: Улучшенный сервис для валидации Telegram Bot токенов с проверкой статуса
 * @project: SaaS Bonus System
 * @dependencies: Grammy Bot API
 * @created: 2024-12-10
 * @updated: 2025-01-23
 * @author: AI Assistant + User
 */

import { Bot } from 'grammy';
import { logger } from '@/lib/logger';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dns from 'dns';
import { promisify } from 'util';

const lookupDns = promisify(dns.lookup);

export interface BotValidationResult {
  isValid: boolean;
  botInfo?: {
    id: number;
    username: string;
    firstName: string;
    canJoinGroups: boolean;
    canReadAllGroupMessages: boolean;
    supportsInlineQueries: boolean;
  };
  error?: string;
}

export interface BotTestResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    botActive: boolean;
    webhookStatus?: string;
    lastUpdate?: string | null;
    canSendMessages?: boolean;
  };
}

export interface BotStatusInfo {
  configured: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  message: string;
  bot?: {
    id: number;
    username: string;
    firstName: string;
  };
  connection?: {
    hasWebhook: boolean;
    lastUpdate?: string | null;
    canReceiveUpdates: boolean;
  };
}

export class TelegramBotValidationService {
  /**
   * Helper to get bot instance with proxy if configured
   */
  private static getBotInstance(token: string) {
    const proxyUrl = process.env.TELEGRAM_PROXY_URL;
    if (proxyUrl) {
      logger.debug('Using proxy for Telegram Bot API', {
        proxy: proxyUrl.replace(/:[^:]+@/, ':***@'), // Mask password
        tokenPreview: token.substring(0, 10) + '...'
      });
      const agent = new HttpsProxyAgent(proxyUrl);
      return new Bot(token, { client: { baseFetchConfig: { agent } } });
    }
    return new Bot(token);
  }

  /**
   * Diagnostic to check if Telegram API is reachable via DNS and TCP
   */
  private static async runDiagnostics() {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasProxy: !!process.env.TELEGRAM_PROXY_URL,
        appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
      }
    };

    try {
      const startTime = Date.now();
      const lookup = await lookupDns('api.telegram.org');
      diagnostics.dns = {
        resolved: true,
        address: lookup.address,
        family: lookup.family,
        durationMs: Date.now() - startTime
      };
    } catch (e) {
      diagnostics.dns = {
        resolved: false,
        error: e instanceof Error ? e.message : String(e)
      };
    }

    return diagnostics;
  }

  /**
   * Полная проверка статуса бота (используется для API bot/status)
   */
  static async getBotStatus(token: string): Promise<BotStatusInfo> {
    try {
      if (!token) {
        return {
          configured: false,
          status: 'INACTIVE',
          message: 'Токен бота не настроен'
        };
      }

      // Run diagnostics for logging
      const diagData = await this.runDiagnostics();
      logger.info('Telegram connectivity diagnostics', {
        diagnostics: diagData
      });

      const tempBot = this.getBotInstance(token);

      // Проверяем основную информацию о боте
      const botInfo = await tempBot.api.getMe();

      // Проверяем статус webhook
      let webhookInfo;
      try {
        webhookInfo = await tempBot.api.getWebhookInfo();
      } catch (webhookError) {
        logger.warn('Failed to get webhook info', { error: webhookError });
      }

      // Определяем режим получения обновлений без вызова getUpdates,
      // чтобы не сбивать активный long polling в BotManager
      const hasWebhook = Boolean(webhookInfo?.url);
      const canReceiveUpdates =
        hasWebhook || process.env.NODE_ENV !== 'production';
      const lastUpdate = null;

      logger.info('Bot status checked successfully', {
        botId: botInfo.id.toString(),
        username: botInfo.username,
        hasWebhook,
        canReceiveUpdates
      });

      return {
        configured: true,
        status: 'ACTIVE',
        message: `Бот активен и работает корректно`,
        bot: {
          id: botInfo.id,
          username: botInfo.username || '',
          firstName: botInfo.first_name
        },
        connection: {
          hasWebhook,
          lastUpdate,
          canReceiveUpdates
        }
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Bot status check failed', {
        error: errMsg,
        tokenPreview: token.substring(0, 10) + '...'
      });

      let status: 'INACTIVE' | 'ERROR' = 'ERROR';
      let message = 'Ошибка проверки статуса бота';

      if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        status = 'INACTIVE';
        message = 'Неверный токен бота';
      } else if (errMsg.includes('network') || errMsg.includes('timeout')) {
        message = 'Ошибка сети или превышено время ожидания';
      }

      return {
        configured: true,
        status,
        message
      };
    }
  }

  /**
   * Валидация токена бота через Telegram Bot API
   */
  static async validateBotToken(token: string): Promise<BotValidationResult> {
    try {
      if (!token || !token.includes(':')) {
        return {
          isValid: false,
          error: 'Неверный формат токена. Токен должен содержать символ ":"'
        };
      }

      // Создаем временный экземпляр бота для проверки с поддержкой прокси
      const tempBot = this.getBotInstance(token);

      // Получаем информацию о боте
      const botInfo = await tempBot.api.getMe();

      logger.info('Bot token validated successfully', {
        botId: botInfo.id.toString(),
        username: botInfo.username
      });

      return {
        isValid: true,
        botInfo: {
          id: botInfo.id,
          username: botInfo.username || '',
          firstName: botInfo.first_name,
          canJoinGroups: botInfo.can_join_groups || false,
          canReadAllGroupMessages: botInfo.can_read_all_group_messages || false,
          supportsInlineQueries: botInfo.supports_inline_queries || false
        }
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Bot token validation failed', {
        error: errMsg,
        tokenPreview: token.substring(0, 10) + '...'
      });

      let errorMessage = 'Ошибка валидации токена';

      if (errMsg.includes('401')) {
        errorMessage = 'Неверный токен бота. Проверьте токен в @BotFather';
      } else if (errMsg.includes('network')) {
        errorMessage = 'Ошибка сети. Попробуйте позже';
      } else if (errMsg.includes('timeout')) {
        errorMessage = 'Превышено время ожидания. Попробуйте позже';
      }

      return {
        isValid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Улучшенное тестирование бота с проверкой всех аспектов
   */
  static async testBot(
    token: string,
    testChatId?: string
  ): Promise<BotTestResult> {
    try {
      const tempBot = new Bot(token);

      // 1. Проверяем базовую информацию о боте
      const botInfo = await tempBot.api.getMe();

      // 2. Проверяем статус webhook
      let webhookStatus = 'none';
      try {
        const webhookInfo = await tempBot.api.getWebhookInfo();
        if (webhookInfo.url) {
          webhookStatus = `active (${webhookInfo.url})`;
        } else {
          webhookStatus = 'not set';
        }
      } catch (webhookError) {
        webhookStatus = 'check failed';
      }

      // 3. Оцениваем возможность получения обновлений без getUpdates,
      // чтобы не провоцировать конфликт polling/webhook
      const canReceiveUpdates =
        webhookStatus !== 'not set' || process.env.NODE_ENV !== 'production';
      const lastUpdateTime = null;

      // 4. Если указан тестовый чат, отправляем сообщение
      let canSendMessages = false;
      if (testChatId) {
        try {
          const testMessage =
            `🤖 Тест бота успешен!\n\n` +
            `📋 Информация о боте:\n` +
            `• Имя: ${botInfo.first_name}\n` +
            `• Username: @${botInfo.username}\n` +
            `• ID: ${botInfo.id}\n\n` +
            `🔗 Статус подключения:\n` +
            `• Webhook: ${webhookStatus}\n` +
            `• Получение обновлений: ${canReceiveUpdates ? '✅' : '❌'}\n` +
            `${lastUpdateTime ? `• Последнее обновление: ${lastUpdateTime}\n` : ''}` +
            `\n⏰ Время теста: ${new Date().toLocaleString('ru-RU')}`;

          await tempBot.api.sendMessage(testChatId, testMessage);
          canSendMessages = true;

          logger.info('Bot test message sent successfully', {
            chatId: testChatId,
            botUsername: botInfo.username
          });
        } catch (sendError) {
          const sendMsg =
            sendError instanceof Error ? sendError.message : String(sendError);
          logger.warn('Failed to send test message', {
            error: sendMsg,
            chatId: testChatId
          });

          if (sendMsg.includes('chat not found')) {
            throw new Error(
              'Чат не найден. Убедитесь, что ID чата указан корректно'
            );
          } else if (sendMsg.includes('Forbidden')) {
            throw new Error(
              'Бот не имеет прав для отправки сообщений в этот чат'
            );
          } else {
            throw sendError;
          }
        }
      }

      return {
        success: true,
        message: testChatId
          ? `Тест прошел успешно! Сообщение отправлено в чат ${testChatId}`
          : `Бот @${botInfo.username} настроен и готов к работе`,
        details: {
          botActive: true,
          webhookStatus,
          lastUpdate: lastUpdateTime,
          canSendMessages
        }
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Bot test failed', {
        error: errMsg,
        chatId: testChatId,
        tokenPreview: token.substring(0, 10) + '...'
      });

      return {
        success: false,
        error: errMsg,
        details: {
          botActive: false,
          canSendMessages: false
        }
      };
    }
  }

  /**
   * Получение информации о боте без создания постоянного экземпляра
   */
  static async getBotInfo(token: string) {
    try {
      const tempBot = new Bot(token);
      const botInfo = await tempBot.api.getMe();

      return {
        id: botInfo.id,
        username: botInfo.username || '',
        firstName: botInfo.first_name,
        isBot: botInfo.is_bot
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get bot info', {
        error: errMsg,
        tokenPreview: token.substring(0, 10) + '...'
      });
      throw error;
    }
  }

  /**
   * Установка команд бота
   */
  static async setBotCommands(token: string) {
    try {
      const tempBot = new Bot(token);

      const commands = [
        { command: 'start', description: '🚀 Начать работу с ботом' },
        { command: 'balance', description: '💰 Проверить баланс бонусов' },
        { command: 'history', description: '📊 История операций' },
        { command: 'level', description: '⭐ Текущий уровень и прогресс' },
        { command: 'referral', description: '👥 Реферальная программа' },
        { command: 'invite', description: '🔗 Пригласить друга' },
        { command: 'help', description: '❓ Помощь и поддержка' }
      ];

      await tempBot.api.setMyCommands(commands);

      logger.info('Bot commands set successfully', {
        tokenPreview: token.substring(0, 10) + '...',
        commandsCount: commands.length
      });

      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to set bot commands', {
        error: errMsg,
        tokenPreview: token.substring(0, 10) + '...'
      });
      throw error;
    }
  }
}
