/**
 * @file: src/lib/services/workflow/handlers/message-handler.ts
 * @description: Обработчик для message нод
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext, WaitForInputHandler, KeyboardBuilder
 * @created: 2025-01-13
 * @updated: 2026-01-06
 * @author: AI Assistant + User
 *
 * ВАЖНО: Логика построения клавиатур делегируется KeyboardBuilder из keyboard-handler.ts
 * для избежания дублирования кода.
 */

import { BaseNodeHandler } from './base-handler';
import { ProjectVariablesService } from '@/lib/services/project-variables.service';
import { UserVariablesService } from '../user-variables.service';
import { QueryExecutor } from '../query-executor';
import { logger } from '@/lib/logger';
import {
  WaitForInputHandler,
  WAITING_FOR_USER_INPUT
} from './wait-for-input-handler';
import { KeyboardBuilder } from './keyboard-handler';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult,
  MessageConfig
} from '@/types/workflow';

/**
 * Обработчик для message нод
 */
export class MessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message';
  }

  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<string | null> {
    try {
      // Получаем текст сообщения из конфигурации ноды
      const messageConfig = node.data?.config?.message;
      let messageText = messageConfig?.text || 'Сообщение не настроено';

      // Подготавливаем дополнительные переменные из контекста
      const additionalVariables: Record<string, string> = {
        // Telegram переменные
        username: context.telegram.username || '',
        first_name: context.telegram.firstName || '',
        user_id: context.telegram.userId || '',
        chat_id: context.telegram.chatId || '',

        // Workflow переменные
        workflow_id: context.workflowId,
        execution_id: context.executionId,
        session_id: context.sessionId
      };

      // Если userId не задан в контексте — пытаемся определить по Telegram ID
      if (!context.userId && context.telegram?.userId) {
        try {
          const found = await QueryExecutor.execute(
            context.services.db as any,
            'check_user_by_telegram',
            {
              telegramId: context.telegram.userId,
              projectId: context.projectId
            }
          );
          if (found?.id) {
            context.userId = found.id;
            this.logStep(
              context,
              node,
              'Resolved userId from telegramId',
              'info',
              { userId: context.userId }
            );
          }
        } catch (e) {
          this.logStep(
            context,
            node,
            'Failed resolve userId from telegramId',
            'warn',
            { error: e }
          );
        }
      }

      // Проверяем, требуется ли userId для этого сообщения
      if (!context.userId && messageText.includes('{user.')) {
        this.logStep(
          context,
          node,
          'User not authenticated, cannot display personalized message',
          'warn',
          {
            hasUserVariables: messageText.includes('{user.')
          }
        );

        // Отправляем сообщение об ошибке привязки аккаунта
        const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;
        await context.services.http.post(telegramApiUrl, {
          chat_id: context.telegram.chatId,
          text: '❌ Для использования меню необходимо привязать аккаунт. Введите /start для начала.',
          parse_mode: 'HTML'
        });

        return null; // Останавливаем выполнение workflow
      }

      // Получаем переменные пользователя, если userId доступен
      if (context.userId) {
        try {
          this.logStep(context, node, 'Loading user variables', 'debug', {
            userId: context.userId
          });

          const userVarsStartTime = Date.now();
          const userVariables = await UserVariablesService.getUserVariables(
            context.services.db,
            context.userId,
            context.projectId
          );
          logger.info(
            `🚀 [PERF] UserVariablesService.getUserVariables took ${Date.now() - userVarsStartTime}ms`,
            {
              userId: context.userId,
              projectId: context.projectId,
              executionId: context.executionId
            }
          );

          this.logStep(context, node, 'User variables loaded', 'debug', {
            variableCount: Object.keys(userVariables).length,
            sampleVariables: Object.keys(userVariables).slice(0, 5)
          });

          // ✅ КРИТИЧНО: Добавляем переменные пользователя с префиксом user.
          // Только если значение не undefined/null
          Object.entries(userVariables).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              additionalVariables[key] = String(value);
            } else {
              console.warn(
                `⚠️ Skipping user variable ${key} because value is ${value}`
              );
            }
          });

          // Принудительная гарантия наличия user.expiringBonusesFormatted
          if (
            userVariables['user.expiringBonusesFormatted'] !== undefined &&
            userVariables['user.expiringBonusesFormatted'] !== null
          ) {
            additionalVariables['user.expiringBonusesFormatted'] = String(
              userVariables['user.expiringBonusesFormatted']
            );
          }

          // Логируем для отладки
          logger.debug('message-handler debug', {
            userVariablesKeys: Object.keys(userVariables),
            expiringBonusesInUserVars:
              'user.expiringBonusesFormatted' in userVariables,
            expiringBonusesValue:
              userVariables['user.expiringBonusesFormatted'],
            additionalVariablesKeys: Object.keys(additionalVariables),
            expiringBonusesInAdditional:
              'user.expiringBonusesFormatted' in additionalVariables,
            referralCountInAdditional:
              'user.referralCount' in additionalVariables,
            referralCountValue: additionalVariables['user.referralCount'],
            progressPercentInAdditional:
              'user.progressPercent' in additionalVariables,
            progressPercentValue: additionalVariables['user.progressPercent']
          });

          // Финальная проверка перед отправкой
          logger.debug('final message check', {
            originalMessageText: messageText,
            hasExpiringBonusesPlaceholder: messageText.includes(
              '{user.expiringBonusesFormatted}'
            ),
            finalMessageText: messageText
          });

          // ТОЧНАЯ проверка после замены переменных
          const replacedText =
            await ProjectVariablesService.replaceVariablesInText(
              context.projectId,
              messageText,
              additionalVariables
            );
          console.log('🔄 AFTER PROJECT VARIABLES REPLACEMENT:');
          console.log('   Replaced text:', replacedText);
          console.log(
            '   Has placeholder after replacement:',
            replacedText.includes('{user.expiringBonusesFormatted}')
          );

          // Обновляем messageText
          messageText = replacedText;

          this.logStep(
            context,
            node,
            'User variables added to additionalVariables',
            'debug',
            {
              userVariablesCount: Object.keys(userVariables).length,
              additionalVariablesCount: Object.keys(additionalVariables).length,
              sampleUserVariables: Object.keys(userVariables).slice(0, 3),
              expiringBonusesValue:
                userVariables['user.expiringBonusesFormatted'],
              hasExpiringBonuses:
                'user.expiringBonusesFormatted' in additionalVariables,
              allUserVariables: userVariables,
              allAdditionalVariables: additionalVariables
            }
          );
        } catch (error) {
          this.logStep(context, node, 'Failed to load user variables', 'warn', {
            error
          });
        }
      } else {
        this.logStep(
          context,
          node,
          'No userId available, skipping user variables',
          'debug'
        );

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

      // 🔍 Отладка перед заменой переменных
      this.logStep(
        context,
        node,
        'About to replace variables in text',
        'debug',
        {
          textLength: messageText.length,
          hasExpiringBonusesPlaceholder: messageText.includes(
            '{user.expiringBonusesFormatted}'
          ),
          additionalVariablesKeys: Object.keys(additionalVariables),
          expiringBonusesInAdditional:
            'user.expiringBonusesFormatted' in additionalVariables,
          expiringBonusesValue:
            additionalVariables['user.expiringBonusesFormatted'],
          allAdditionalVariables: additionalVariables
        }
      );

      // Заменяем переменные проекта в тексте
      this.logStep(context, node, 'Replacing variables in text', 'debug', {
        originalText: messageText.substring(0, 100),
        variableCount: Object.keys(additionalVariables).length,
        hasUserVariables: Object.keys(additionalVariables).some((k) =>
          k.startsWith('user.')
        )
      });

      messageText = await ProjectVariablesService.replaceVariablesInText(
        context.projectId,
        messageText,
        additionalVariables
      );

      this.logStep(context, node, 'Variables replaced', 'debug', {
        finalText: messageText.substring(0, 100),
        hasUnreplacedVariables:
          messageText.includes('{') && messageText.includes('}')
      });

      // Отправляем сообщение через Telegram API
      const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;

      // Подготавливаем payload для API
      const payload: any = {
        chat_id: context.telegram.chatId,
        text: messageText,
        parse_mode: messageConfig?.parseMode || 'HTML'
      };

      // ✨ Добавляем клавиатуру если она настроена (делегируем KeyboardBuilder)
      const keyboardConfig =
        messageConfig?.keyboard || (node.data?.config as any)?.keyboard;
      if (keyboardConfig) {
        const keyboard = await KeyboardBuilder.buildKeyboard(
          keyboardConfig,
          context.projectId,
          additionalVariables
        );
        if (keyboard) {
          payload.reply_markup = keyboard;
        }
      }

      const sendMessageStartTime = Date.now();
      await context.services.http.post(telegramApiUrl, payload);
      logger.info(
        `🚀 [PERF] Telegram sendMessage took ${Date.now() - sendMessageStartTime}ms`,
        {
          chatId: context.telegram.chatId,
          executionId: context.executionId
        }
      );

      this.logStep(context, node, 'Message sent successfully', 'info', {
        originalText: messageConfig?.text,
        processedText: messageText,
        hasKeyboard: !!keyboardConfig
      });

      // ✨ НОВОЕ: Проверяем, нужно ли ждать ответа пользователя
      // Используем унифицированный WaitForInputHandler

      // 🔍 DEBUG: Логируем проверку waitForInput
      console.log(
        '🔍 MESSAGE HANDLER: Checking wait conditions via WaitForInputHandler',
        {
          nodeId: node.id,
          nodeLabel: node.data?.label,
          hasKeyboard: !!keyboardConfig
        }
      );

      // Используем унифицированный обработчик для проверки и установки состояния ожидания
      const waitResult = await WaitForInputHandler.handleWaitForInput(
        node,
        context,
        keyboardConfig
      );

      if (waitResult === WAITING_FOR_USER_INPUT) {
        this.logStep(
          context,
          node,
          `Waiting for user input via WaitForInputHandler`,
          'info',
          {
            nodeId: node.id
          }
        );
        return WAITING_FOR_USER_INPUT;
      }

      return null;
    } catch (error) {
      this.logStep(context, node, 'Failed to send message', 'error', { error });
      throw error;
    }
  }

  /**
   * @deprecated Use WaitForInputHandler.checkKeyboardForWaiting instead
   * Kept for backward compatibility
   */
  private checkIfNeedsWaiting(keyboardConfig: any): {
    shouldWait: boolean;
    waitType: 'contact' | 'callback' | 'input' | null;
  } {
    const result = WaitForInputHandler.checkKeyboardForWaiting(keyboardConfig);
    return {
      shouldWait: result.shouldWait,
      waitType: result.waitType as 'contact' | 'callback' | 'input' | null
    };
  }

  /**
   * @deprecated Use KeyboardBuilder.buildKeyboard instead
   * Kept for backward compatibility - delegates to KeyboardBuilder
   */
  private async buildKeyboard(
    config: any,
    context: ExecutionContext,
    additionalVariables: Record<string, string>
  ): Promise<any> {
    return KeyboardBuilder.buildKeyboard(
      config,
      context.projectId,
      additionalVariables
    );
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Message configuration is required');
      return { isValid: false, errors };
    }

    if (!config.text || typeof config.text !== 'string') {
      errors.push('Message text is required and must be a string');
    }

    if (
      config.parseMode &&
      !['Markdown', 'HTML', 'MarkdownV2'].includes(config.parseMode)
    ) {
      errors.push('Parse mode must be one of: Markdown, HTML, MarkdownV2');
    }

    if (config.keyboard) {
      if (
        config.keyboard.type &&
        !['inline', 'reply'].includes(config.keyboard.type)
      ) {
        errors.push('Keyboard type must be "inline" or "reply"');
      }

      if (config.keyboard.buttons && !Array.isArray(config.keyboard.buttons)) {
        errors.push('Keyboard buttons must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
