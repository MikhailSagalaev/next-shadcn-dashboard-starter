/**
 * @file: src/lib/telegram/delivery-adapter.ts
 * @description: Строго типизированный поток исходящей доставки Telegram
 * @project: SaaS Bonus System
 * @dependencies: Grammy, Prisma, BotManager
 * @created: 2026-07-18
 * @author: AI Assistant + User
 */

import { GrammyError, HttpError, type Api } from 'grammy';
import { db } from '@/lib/db';
import type { TelegramBotContext } from './bot';

interface TelegramTargetByUser {
  projectId: string;
  userId: string;
  chatId?: string | number;
}

interface TelegramTargetByChat {
  projectId: string;
  userId?: undefined;
  chatId: string | number;
}

type TelegramDeliveryTarget = TelegramTargetByUser | TelegramTargetByChat;
type SendMessageOptions = NonNullable<Parameters<Api['sendMessage']>[2]>;
type SendMediaOptions = NonNullable<Parameters<Api['sendPhoto']>[2]>;
type EditMessageOptions = NonNullable<Parameters<Api['editMessageText']>[3]>;

export type TelegramParseMode = NonNullable<SendMessageOptions['parse_mode']>;
export type TelegramTextReplyMarkup = SendMessageOptions['reply_markup'];
export type TelegramMediaReplyMarkup = SendMediaOptions['reply_markup'];
export type TelegramEditReplyMarkup = EditMessageOptions['reply_markup'];

interface TelegramTextDelivery {
  kind: 'text';
  text: string;
  parseMode?: TelegramParseMode;
  replyMarkup?: TelegramTextReplyMarkup;
}
interface TelegramMediaDelivery {
  kind: 'photo' | 'video' | 'document';
  media: string;
  caption?: string;
  parseMode?: TelegramParseMode;
  replyMarkup?: TelegramMediaReplyMarkup;
  hasSpoiler?: boolean;
}

interface TelegramEditDelivery {
  kind: 'editText';
  messageId: number;
  text: string;
  parseMode?: TelegramParseMode;
  replyMarkup?: TelegramEditReplyMarkup;
}

interface TelegramDeleteDelivery {
  kind: 'delete';
  messageId: number;
}

export type TelegramDeliveryRequest = TelegramDeliveryTarget &
  (
    | TelegramTextDelivery
    | TelegramMediaDelivery
    | TelegramEditDelivery
    | TelegramDeleteDelivery
  );

export interface TelegramDeliverySuccess {
  success: true;
  projectId: string;
  userId?: string;
  chatId: string;
  messageId: number;
  message_id: number;
  parseFallbackUsed: boolean;
}

export interface TelegramDeliveryFailure {
  success: false;
  projectId: string;
  userId?: string;
  errorCode: number | string;
  description: string;
  retryAfter?: number;
  transient: boolean;
}

export type TelegramDeliveryResult =
  | TelegramDeliverySuccess
  | TelegramDeliveryFailure;

export class TelegramDeliveryError extends Error {
  constructor(public readonly failure: TelegramDeliveryFailure) {
    super(failure.description);
    this.name = 'TelegramDeliveryError';
  }
}

function failure(
  request: TelegramDeliveryRequest,
  errorCode: number | string,
  description: string,
  transient: boolean,
  retryAfter?: number
): TelegramDeliveryFailure {
  return {
    success: false,
    projectId: request.projectId,
    userId: request.userId,
    errorCode,
    description,
    transient,
    ...(retryAfter === undefined ? {} : { retryAfter })
  };
}

function normalizeError(
  request: TelegramDeliveryRequest,
  error: unknown
): TelegramDeliveryFailure {
  if (error instanceof GrammyError) {
    const retryAfter = error.parameters.retry_after;
    const transient = error.error_code === 429 || error.error_code >= 500;
    return failure(
      request,
      error.error_code,
      error.description,
      transient,
      retryAfter
    );
  }

  if (error instanceof HttpError) {
    return failure(request, 'NETWORK_ERROR', error.message, true);
  }

  return failure(
    request,
    'DELIVERY_ERROR',
    error instanceof Error ? error.message : 'Unknown Telegram delivery error',
    false
  );
}

function isParseEntityError(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 400 &&
    /parse|entit(?:y|ies)|end tag|start tag/i.test(error.description)
  );
}
async function resolveChatAndBot(request: TelegramDeliveryRequest): Promise<{
  bot: import('grammy').Bot<TelegramBotContext>;
  chatId: string;
}> {
  const settings = await db.botSettings.findUnique({
    where: { projectId: request.projectId },
    select: {
      botToken: true,
      botUsername: true,
      isActive: true,
      project: { select: { id: true } }
    }
  });

  if (!settings || settings.project.id !== request.projectId) {
    throw new TelegramDeliveryError(
      failure(
        request,
        403,
        'Telegram bot does not belong to this project',
        false
      )
    );
  }
  if (!settings.isActive) {
    throw new TelegramDeliveryError(
      failure(request, 403, 'Telegram bot is inactive for this project', false)
    );
  }

  let chatId = request.chatId?.toString();
  if (request.userId) {
    const user = await db.user.findFirst({
      where: { id: request.userId, projectId: request.projectId },
      select: { telegramId: true }
    });
    if (!user) {
      throw new TelegramDeliveryError(
        failure(request, 403, 'User does not belong to this project', false)
      );
    }
    if (!user.telegramId) {
      throw new TelegramDeliveryError(
        failure(request, 400, 'User is not linked to Telegram', false)
      );
    }

    const ownedChatId = user.telegramId.toString();
    if (chatId !== undefined && chatId !== ownedChatId) {
      throw new TelegramDeliveryError(
        failure(
          request,
          403,
          'Telegram chat does not belong to this user',
          false
        )
      );
    }
    chatId = ownedChatId;
  }

  if (!chatId) {
    throw new TelegramDeliveryError(
      failure(request, 400, 'Telegram chat is required', false)
    );
  }

  const { botManager } = await import('./bot-manager');
  let instance = botManager.getBot(request.projectId);
  if (!instance?.isActive) {
    instance = await botManager.createBot(request.projectId, settings);
  }
  if (!instance.isActive) {
    throw new TelegramDeliveryError(
      failure(request, 503, 'Telegram bot could not be activated', true)
    );
  }

  return { bot: instance.bot, chatId };
}

async function sendOnce(
  bot: import('grammy').Bot<TelegramBotContext>,
  chatId: string,
  request: TelegramDeliveryRequest,
  includeParseMode: boolean
): Promise<number> {
  if (request.kind === 'text') {
    const sent = await bot.api.sendMessage(chatId, request.text, {
      ...(includeParseMode && request.parseMode
        ? { parse_mode: request.parseMode }
        : {}),
      ...(request.replyMarkup ? { reply_markup: request.replyMarkup } : {})
    });
    return sent.message_id;
  }

  if (request.kind === 'photo') {
    const sent = await bot.api.sendPhoto(chatId, request.media, {
      ...(request.caption === undefined ? {} : { caption: request.caption }),
      ...(includeParseMode && request.parseMode
        ? { parse_mode: request.parseMode }
        : {}),
      ...(request.replyMarkup ? { reply_markup: request.replyMarkup } : {}),
      ...(request.hasSpoiler === undefined
        ? {}
        : { has_spoiler: request.hasSpoiler })
    });
    return sent.message_id;
  }
  if (request.kind === 'video') {
    const sent = await bot.api.sendVideo(chatId, request.media, {
      ...(request.caption === undefined ? {} : { caption: request.caption }),
      ...(includeParseMode && request.parseMode
        ? { parse_mode: request.parseMode }
        : {}),
      ...(request.replyMarkup ? { reply_markup: request.replyMarkup } : {}),
      ...(request.hasSpoiler === undefined
        ? {}
        : { has_spoiler: request.hasSpoiler })
    });
    return sent.message_id;
  }

  if (request.kind === 'document') {
    const sent = await bot.api.sendDocument(chatId, request.media, {
      ...(request.caption === undefined ? {} : { caption: request.caption }),
      ...(includeParseMode && request.parseMode
        ? { parse_mode: request.parseMode }
        : {}),
      ...(request.replyMarkup ? { reply_markup: request.replyMarkup } : {})
    });
    return sent.message_id;
  }

  if (request.kind === 'editText') {
    const edited = await bot.api.editMessageText(
      chatId,
      request.messageId,
      request.text,
      {
        ...(includeParseMode && request.parseMode
          ? { parse_mode: request.parseMode }
          : {}),
        ...(request.replyMarkup ? { reply_markup: request.replyMarkup } : {})
      }
    );
    return edited === true ? request.messageId : edited.message_id;
  }

  if (request.kind === 'delete') {
    await bot.api.deleteMessage(chatId, request.messageId);
    return request.messageId;
  }

  throw new Error('Unsupported Telegram delivery kind');
}

export async function deliverTelegram(
  request: TelegramDeliveryRequest
): Promise<TelegramDeliveryResult> {
  try {
    const { bot, chatId } = await resolveChatAndBot(request);
    try {
      const messageId = await sendOnce(bot, chatId, request, true);
      return {
        success: true,
        projectId: request.projectId,
        userId: request.userId,
        chatId,
        messageId,
        message_id: messageId,
        parseFallbackUsed: false
      };
    } catch (error) {
      const hasParseMode =
        request.kind !== 'delete' && request.parseMode !== undefined;
      if (!hasParseMode || !isParseEntityError(error)) {
        return normalizeError(request, error);
      }

      try {
        const messageId = await sendOnce(bot, chatId, request, false);
        return {
          success: true,
          projectId: request.projectId,
          userId: request.userId,
          chatId,
          messageId,
          message_id: messageId,
          parseFallbackUsed: true
        };
      } catch (fallbackError) {
        return normalizeError(request, fallbackError);
      }
    }
  } catch (error) {
    if (error instanceof TelegramDeliveryError) {
      return error.failure;
    }
    return normalizeError(request, error);
  }
}
