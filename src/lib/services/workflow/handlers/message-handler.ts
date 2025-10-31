/**
 * @file: src/lib/services/workflow/handlers/message-handler.ts
 * @description: Обработчик для message нод
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import { ProjectVariablesService } from '@/lib/services/project-variables.service';
import { UserVariablesService } from '../user-variables.service';
import { QueryExecutor } from '../query-executor';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult,
  MessageConfig
} from '@/types/workflow';
import type { InlineButton, ReplyButton } from './keyboard-handler';

/**
 * Обработчик для message нод
 */
export class MessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
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
            { telegramId: context.telegram.userId, projectId: context.projectId }
          );
          if (found?.id) {
            context.userId = found.id;
            this.logStep(context, node, 'Resolved userId from telegramId', 'info', { userId: context.userId });
          }
        } catch (e) {
          this.logStep(context, node, 'Failed resolve userId from telegramId', 'warn', { error: e });
        }
      }

      // Проверяем, требуется ли userId для этого сообщения
      if (!context.userId && messageText.includes('{user.')) {
        this.logStep(context, node, 'User not authenticated, cannot display personalized message', 'warn', {
          hasUserVariables: messageText.includes('{user.')
        });

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
          this.logStep(context, node, 'Loading user variables', 'debug', { userId: context.userId });
          
          const userVariables = await UserVariablesService.getUserVariables(
            context.services.db,
            context.userId,
            context.projectId
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
              console.warn(`⚠️ Skipping user variable ${key} because value is ${value}`);
            }
          });

          // Принудительная гарантия наличия user.expiringBonusesFormatted
          if (userVariables['user.expiringBonusesFormatted'] !== undefined && userVariables['user.expiringBonusesFormatted'] !== null) {
            additionalVariables['user.expiringBonusesFormatted'] = String(userVariables['user.expiringBonusesFormatted']);
          }

          // Логируем в консоль для отладки
          console.log('🔥 DEBUG MESSAGE-HANDLER:');
          console.log('   userVariables keys:', Object.keys(userVariables));
          console.log('   expiringBonusesFormatted in userVariables:', 'user.expiringBonusesFormatted' in userVariables);
          console.log('   expiringBonusesFormatted value:', userVariables['user.expiringBonusesFormatted']);
          console.log('   additionalVariables keys:', Object.keys(additionalVariables));
          console.log('   expiringBonusesFormatted in additionalVariables:', 'user.expiringBonusesFormatted' in additionalVariables);
          console.log('   referralCount in additionalVariables:', 'user.referralCount' in additionalVariables);
          console.log('   referralCount value:', additionalVariables['user.referralCount']);
          console.log('   progressPercent in additionalVariables:', 'user.progressPercent' in additionalVariables);
          console.log('   progressPercent value:', additionalVariables['user.progressPercent']);

          // Финальная проверка перед отправкой
          console.log('📤 FINAL MESSAGE CHECK:');
          console.log('   Original messageText:', messageText);
          console.log('   Has expiringBonusesFormatted placeholder:', messageText.includes('{user.expiringBonusesFormatted}'));
          console.log('   Final messageText after replacement:', messageText);

          // ТОЧНАЯ проверка после замены переменных
          const replacedText = await ProjectVariablesService.replaceVariablesInText(
            context.projectId,
            messageText,
            additionalVariables
          );
          console.log('🔄 AFTER PROJECT VARIABLES REPLACEMENT:');
          console.log('   Replaced text:', replacedText);
          console.log('   Has placeholder after replacement:', replacedText.includes('{user.expiringBonusesFormatted}'));

          // Обновляем messageText
          messageText = replacedText;

          this.logStep(context, node, 'User variables added to additionalVariables', 'debug', {
            userVariablesCount: Object.keys(userVariables).length,
            additionalVariablesCount: Object.keys(additionalVariables).length,
            sampleUserVariables: Object.keys(userVariables).slice(0, 3),
            expiringBonusesValue: userVariables['user.expiringBonusesFormatted'],
            hasExpiringBonuses: 'user.expiringBonusesFormatted' in additionalVariables,
            allUserVariables: userVariables,
            allAdditionalVariables: additionalVariables
          });
        } catch (error) {
          this.logStep(context, node, 'Failed to load user variables', 'warn', { error });
        }
      } else {
        this.logStep(context, node, 'No userId available, skipping user variables', 'debug');
        
        // Добавляем базовые переменные даже без userId
        additionalVariables['user.firstName'] = context.telegram.firstName || 'Пользователь';
        additionalVariables['user.telegramUsername'] = context.telegram.username || '';
        additionalVariables['user.balanceFormatted'] = '0 бонусов';
        additionalVariables['user.currentLevel'] = 'Базовый';
        additionalVariables['user.referralCode'] = 'Недоступно';
        additionalVariables['user.referralLink'] = 'Недоступно';
      }

      // 🔍 Отладка перед заменой переменных
      this.logStep(context, node, 'About to replace variables in text', 'debug', {
        textLength: messageText.length,
        hasExpiringBonusesPlaceholder: messageText.includes('{user.expiringBonusesFormatted}'),
        additionalVariablesKeys: Object.keys(additionalVariables),
        expiringBonusesInAdditional: 'user.expiringBonusesFormatted' in additionalVariables,
        expiringBonusesValue: additionalVariables['user.expiringBonusesFormatted'],
        allAdditionalVariables: additionalVariables
      });

      // Заменяем переменные проекта в тексте
      this.logStep(context, node, 'Replacing variables in text', 'debug', {
        originalText: messageText.substring(0, 100),
        variableCount: Object.keys(additionalVariables).length,
        hasUserVariables: Object.keys(additionalVariables).some(k => k.startsWith('user.'))
      });

      messageText = await ProjectVariablesService.replaceVariablesInText(
        context.projectId,
        messageText,
        additionalVariables
      );
      
      this.logStep(context, node, 'Variables replaced', 'debug', {
        finalText: messageText.substring(0, 100),
        hasUnreplacedVariables: messageText.includes('{') && messageText.includes('}')
      });

      // Отправляем сообщение через Telegram API
      const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;

      // Подготавливаем payload для API
      const payload: any = {
        chat_id: context.telegram.chatId,
        text: messageText,
        parse_mode: messageConfig?.parseMode || 'HTML'
      };

      // ✨ НОВОЕ: Добавляем клавиатуру если она настроена
      const keyboardConfig = messageConfig?.keyboard || (node.data?.config as any)?.keyboard;
      if (keyboardConfig) {
        const keyboard = this.buildKeyboard(keyboardConfig);
        if (keyboard) {
          payload.reply_markup = keyboard;
        }
      }

      await context.services.http.post(telegramApiUrl, payload);

      this.logStep(context, node, 'Message sent successfully', 'info', { 
        originalText: messageConfig?.text,
        processedText: messageText,
        hasKeyboard: !!keyboardConfig
      });

      // ✨ НОВОЕ: Проверяем, нужно ли ждать ответа пользователя
      if (keyboardConfig) {
        const needsWaiting = this.checkIfNeedsWaiting(keyboardConfig);
        
        if (needsWaiting.shouldWait) {
          this.logStep(context, node, `Setting waiting state: ${needsWaiting.waitType}`, 'info');
          
          // Импортируем здесь чтобы избежать circular dependencies
          const { db } = await import('@/lib/db');
          
          // Устанавливаем состояние ожидания
          await db.workflowExecution.update({
            where: { id: context.executionId },
            data: {
              status: 'waiting',
              waitType: needsWaiting.waitType,
              currentNodeId: node.id,
              waitPayload: {
                nodeId: node.id,
                keyboard: keyboardConfig,
                requestedAt: new Date()
              }
            }
          });

          // ✅ КЕШИРУЕМ WAITING EXECUTION В REDIS
          const { WorkflowRuntimeService } = await import('../../workflow-runtime.service');
          await WorkflowRuntimeService.cacheWaitingExecution(
            context.executionId,
            context.projectId,
            context.telegramChatId || '',
            needsWaiting.waitType
          );

          // Возвращаем специальный результат, который означает "остановиться и ждать"
          return '__WAITING_FOR_USER_INPUT__';
        }
      }

      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to send message', 'error', { error });
      throw error;
    }
  }

  /**
   * Проверяет, нужно ли ждать ответа пользователя после отправки сообщения
   */
  private checkIfNeedsWaiting(keyboardConfig: any): { 
    shouldWait: boolean; 
    waitType: 'contact' | 'callback' | 'input' | null;
  } {
    if (!keyboardConfig || !keyboardConfig.buttons) {
      return { shouldWait: false, waitType: null };
    }

    const buttons = keyboardConfig.buttons;
    
    // Проверяем все кнопки на наличие request_contact
    for (const row of buttons) {
      for (const button of row) {
        if (button.request_contact) {
          return { shouldWait: true, waitType: 'contact' };
        }
        // Для inline кнопок с callback_data тоже ждём
        if (button.callback_data && keyboardConfig.type === 'inline') {
          return { shouldWait: true, waitType: 'callback' };
        }
      }
    }

    // Для reply клавиатур без специальных кнопок - ждём обычный ввод
    if (keyboardConfig.type === 'reply') {
      return { shouldWait: true, waitType: 'input' };
    }

    return { shouldWait: false, waitType: null };
  }

  /**
   * ✨ НОВОЕ: Построение клавиатуры из конфигурации
   */
  private buildKeyboard(config: any): any {
    if (!config || !config.buttons || !Array.isArray(config.buttons)) {
      return null;
    }

    const keyboardType = config.type || 'inline';

    if (keyboardType === 'inline') {
      return this.buildInlineKeyboard(config.buttons);
    } else if (keyboardType === 'reply') {
      return this.buildReplyKeyboard(config.buttons, config);
    }

    return null;
  }

  /**
   * ✨ НОВОЕ: Построение inline клавиатуры
   */
  private buildInlineKeyboard(buttons: InlineButton[][]): any {
    const keyboard = buttons.map(row => 
      row.map(button => {
        const btn: any = { text: button.text };

        if (button.callback_data) {
          btn.callback_data = button.callback_data;
        } else if (button.url) {
          btn.url = button.url;
        } else if (button.web_app) {
          btn.web_app = button.web_app;
        } else if (button.login_url) {
          btn.login_url = button.login_url;
        } else if (button.goto_node) {
          // Для goto_node используем callback_data с префиксом
          btn.callback_data = `goto:${button.goto_node}`;
        }

        return btn;
      })
    );

    return { inline_keyboard: keyboard };
  }

  /**
   * ✨ НОВОЕ: Построение reply клавиатуры
   */
  private buildReplyKeyboard(buttons: ReplyButton[][], config: any): any {
    const keyboard = buttons.map(row =>
      row.map(button => {
        const btn: any = { text: button.text };

        if (button.request_contact) {
          btn.request_contact = true;
        } else if (button.request_location) {
          btn.request_location = true;
        } else if (button.request_poll) {
          btn.request_poll = button.request_poll;
        } else if (button.web_app) {
          btn.web_app = button.web_app;
        }

        return btn;
      })
    );

    return {
      keyboard,
      resize_keyboard: config.resize_keyboard !== false,
      one_time_keyboard: config.one_time_keyboard === true,
      selective: config.selective === true
    };
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

    if (config.parseMode && !['Markdown', 'HTML', 'MarkdownV2'].includes(config.parseMode)) {
      errors.push('Parse mode must be one of: Markdown, HTML, MarkdownV2');
    }

    if (config.keyboard) {
      if (config.keyboard.type && !['inline', 'reply'].includes(config.keyboard.type)) {
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
