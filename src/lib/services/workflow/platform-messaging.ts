/**
 * @file: src/lib/services/workflow/platform-messaging.ts
 * @description: Платформо-независимый хелпер для отправки сообщений
 *               из workflow handlers (Telegram / MAX)
 * @project: SaaS Bonus System
 * @created: 2026-03-22
 * @updated: 2026-03-22
 * @author: AI Assistant + User
 *
 * ВАЖНО: MAX API использует другой формат параметров, чем Telegram:
 *   - format: 'html' | 'markdown' (вместо parse_mode: 'HTML')
 *   - attachments: [...] (вместо reply_markup) — клавиатуры и медиа
 *   - ctx.reply(text, extra: SendMessageExtra)
 *   - ctx.editMessage(extra: EditMessageExtra) — НЕ editMessageText
 *   - ctx.deleteMessage(messageId?: string) — строка, не число
 *   - Keyboard.button.callback(text, payload) — 2 обязательных аргумента
 */

import type { ExecutionContext } from '@/types/workflow';
import { logger } from '@/lib/logger';

// ========== ПУБЛИЧНЫЕ ХЕЛПЕРЫ ==========

/**
 * Отправляет текстовое сообщение пользователю через текущую платформу.
 * Определяет платформу по context.platform и маршрутизирует вызов.
 */
export async function sendPlatformMessage(
  context: ExecutionContext,
  text: string,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: any;
  } = {}
): Promise<void> {
  const platform = context.platform || 'telegram';

  if (platform === 'max') {
    await sendMaxMessage(context, text, options);
  } else {
    await sendTelegramMessage(context, text, options);
  }
}

/**
 * Отправляет медиа-сообщение (фото, видео, документ) через текущую платформу.
 */
export async function sendPlatformMedia(
  context: ExecutionContext,
  type: 'photo' | 'video' | 'document',
  fileUrlOrId: string,
  options: {
    caption?: string;
    parseMode?: string;
    replyMarkup?: any;
    hasSpoiler?: boolean;
  } = {}
): Promise<void> {
  const platform = context.platform || 'telegram';

  if (platform === 'max') {
    await sendMaxMedia(context, type, fileUrlOrId, options);
  } else {
    await sendTelegramMedia(context, type, fileUrlOrId, options);
  }
}

/**
 * Выполняет действие с сообщением (удаление, редактирование текста)
 */
export async function sendPlatformAction(
  context: ExecutionContext,
  action: 'delete' | 'edit_text',
  options: {
    messageId: string | number;
    text?: string;
    parseMode?: string;
    replyMarkup?: any;
  }
): Promise<void> {
  const platform = context.platform || 'telegram';

  if (platform === 'max') {
    await sendMaxAction(context, action, options);
  } else {
    await sendTelegramAction(context, action, options);
  }
}

// ========== TELEGRAM ==========

async function sendTelegramMessage(
  context: ExecutionContext,
  text: string,
  options: {
    parseMode?: string;
    replyMarkup?: any;
  }
): Promise<void> {
  const apiRoot = process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org';
  const telegramApiUrl = `${apiRoot}/bot${context.telegram.botToken}/sendMessage`;

  const payload: any = {
    chat_id: context.telegram.chatId,
    text,
    parse_mode: options.parseMode || 'HTML'
  };

  if (options.replyMarkup) {
    payload.reply_markup = options.replyMarkup;
  }

  await context.services.http.post(telegramApiUrl, payload);
}

async function sendTelegramMedia(
  context: ExecutionContext,
  type: string,
  file: string,
  options: any
): Promise<void> {
  const method =
    type === 'photo'
      ? 'sendPhoto'
      : type === 'video'
        ? 'sendVideo'
        : 'sendDocument';
  const apiRoot = process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org';
  const telegramApiUrl = `${apiRoot}/bot${context.telegram.botToken}/${method}`;

  const payload: any = {
    chat_id: context.telegram.chatId,
    [type]: file,
    caption: options.caption,
    parse_mode: options.parseMode || 'HTML',
    has_spoiler: options.hasSpoiler,
    reply_markup: options.replyMarkup
  };

  await context.services.http.post(telegramApiUrl, payload);
}

async function sendTelegramAction(
  context: ExecutionContext,
  action: string,
  options: any
): Promise<void> {
  const method = action === 'delete' ? 'deleteMessage' : 'editMessageText';
  const apiRoot = process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org';
  const telegramApiUrl = `${apiRoot}/bot${context.telegram.botToken}/${method}`;

  const payload: any = {
    chat_id: context.telegram.chatId,
    message_id: options.messageId
  };

  if (action === 'edit_text') {
    payload.text = options.text;
    payload.parse_mode = options.parseMode || 'HTML';
    payload.reply_markup = options.replyMarkup;
  }

  await context.services.http.post(telegramApiUrl, payload);
}

// ========== MAX ==========

/**
 * Маппинг parse_mode в format для MAX API.
 * MAX поддерживает: 'html' | 'markdown' | null
 * Telegram использует: 'HTML' | 'Markdown' | 'MarkdownV2'
 */
function telegramParseModeToMaxFormat(
  parseMode?: string
): 'html' | 'markdown' | undefined {
  if (!parseMode) return 'html'; // По умолчанию html
  const lower = parseMode.toLowerCase();
  if (lower === 'html') return 'html';
  if (lower.startsWith('markdown')) return 'markdown';
  return undefined;
}

/**
 * Конвертирует Telegram reply_markup (inline_keyboard / keyboard) в формат MAX.
 *
 * MAX формат клавиатуры (InlineKeyboardAttachmentRequest):
 *   { type: 'inline_keyboard', payload: { buttons: Button[][] } }
 * Типы кнопок MAX:
 *   Keyboard.button.callback(text, payload, extra?)
 *   Keyboard.button.link(text, url)
 *   Keyboard.button.requestContact(text)
 *   Keyboard.button.requestGeoLocation(text, extra?)
 */
function convertTelegramKeyboardToMax(telegramReplyMarkup: any): any {
  try {
    const Keyboard = require('@maxhub/max-bot-api').Keyboard;

    if (telegramReplyMarkup?.inline_keyboard) {
      // Telegram inline keyboard → MAX inline keyboard
      const maxButtons = telegramReplyMarkup.inline_keyboard.map((row: any[]) =>
        row.map((btn: any) => {
          if (btn.url) {
            return Keyboard.button.link(btn.text, btn.url);
          }
          if (btn.callback_data) {
            // MAX callback требует payload (строка), используем callback_data
            return Keyboard.button.callback(btn.text, btn.callback_data);
          }
          // Fallback: используем текст как payload
          return Keyboard.button.callback(btn.text, btn.text);
        })
      );

      return Keyboard.inlineKeyboard(maxButtons);
    }

    // Telegram reply keyboard (request_contact и т.д.) → MAX inline keyboard
    if (telegramReplyMarkup?.keyboard) {
      const maxButtons = telegramReplyMarkup.keyboard.map((row: any[]) =>
        row.map((btn: any) => {
          if (btn.request_contact) {
            return Keyboard.button.requestContact(btn.text);
          }
          if (btn.request_location) {
            return Keyboard.button.requestGeoLocation(btn.text);
          }
          // Обычная текстовая кнопка → callback с текстом в payload
          return Keyboard.button.callback(btn.text, btn.text);
        })
      );

      return Keyboard.inlineKeyboard(maxButtons);
    }

    return null;
  } catch (error) {
    logger.warn('[MAX] Ошибка конвертации клавиатуры Telegram → MAX', {
      error: error instanceof Error ? error.message : 'Unknown'
    });
    return null;
  }
}

/**
 * Отправка текста через MAX API.
 *
 * Используем ctx.reply(text, SendMessageExtra):
 *   SendMessageExtra = { format?, attachments?, link?, notify?, disable_link_preview? }
 *
 * Если ctx недоступен — fallback через MaxBotManager.sendMessageToUser(userId: number, text)
 */
async function sendMaxMessage(
  context: ExecutionContext,
  text: string,
  options: {
    parseMode?: string;
    replyMarkup?: any;
  }
): Promise<void> {
  try {
    const maxContext = (context as any)._maxContext;

    if (maxContext && typeof maxContext.reply === 'function') {
      // Формируем SendMessageExtra по документации MAX
      const extra: any = {
        format: telegramParseModeToMaxFormat(options.parseMode)
      };

      // Клавиатура передаётся через attachments, не reply_markup
      if (options.replyMarkup) {
        const maxKeyboard = convertTelegramKeyboardToMax(options.replyMarkup);
        if (maxKeyboard) {
          extra.attachments = [maxKeyboard];
        }
      }

      await maxContext.reply(text, extra);
    } else {
      // Fallback: отправляем через MaxBotManager
      const { maxBotManager } = await import('@/lib/max-bot/bot-manager');

      const userId = context.telegram.userId;
      if (userId) {
        await maxBotManager.sendMessageToUser(
          context.projectId,
          Number(userId),
          text
        );
      }
    }
  } catch (error) {
    logger.error('[MAX] Ошибка отправки сообщения из workflow', {
      projectId: context.projectId,
      executionId: context.executionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Отправка медиа через MAX.
 *
 * В MAX медиа передаются как attachments внутри SendMessageExtra.
 * Типы вложений: 'image', 'video', 'file', 'audio'.
 * Для отправки по URL нужно сначала загрузить через bot.api.upload*,
 * получить payload.token и передать его.
 * Упрощённая версия: передаём URL напрямую для image.
 */
async function sendMaxMedia(
  context: ExecutionContext,
  type: string,
  file: string,
  options: any
): Promise<void> {
  const maxContext = (context as any)._maxContext;
  const text = options.caption || '';

  // Маппинг типа: photo → image (MAX тип)
  const maxType =
    type === 'photo' ? 'image' : type === 'document' ? 'file' : type;

  const extra: any = {
    format: telegramParseModeToMaxFormat(options.parseMode)
  };

  // Формируем вложение согласно AttachmentRequest
  const mediaAttachment: any = {
    type: maxType,
    payload: {}
  };

  if (file.startsWith('http') && maxType === 'image') {
    // Для image можно передать url в payload
    mediaAttachment.payload.url = file;
  } else {
    // Для других типов нужен token (получаемый через upload)
    mediaAttachment.payload.token = file;
  }

  extra.attachments = [mediaAttachment];

  // Добавляем клавиатуру, если есть
  if (options.replyMarkup) {
    const maxKeyboard = convertTelegramKeyboardToMax(options.replyMarkup);
    if (maxKeyboard) {
      extra.attachments.push(maxKeyboard);
    }
  }

  if (maxContext?.reply) {
    await maxContext.reply(text, extra);
  } else {
    const { maxBotManager } = await import('@/lib/max-bot/bot-manager');
    const userId = Number(context.telegram.userId);
    if (!isNaN(userId)) {
      await maxBotManager.sendMessageToUser(context.projectId, userId, text);
    }
  }
}

/**
 * Действия (delete / edit_text) через MAX.
 *
 * MAX API:
 *   ctx.deleteMessage(messageId?: string) — удаление
 *   ctx.editMessage(EditMessageExtra) — редактирование
 *   EditMessageExtra = { message_id: string; text?: string; attachments?; format? }
 */
async function sendMaxAction(
  context: ExecutionContext,
  action: string,
  options: any
): Promise<void> {
  const maxContext = (context as any)._maxContext;

  if (!maxContext) {
    logger.warn('[MAX] Нет доступа к MAX контексту для выполнения действия', {
      action,
      executionId: context.executionId
    });
    return;
  }

  if (action === 'delete') {
    // ctx.deleteMessage(messageId?: string)
    const messageId = options.messageId ? String(options.messageId) : undefined;
    await maxContext.deleteMessage(messageId);
  } else if (action === 'edit_text') {
    // ctx.editMessage(EditMessageExtra)
    // EditMessageExtra = Omit<FlattenReq<EditMessageDTO>, 'message_id'>
    // EditMessageDTO.body = SendMessageDTO.body (text, attachments, format, ...)
    const editExtra: any = {
      text: options.text,
      format: telegramParseModeToMaxFormat(options.parseMode)
    };

    if (options.replyMarkup) {
      const maxKeyboard = convertTelegramKeyboardToMax(options.replyMarkup);
      if (maxKeyboard) {
        editExtra.attachments = [maxKeyboard];
      }
    }

    await maxContext.editMessage(editExtra);
  }
}
