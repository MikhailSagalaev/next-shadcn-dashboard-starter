/**
 * @file: src/lib/services/workflow/handlers/keyboard-handler.ts
 * @description: Обработчики для клавиатур (inline и reply)
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import { ProjectVariablesService } from '@/lib/services/project-variables.service';
import { ButtonActionsExecutor, type ButtonAction } from '../button-actions-executor';
import { ButtonActionsRegistry } from '../button-actions-registry';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';

/**
 * Типы кнопок для inline клавиатуры
 */
export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
  login_url?: { url: string };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  pay?: boolean;
  goto_node?: string; // ← Прямая связь с нодой (альтернатива триггерам)
}

/**
 * Конфигурация inline клавиатуры
 */
export interface InlineKeyboardConfig {
  text: string;
  buttons: InlineButton[][];  // Массив рядов кнопок
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
}

/**
 * Обработчик для message.keyboard.inline
 */
export class InlineKeyboardHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.keyboard.inline';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data?.config?.['message.keyboard.inline'] as InlineKeyboardConfig;

      if (!config) {
        throw new Error('Inline keyboard configuration is missing');
      }

      // Разрешаем переменные в тексте сообщения
      const additionalVariables: Record<string, string> = {
        username: context.telegram.username || '',
        first_name: context.telegram.firstName || '',
        user_id: context.telegram.userId || '',
        chat_id: context.telegram.chatId || '',
        workflow_id: context.workflowId,
        execution_id: context.executionId,
        session_id: context.sessionId
      };

      let messageText = await ProjectVariablesService.replaceVariablesInText(
        context.projectId,
        config.text,
        additionalVariables
      );

      // Обрабатываем кнопки - разрешаем переменные
      const processedButtons = await this.processButtons(config.buttons, context);

      this.logStep(context, node, 'Sending message with inline keyboard', 'info', {
        text: messageText.substring(0, 50),
        buttonRows: processedButtons.length,
        totalButtons: processedButtons.reduce((sum, row) => sum + row.length, 0)
      });

      // Формируем inline клавиатуру
      const inlineKeyboard = {
        inline_keyboard: processedButtons
      };

      // Отправляем сообщение с клавиатурой через Telegram API
      const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;

      const response = await context.services.http.post(telegramApiUrl, {
        chat_id: context.telegram.chatId,
        text: messageText,
        reply_markup: inlineKeyboard,
        parse_mode: config.parse_mode || 'HTML',
        disable_web_page_preview: config.disable_web_page_preview || false
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description || 'Unknown error'}`);
      }

      this.logStep(context, node, 'Inline keyboard sent successfully', 'info', {
        messageId: response.data.result?.message_id
      });

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to send inline keyboard', 'error', { error });
      throw error;
    }
  }

  /**
   * Обрабатывает кнопки - разрешает переменные в тексте и callback_data
   */
  private async processButtons(
    buttons: InlineButton[][],
    context: ExecutionContext
  ): Promise<InlineButton[][]> {
    const processedRows: InlineButton[][] = [];

    for (const row of buttons) {
      const processedRow: InlineButton[] = [];

      for (const button of row) {
        const processedButton: InlineButton = {
          text: this.resolveValue(button.text, context) as string
        };

        // Обрабатываем различные типы кнопок
        if (button.callback_data) {
          processedButton.callback_data = this.resolveValue(button.callback_data, context) as string;
        }

        if (button.url) {
          processedButton.url = this.resolveValue(button.url, context) as string;
        }

        if (button.web_app) {
          processedButton.web_app = {
            url: this.resolveValue(button.web_app.url, context) as string
          };
        }

        if (button.login_url) {
          processedButton.login_url = {
            url: this.resolveValue(button.login_url.url, context) as string
          };
        }

        if (button.switch_inline_query !== undefined) {
          processedButton.switch_inline_query = this.resolveValue(
            button.switch_inline_query,
            context
          ) as string;
        }

        if (button.switch_inline_query_current_chat !== undefined) {
          processedButton.switch_inline_query_current_chat = this.resolveValue(
            button.switch_inline_query_current_chat,
            context
          ) as string;
        }

        if (button.pay) {
          processedButton.pay = true;
        }

        processedRow.push(processedButton);
      }

      processedRows.push(processedRow);
    }

    return processedRows;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Inline keyboard configuration is required');
      return { isValid: false, errors };
    }

    if (!config.text || typeof config.text !== 'string') {
      errors.push('Message text is required and must be a string');
    }

    if (!config.buttons || !Array.isArray(config.buttons)) {
      errors.push('Buttons are required and must be an array');
    } else {
      // Валидируем структуру кнопок
      for (let rowIndex = 0; rowIndex < config.buttons.length; rowIndex++) {
        const row = config.buttons[rowIndex];

        if (!Array.isArray(row)) {
          errors.push(`Button row ${rowIndex} must be an array`);
          continue;
        }

        if (row.length === 0) {
          errors.push(`Button row ${rowIndex} is empty`);
        }

        for (let btnIndex = 0; btnIndex < row.length; btnIndex++) {
          const button = row[btnIndex];

          if (!button.text || typeof button.text !== 'string') {
            errors.push(`Button [${rowIndex}][${btnIndex}] must have a text property`);
          }

          // Проверяем, что есть хотя бы одно действие
          const hasAction = !!(
            button.callback_data ||
            button.url ||
            button.web_app ||
            button.login_url ||
            button.switch_inline_query !== undefined ||
            button.switch_inline_query_current_chat !== undefined ||
            button.pay
          );

          if (!hasAction) {
            errors.push(
              `Button [${rowIndex}][${btnIndex}] must have at least one action ` +
              `(callback_data, url, web_app, etc.)`
            );
          }
        }
      }
    }

    if (config.parse_mode && !['HTML', 'Markdown', 'MarkdownV2'].includes(config.parse_mode)) {
      errors.push('parse_mode must be one of: HTML, Markdown, MarkdownV2');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Типы кнопок для reply клавиатуры
 */
export interface ReplyButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: {
    type?: 'quiz' | 'regular';
  };
  web_app?: { url: string };
  actions?: ButtonAction[]; // ← НОВОЕ: Встроенные действия при нажатии кнопки
}

/**
 * Конфигурация reply клавиатуры
 */
export interface ReplyKeyboardConfig {
  text: string;
  buttons: ReplyButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/**
 * Обработчик для message.keyboard.reply
 */
export class ReplyKeyboardHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.keyboard.reply';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data?.config?.['message.keyboard.reply'] as ReplyKeyboardConfig;

      if (!config) {
        throw new Error('Reply keyboard configuration is missing');
      }

      // Разрешаем переменные в тексте
      const additionalVariables: Record<string, string> = {
        username: context.telegram.username || '',
        first_name: context.telegram.firstName || '',
        user_id: context.telegram.userId || '',
        chat_id: context.telegram.chatId || ''
      };

      let messageText = await ProjectVariablesService.replaceVariablesInText(
        context.projectId,
        config.text,
        additionalVariables
      );

      // Обрабатываем кнопки (поддерживаем оба варианта: buttons и keyboard)
      const buttons = (config as any).buttons || (config as any).keyboard;
      if (!buttons) {
        throw new Error('Keyboard buttons are required');
      }
      const processedButtons = this.processReplyButtons(buttons, context);

      // ✨ НОВОЕ: Регистрируем actions для кнопок
      this.registerButtonActions(buttons, context);

      this.logStep(context, node, 'Sending message with reply keyboard', 'info', {
        text: messageText.substring(0, 50),
        buttonRows: processedButtons.length
      });

      // Формируем reply клавиатуру
      const replyKeyboard = {
        keyboard: processedButtons,
        resize_keyboard: config.resize_keyboard !== false, // По умолчанию true
        one_time_keyboard: config.one_time_keyboard || false,
        input_field_placeholder: config.input_field_placeholder,
        selective: config.selective || false
      };

      // Отправляем сообщение
      const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;

      const response = await context.services.http.post(telegramApiUrl, {
        chat_id: context.telegram.chatId,
        text: messageText,
        reply_markup: replyKeyboard,
        parse_mode: config.parse_mode || 'HTML'
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description || 'Unknown error'}`);
      }

      this.logStep(context, node, 'Reply keyboard sent successfully', 'info', {
        messageId: response.data.result?.message_id
      });

      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to send reply keyboard', 'error', { error });
      throw error;
    }
  }

  private processReplyButtons(
    buttons: ReplyButton[][],
    context: ExecutionContext
  ): ReplyButton[][] {
    const processedRows: ReplyButton[][] = [];

    for (const row of buttons) {
      const processedRow: ReplyButton[] = [];

      for (const button of row) {
        const processedButton: ReplyButton = {
          text: this.resolveValue(button.text, context) as string
        };

        if (button.request_contact) {
          processedButton.request_contact = true;
        }

        if (button.request_location) {
          processedButton.request_location = true;
        }

        if (button.request_poll) {
          processedButton.request_poll = button.request_poll;
        }

        if (button.web_app) {
          processedButton.web_app = {
            url: this.resolveValue(button.web_app.url, context) as string
          };
        }

        processedRow.push(processedButton);
      }

      processedRows.push(processedRow);
    }

    return processedRows;
  }

  /**
   * ✨ НОВОЕ: Регистрирует actions для кнопок с request_contact/request_location
   */
  private registerButtonActions(
    buttons: ReplyButton[][],
    context: ExecutionContext
  ): void {
    for (const row of buttons) {
      for (const button of row) {
        // Регистрируем actions только если они есть
        if (button.actions && button.actions.length > 0) {
          ButtonActionsRegistry.register(
            {
              projectId: context.projectId,
              userId: context.telegram.userId || '',
              buttonText: button.text
            },
            button.actions
          );

          this.logStep(context, { id: 'register-actions', type: 'action' } as any, 
            `Registered ${button.actions.length} actions for button "${button.text}"`, 
            'info'
          );
        }
      }
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Reply keyboard configuration is required');
      return { isValid: false, errors };
    }

    if (!config.text || typeof config.text !== 'string') {
      errors.push('Message text is required and must be a string');
    }

    if (!config.buttons || !Array.isArray(config.buttons)) {
      errors.push('Buttons are required and must be an array');
    } else {
      for (let rowIndex = 0; rowIndex < config.buttons.length; rowIndex++) {
        const row = config.buttons[rowIndex];

        if (!Array.isArray(row)) {
          errors.push(`Button row ${rowIndex} must be an array`);
          continue;
        }

        for (let btnIndex = 0; btnIndex < row.length; btnIndex++) {
          const button = row[btnIndex];

          if (!button.text || typeof button.text !== 'string') {
            errors.push(`Button [${rowIndex}][${btnIndex}] must have a text property`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

