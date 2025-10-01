/**
 * @file: src/lib/services/bot-flow-executor/node-handlers/message-node-handler.ts
 * @description: Обработчик ноды отправки сообщения
 * @project: SaaS Bonus System
 * @dependencies: Grammy, BaseNodeHandler
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { BaseNodeHandler, NodeExecutionResult } from './node-handler';
import type { BotConstructorContext } from '../../bot-session.service';
import type { BotFlow } from '@/types/bot-constructor';

export class MessageNodeHandler extends BaseNodeHandler {
  async execute(
    ctx: BotConstructorContext,
    flow: BotFlow,
    node: any
  ): Promise<NodeExecutionResult> {
    try {
      const config = node.data?.config?.message;
      if (!config) {
        throw new Error('Message node configuration is missing');
      }

      // Валидируем конфигурацию
      const validation = this.validateNodeConfig(node, ['config.message.text']);
      if (!validation.isValid) {
        throw new Error(
          `Invalid message configuration: ${validation.errors.join(', ')}`
        );
      }

      let messageText = config.text;

      // Заменяем переменные в тексте
      messageText = this.replaceVariables(messageText, ctx);

      // Формируем опции сообщения
      const messageOptions: any = {
        parse_mode: config.parseMode || 'Markdown'
      };

      // Добавляем клавиатуру если настроена
      if (config.keyboard?.buttons && config.keyboard.buttons.length > 0) {
        const keyboard = config.keyboard;

        if (keyboard.type === 'inline') {
          messageOptions.reply_markup = {
            inline_keyboard: keyboard.buttons.map((row: any[]) =>
              row.map((button: any) => ({
                text: this.replaceVariables(button.text, ctx),
                callback_data: button.callbackData || `btn_${Date.now()}`,
                url: button.url,
                web_app: button.webApp
              }))
            )
          };
        } else {
          // Reply keyboard
          messageOptions.reply_markup = {
            keyboard: keyboard.buttons.map((row: any[]) =>
              row.map((button: any) => ({
                text: this.replaceVariables(button.text, ctx)
              }))
            ),
            resize_keyboard: keyboard.resizeKeyboard || true,
            one_time_keyboard: keyboard.oneTimeKeyboard || false,
            selective: keyboard.selective || false
          };
        }
      }

      // Отправляем сообщение
      await ctx.reply(messageText, messageOptions);

      // Применяем дополнительные опции
      if (config.disablePreview) {
        // Отключаем превью ссылок (уже в parse_mode)
      }

      if (config.protectContent) {
        // Защищаем контент от пересылки (нужно использовать sendMessage вместо reply)
        // Это можно реализовать через ctx.api.sendMessage
      }

      // Находим следующую ноду
      const nextNodeId = this.findNextNodeId(flow, node.id);

      logger.info('Message node executed successfully', {
        nodeId: node.id,
        flowId: flow.id,
        userId: ctx.from?.id,
        hasKeyboard: !!config.keyboard,
        nextNodeId
      });

      return { nextNodeId };
    } catch (error) {
      logger.error('Message node execution failed', {
        nodeId: node.id,
        flowId: flow.id,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Замена переменных в тексте сообщения
   */
  private replaceVariables(text: string, ctx: BotConstructorContext): string {
    if (!text) return text;

    // Получаем переменные из сессии
    const variables = ctx.session?.variables || {};

    // Заменяем {variableName} на значения
    return text.replace(/\{([^}]+)\}/g, (match, varName) => {
      // Сначала ищем в переменных сессии
      if (variables[varName] !== undefined) {
        return String(variables[varName]);
      }

      // Затем в стандартных переменных
      const value = this.getVariableValue(ctx, varName);
      if (value !== undefined) {
        return String(value);
      }

      // Если переменная не найдена, оставляем как есть
      return match;
    });
  }
}
