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
import {
  deliverTelegram,
  TelegramDeliveryError,
  type TelegramDeliveryRequest,
  type TelegramEditReplyMarkup,
  type TelegramMediaReplyMarkup,
  type TelegramParseMode,
  type TelegramTextReplyMarkup
} from '@/lib/telegram/delivery-adapter';

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
    replyMarkup?: unknown;
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
    replyMarkup?: unknown;
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
    replyMarkup?: unknown;
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

function telegramTarget(context: ExecutionContext) {
  return context.userId
    ? {
        projectId: context.projectId,
        userId: context.userId,
        chatId: context.telegram.chatId
      }
    : { projectId: context.projectId, chatId: context.telegram.chatId };
}

function normalizeTelegramParseMode(parseMode?: string): TelegramParseMode {
  if (
    parseMode === 'Markdown' ||
    parseMode === 'MarkdownV2' ||
    parseMode === 'HTML'
  ) {
    return parseMode;
  }
  return 'HTML';
}

function normalizeReplyMarkup<T>(replyMarkup: unknown): T | undefined {
  return typeof replyMarkup === 'object' && replyMarkup !== null
    ? (replyMarkup as T)
    : undefined;
}

async function requireTelegramDelivery(
  request: TelegramDeliveryRequest
): Promise<void> {
  const result = await deliverTelegram(request);
  if (result.success === false) {
    throw new TelegramDeliveryError(result);
  }
}

async function sendTelegramMessage(
  context: ExecutionContext,
  text: string,
  options: {
    parseMode?: string;
    replyMarkup?: unknown;
  }
): Promise<void> {
  await requireTelegramDelivery({
    ...telegramTarget(context),
    kind: 'text',
    text,
    parseMode: normalizeTelegramParseMode(options.parseMode),
    replyMarkup: normalizeReplyMarkup<TelegramTextReplyMarkup>(
      options.replyMarkup
    )
  });
}

async function sendTelegramMedia(
  context: ExecutionContext,
  type: 'photo' | 'video' | 'document',
  file: string,
  options: {
    caption?: string;
    parseMode?: string;
    replyMarkup?: unknown;
    hasSpoiler?: boolean;
  }
): Promise<void> {
  await requireTelegramDelivery({
    ...telegramTarget(context),
    kind: type,
    media: file,
    caption: options.caption,
    parseMode: normalizeTelegramParseMode(options.parseMode),
    replyMarkup: normalizeReplyMarkup<TelegramMediaReplyMarkup>(
      options.replyMarkup
    ),
    hasSpoiler: options.hasSpoiler
  });
}

async function sendTelegramAction(
  context: ExecutionContext,
  action: 'delete' | 'edit_text',
  options: {
    messageId: string | number;
    text?: string;
    parseMode?: string;
    replyMarkup?: unknown;
  }
): Promise<void> {
  const messageId = Number(options.messageId);
  if (!Number.isSafeInteger(messageId)) {
    throw new Error('Telegram messageId must be a safe integer');
  }

  if (action === 'delete') {
    await requireTelegramDelivery({
      ...telegramTarget(context),
      kind: 'delete',
      messageId
    });
    return;
  }

  if (options.text === undefined) {
    throw new Error('Telegram edit_text action requires text');
  }
  await requireTelegramDelivery({
    ...telegramTarget(context),
    kind: 'editText',
    messageId,
    text: options.text,
    parseMode: normalizeTelegramParseMode(options.parseMode),
    replyMarkup: normalizeReplyMarkup<TelegramEditReplyMarkup>(
      options.replyMarkup
    )
  });
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

interface MaxKeyboardFactory {
  button: {
    link: (text: string, url: string) => unknown;
    callback: (text: string, payload: string) => unknown;
    requestContact: (text: string) => unknown;
    requestGeoLocation: (text: string) => unknown;
  };
  inlineKeyboard: (buttons: unknown[][]) => unknown;
}

interface MaxMessageExtra {
  text?: string;
  format?: 'html' | 'markdown';
  attachments?: unknown[];
}

interface MaxContextLike {
  reply: (text: string, extra: MaxMessageExtra) => Promise<unknown>;
  deleteMessage: (messageId?: string) => Promise<unknown>;
  editMessage: (extra: MaxMessageExtra) => Promise<unknown>;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getMaxContext(context: ExecutionContext): MaxContextLike | undefined {
  const candidate = (context as ExecutionContext & { _maxContext?: unknown })
    ._maxContext;
  return isObjectRecord(candidate)
    ? (candidate as unknown as MaxContextLike)
    : undefined;
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
export function convertTelegramKeyboardToMax(
  telegramReplyMarkup: unknown
): unknown {
  try {
    if (!isObjectRecord(telegramReplyMarkup)) return null;
    const { Keyboard } = require('@maxhub/max-bot-api') as {
      Keyboard: MaxKeyboardFactory;
    };

    if (Array.isArray(telegramReplyMarkup.inline_keyboard)) {
      const maxButtons = telegramReplyMarkup.inline_keyboard.map((row) =>
        Array.isArray(row)
          ? row.map((button) => {
              if (!isObjectRecord(button) || typeof button.text !== 'string') {
                throw new Error('Invalid Telegram inline keyboard button');
              }
              if (typeof button.url === 'string') {
                return Keyboard.button.link(button.text, button.url);
              }
              if (typeof button.callback_data === 'string') {
                return Keyboard.button.callback(
                  button.text,
                  button.callback_data
                );
              }
              return Keyboard.button.callback(button.text, button.text);
            })
          : []
      );
      return Keyboard.inlineKeyboard(maxButtons);
    }

    if (Array.isArray(telegramReplyMarkup.keyboard)) {
      const maxButtons = telegramReplyMarkup.keyboard.map((row) =>
        Array.isArray(row)
          ? row.map((button) => {
              if (!isObjectRecord(button) || typeof button.text !== 'string') {
                throw new Error('Invalid Telegram reply keyboard button');
              }
              if (button.request_contact) {
                return Keyboard.button.requestContact(button.text);
              }
              if (button.request_location) {
                return Keyboard.button.requestGeoLocation(button.text);
              }
              return Keyboard.button.callback(button.text, button.text);
            })
          : []
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
    replyMarkup?: unknown;
  }
): Promise<void> {
  try {
    const maxContext = getMaxContext(context);

    if (maxContext && typeof maxContext.reply === 'function') {
      // Формируем SendMessageExtra по документации MAX
      const extra: MaxMessageExtra = {
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
  options: {
    caption?: string;
    parseMode?: string;
    replyMarkup?: unknown;
    hasSpoiler?: boolean;
  }
): Promise<void> {
  const maxContext = getMaxContext(context);
  const text = options.caption || '';

  // Маппинг типа: photo → image (MAX тип)
  const maxType =
    type === 'photo' ? 'image' : type === 'document' ? 'file' : type;

  const extra: MaxMessageExtra = {
    format: telegramParseModeToMaxFormat(options.parseMode)
  };

  // Формируем вложение согласно AttachmentRequest
  const mediaAttachment: {
    type: string;
    payload: Record<string, unknown>;
  } = {
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
  options: {
    messageId: string | number;
    text?: string;
    parseMode?: string;
    replyMarkup?: unknown;
  }
): Promise<void> {
  const maxContext = getMaxContext(context);

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
    const editExtra: MaxMessageExtra = {
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
