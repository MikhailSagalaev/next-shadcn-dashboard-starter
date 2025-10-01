/**
 * @file: src/lib/services/bot-flow-executor/conversations-integration.ts
 * @description: Интеграция с Grammy Conversations для сложных диалогов
 * @project: SaaS Bonus System
 * @dependencies: Grammy Conversations, FlowExecutor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Composer, Context } from 'grammy';
// import { conversations, createConversation } from '@grammyjs/conversations';
// import { SessionFlavor } from 'grammy';
import { logger } from '@/lib/logger';
import { BotSessionService } from '../bot-session.service';

import type { BotConstructorSession } from '../bot-session.service';

// Расширенный контекст
type BotConstructorContext = Context & SessionFlavor<BotConstructorSession>;

export class ConversationsIntegration {
  private composer: Composer<BotConstructorContext>;

  constructor(composer: Composer<BotConstructorContext>) {
    this.composer = composer;
    this.setupConversations();
  }

  /**
   * Настройка conversations для обработки сложных диалогов
   */
  private setupConversations(): void {
    // Conversation для ввода данных
    this.composer.use(
      createConversation(this.inputConversation.bind(this), {
        id: 'input_conversation'
      })
    );

    // Conversation для подтверждений
    this.composer.use(
      createConversation(this.confirmationConversation.bind(this), {
        id: 'confirmation_conversation'
      })
    );

    // Conversation для выбора из списка
    this.composer.use(
      createConversation(this.selectionConversation.bind(this), {
        id: 'selection_conversation'
      })
    );

    // Conversation для многошаговых форм
    this.composer.use(
      createConversation(this.formConversation.bind(this), {
        id: 'form_conversation'
      })
    );
  }

  /**
   * Conversation для ввода данных от пользователя
   */
  async inputConversation(conversation: any, ctx: BotConstructorContext) {
    const config = conversation.session.inputConfig;

    if (!config) {
      await ctx.reply('❌ Конфигурация ввода не найдена');
      return;
    }

    let attempts = 0;
    const maxAttempts = config.maxRetries || 3;

    while (attempts < maxAttempts) {
      try {
        // Запрашиваем ввод
        await ctx.reply(config.prompt || 'Пожалуйста, введите данные:');

        // Ожидаем ответ
        const response = await conversation.waitFor('message:text', {
          timeout: (config.timeout || 300) * 1000
        });

        const input = response.message.text.trim();

        // Валидируем ввод
        if (this.validateInput(input, config.validation)) {
          // Сохраняем в переменную
          if (config.variableName) {
            BotSessionService.setSessionVariable(
              ctx,
              config.variableName,
              input
            );
          }

          // Подтверждаем успех
          if (config.successMessage) {
            await ctx.reply(config.successMessage);
          }

          return input;
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            await ctx.reply(
              config.retryMessage || '❌ Неверный формат. Попробуйте еще раз.'
            );
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
          await ctx.reply('⏰ Время ожидания истекло.');
          break;
        } else {
          logger.error('Input conversation error', { error });
          break;
        }
      }
    }

    // Превышено количество попыток
    await ctx.reply('❌ Превышено количество попыток ввода.');
    throw new Error('Input validation failed');
  }

  /**
   * Conversation для подтверждений (да/нет)
   */
  async confirmationConversation(
    conversation: any,
    ctx: BotConstructorContext
  ) {
    const config = conversation.session.confirmationConfig;

    if (!config) {
      await ctx.reply('❌ Конфигурация подтверждения не найдена');
      return;
    }

    const question = config.question || 'Подтверждаете действие?';
    const yesText = config.yesText || 'да';
    const noText = config.noText || 'нет';

    await ctx.reply(question, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `✅ ${yesText}`, callback_data: 'confirm_yes' },
            { text: `❌ ${noText}`, callback_data: 'confirm_no' }
          ]
        ]
      }
    });

    const response = await conversation.waitFor('callback_query', {
      timeout: (config.timeout || 300) * 1000
    });

    const confirmed = response.callbackQuery.data === 'confirm_yes';

    // Сохраняем результат
    if (config.variableName) {
      BotSessionService.setSessionVariable(ctx, config.variableName, confirmed);
    }

    // Отвечаем на callback
    await ctx.answerCallbackQuery();

    // Убираем клавиатуру
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });

    return confirmed;
  }

  /**
   * Conversation для выбора из списка
   */
  async selectionConversation(conversation: any, ctx: BotConstructorContext) {
    const config = conversation.session.selectionConfig;

    if (!config || !config.options || config.options.length === 0) {
      await ctx.reply('❌ Список для выбора не найден');
      return;
    }

    const question = config.question || 'Выберите вариант:';

    // Создаем клавиатуру с вариантами
    const keyboard = config.options.map((option: any, index: number) => [
      {
        text: option.label || option,
        callback_data: `select_${index}`
      }
    ]);

    await ctx.reply(question, {
      reply_markup: { inline_keyboard: keyboard }
    });

    const response = await conversation.waitFor('callback_query', {
      timeout: (config.timeout || 300) * 1000
    });

    const selectedIndex = parseInt(
      response.callbackQuery.data.replace('select_', '')
    );
    const selectedOption = config.options[selectedIndex];

    // Сохраняем результат
    if (config.variableName) {
      BotSessionService.setSessionVariable(
        ctx,
        config.variableName,
        selectedOption
      );
    }

    // Отвечаем на callback
    await ctx.answerCallbackQuery(
      `Выбрано: ${selectedOption.label || selectedOption}`
    );

    // Убираем клавиатуру
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });

    return selectedOption;
  }

  /**
   * Conversation для многошаговых форм
   */
  async formConversation(conversation: any, ctx: BotConstructorContext) {
    const config = conversation.session.formConfig;

    if (!config || !config.steps || config.steps.length === 0) {
      await ctx.reply('❌ Конфигурация формы не найдена');
      return;
    }

    const formData: Record<string, any> = {};

    for (const step of config.steps) {
      let attempts = 0;
      const maxAttempts = step.maxRetries || 3;

      while (attempts < maxAttempts) {
        try {
          // Показываем шаг формы
          await ctx.reply(step.prompt || `Шаг ${step.field}:`);

          // Ожидаем ответ
          const response = await conversation.waitFor('message:text', {
            timeout: (step.timeout || 300) * 1000
          });

          const input = response.message.text.trim();

          // Валидируем
          if (this.validateInput(input, step.validation)) {
            formData[step.field] = input;

            // Подтверждаем
            if (step.successMessage) {
              await ctx.reply(step.successMessage);
            }
            break;
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              await ctx.reply(
                step.retryMessage || '❌ Неверный формат. Попробуйте еще раз.'
              );
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('timeout')) {
            await ctx.reply('⏰ Время ожидания шага истекло.');
            break;
          }
        }
      }

      if (attempts >= maxAttempts) {
        await ctx.reply('❌ Форма не заполнена корректно.');
        throw new Error('Form validation failed');
      }
    }

    // Сохраняем результат формы
    if (config.variableName) {
      BotSessionService.setSessionVariable(ctx, config.variableName, formData);
    }

    // Финальное сообщение
    if (config.successMessage) {
      await ctx.reply(config.successMessage);
    }

    return formData;
  }

  /**
   * Запуск conversation для ноды ввода
   */
  async startInputConversation(
    ctx: BotConstructorContext,
    inputConfig: any
  ): Promise<void> {
    // Сохраняем конфигурацию в сессии
    ctx.session.inputConfig = inputConfig;

    // Запускаем conversation
    await ctx.conversation.enter('input_conversation');
  }

  /**
   * Запуск conversation для подтверждения
   */
  async startConfirmationConversation(
    ctx: BotConstructorContext,
    confirmationConfig: any
  ): Promise<void> {
    ctx.session.confirmationConfig = confirmationConfig;
    await ctx.conversation.enter('confirmation_conversation');
  }

  /**
   * Запуск conversation для выбора
   */
  async startSelectionConversation(
    ctx: BotConstructorContext,
    selectionConfig: any
  ): Promise<void> {
    ctx.session.selectionConfig = selectionConfig;
    await ctx.conversation.enter('selection_conversation');
  }

  /**
   * Запуск conversation для формы
   */
  async startFormConversation(
    ctx: BotConstructorContext,
    formConfig: any
  ): Promise<void> {
    ctx.session.formConfig = formConfig;
    await ctx.conversation.enter('form_conversation');
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

  /**
   * Валидация ввода пользователя
   */
  private validateInput(input: string, validation?: any): boolean {
    if (!validation) return true;

    switch (validation.type) {
      case 'text':
        if (validation.minLength && input.length < validation.minLength)
          return false;
        if (validation.maxLength && input.length > validation.maxLength)
          return false;
        return true;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input);

      case 'phone':
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(input);

      case 'number':
        const num = Number(input);
        if (isNaN(num)) return false;
        if (validation.min !== undefined && num < validation.min) return false;
        if (validation.max !== undefined && num > validation.max) return false;
        return true;

      case 'regex':
        if (!validation.pattern) return true;
        try {
          return new RegExp(validation.pattern).test(input);
        } catch {
          return false;
        }

      case 'custom':
        // Для кастомной валидации можно добавить JavaScript функцию
        return true;

      default:
        return true;
    }
  }

  /**
   * Создание composer с conversations
   */
  static createConversationsComposer(): Composer<BotConstructorContext> {
    const composer = new Composer<BotConstructorContext>();

    // Добавляем conversations plugin
    composer.use(conversations());

    // Создаем экземпляр интеграции
    new ConversationsIntegration(composer);

    return composer;
  }
}

// Расширения для сессии
declare module '../bot-session.service' {
  interface BotConstructorSession {
    inputConfig?: any;
    confirmationConfig?: any;
    selectionConfig?: any;
    formConfig?: any;
  }
}
