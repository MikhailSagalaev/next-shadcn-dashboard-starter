/**
 * @file: src/lib/telegram/notifications.ts
 * @description: Система уведомлений для Telegram ботов
 * @project: SaaS Bonus System
 * @dependencies: Grammy, BotManager
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { maxBotManager } from '../max-bot/bot-manager';
import type { User, Bonus, BonusType } from '@/types/bonus';
import { logger } from '@/lib/logger';
import {
  deliverTelegram,
  TelegramDeliveryError,
  type TelegramDeliveryResult,
  type TelegramMediaReplyMarkup,
  type TelegramTextReplyMarkup
} from './delivery-adapter';

interface ReferralBonusDetails {
  metadata?: unknown;
  referralUserId?: string | null;
  referralLevel?: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function sendTelegramNotification(
  projectId: string,
  userId: string,
  text: string
): Promise<number> {
  const result = await deliverTelegram({
    kind: 'text',
    projectId,
    userId,
    text,
    parseMode: 'Markdown'
  });
  if (result.success === false) {
    throw new TelegramDeliveryError(result);
  }
  return result.messageId;
}

/**
 * Отправка уведомления о начислении бонусов
 */
export async function sendBonusNotification(
  user: User,
  bonus: Bonus,
  projectId: string
): Promise<void> {
  if (!user.telegramId && !user.maxId) {
    return; // Пользователь не связан ни с одной платформой
  }

  try {
    const emoji = getBonusEmoji(bonus.type);
    const typeText = getBonusTypeText(bonus.type);

    // Phase 5.6: для реферальной комиссии обогащаем текст именем клиента
    // и уровнем (если они есть в bonus.metadata / на самом бонусе).
    let message: string;
    if (bonus.type === 'REFERRAL') {
      const details = bonus as Bonus & ReferralBonusDetails;
      const meta = isRecord(details.metadata) ? details.metadata : {};
      const metaReferredUserId =
        typeof meta.referredUserId === 'string'
          ? meta.referredUserId
          : typeof meta.sourceUserId === 'string'
            ? meta.sourceUserId
            : undefined;
      const referredUserId =
        metaReferredUserId ?? details.referralUserId ?? undefined;
      const metaLevel = typeof meta.level === 'number' ? meta.level : undefined;
      const level = metaLevel ?? details.referralLevel ?? undefined;

      let clientName = 'клиента';
      if (referredUserId) {
        try {
          const { db } = await import('@/lib/db');
          const ref = await db.user.findUnique({
            where: { id: referredUserId },
            select: { firstName: true, lastName: true, phone: true }
          });
          if (ref) {
            const fn = (ref.firstName ?? '').trim();
            const ln = (ref.lastName ?? '').trim();
            const full = `${fn} ${ln}`.trim();
            clientName = full || ref.phone || clientName;
          }
        } catch (err) {
          // Не падаем — оставляем дефолт «клиента».
          logger.warn('Не удалось загрузить имя клиента-источника', {
            referredUserId,
            err: err instanceof Error ? err.message : String(err)
          });
        }
      }
      const levelStr = level ? ` (уровень ${level})` : '';
      message = `💰 *Вам начислено ${bonus.amount} ₽ за покупку клиента ${clientName}${levelStr}*`;
    } else {
      message =
        `${emoji} *Новые бонусы начислены!*\n\n` +
        `💰 Сумма: *+${bonus.amount} бонусов*\n` +
        `📝 Тип: ${typeText}\n` +
        `📄 Описание: ${bonus.description || 'Без описания'}\n\n` +
        `⏰ Срок действия: ${bonus.expiresAt ? bonus.expiresAt.toLocaleDateString('ru-RU') : 'Бессрочно'}`;
    }

    // Отправляем в Telegram если есть ID
    if (user.telegramId) {
      const messageId = await sendTelegramNotification(
        projectId,
        user.id,
        message
      );
      logger.info(`Уведомление отправлено пользователю ${user.id} в Telegram`, {
        telegramId: user.telegramId,
        messageId,
        projectId
      });
    }

    // Отправляем в MAX если есть ID
    if (user.maxId) {
      await maxBotManager.sendMessageToUser(
        projectId,
        Number(user.maxId),
        message.replace(/\*/g, '') // MAX может не поддерживать Markdown в таком виде, упрощаем
      );
      logger.info(`Уведомление отправлено пользователю ${user.id} в MAX`, {
        maxId: user.maxId,
        projectId
      });
    }
  } catch (error) {
    logger.error(`Ошибка отправки уведомления пользователю ${user.id}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId,
      telegramId: user.telegramId
    });
  }
}

/**
 * Отправка уведомления о списании бонусов
 */
export async function sendBonusSpentNotification(
  user: User,
  amount: number,
  description: string,
  projectId: string
): Promise<void> {
  try {
    const message =
      `💸 *Бонусы потрачены*\n\n` +
      `💰 Сумма: *-${amount} бонусов*\n` +
      `📄 За: ${description}\n\n` +
      `Спасибо за покупку!`;

    // Telegram
    if (user.telegramId) {
      await sendTelegramNotification(projectId, user.id, message);
    }

    // MAX
    if (user.maxId) {
      await maxBotManager.sendMessageToUser(
        projectId,
        Number(user.maxId),
        message.replace(/\*/g, '')
      );
    }
  } catch (error) {
    logger.error(
      `Ошибка отправки уведомления о списании пользователю ${user.id}`,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId
      }
    );
  }
}

/**
 * Отправка уведомления о скором истечении бонусов
 */
export async function sendBonusExpiryWarning(
  user: User,
  expiringAmount: number,
  expiryDate: Date,
  projectId: string
): Promise<void> {
  try {
    const daysLeft = Math.ceil(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const message =
      `⚠️ *Внимание! Бонусы скоро истекут*\n\n` +
      `💰 Сумма: *${expiringAmount} бонусов*\n` +
      `📅 Истекают: ${expiryDate.toLocaleDateString('ru-RU')}\n` +
      `⏰ Осталось дней: *${daysLeft}*\n\n` +
      `Поспешите воспользоваться бонусами! 🏃‍♂️`;

    // Telegram
    if (user.telegramId) {
      await sendTelegramNotification(projectId, user.id, message);
    }

    // MAX
    if (user.maxId) {
      await maxBotManager.sendMessageToUser(
        projectId,
        Number(user.maxId),
        message.replace(/\*/g, '')
      );
    }
  } catch (error) {
    logger.error(
      `Ошибка отправки предупреждения об истечении пользователю ${user.id}`,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId
      }
    );
  }
}

/**
 * Интерфейс для расширенного уведомления
 */
export interface RichNotification {
  message: string;
  imageUrl?: string;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
  parseMode?: 'Markdown' | 'HTML';
  disableLinkPreview?: boolean;
}

export interface BroadcastRecipientResult {
  userId: string;
  success: boolean;
  error?: string;
  errorCode?: number | string;
  retryAfter?: number;
  transient?: boolean;
  skipped?: boolean;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  results: BroadcastRecipientResult[];
}

/**
 * Массовая отправка Telegram-уведомлений пользователям проекта.
 * Пользователи без активной Telegram-привязки не считаются ошибками доставки:
 * они учитываются отдельно в `skipped`.
 */
export async function sendBroadcastMessage(
  projectId: string,
  message: string,
  userIds?: string[]
): Promise<BroadcastResult> {
  return sendRichBroadcastMessage(projectId, { message }, userIds);
}

/**
 * Расширенная Telegram-рассылка с поддержкой медиа и кнопок.
 * MAX намеренно не вызывается: канал выбирается вызывающим кодом, а прежняя
 * отправка в оба мессенджера давала ложные ошибки для каждого получателя.
 */
export async function sendRichBroadcastMessage(
  projectId: string,
  notification: RichNotification,
  userIds?: string[]
): Promise<BroadcastResult> {
  try {
    const { db } = await import('@/lib/db');
    const requestedIds = userIds ? Array.from(new Set(userIds)) : undefined;
    const users = await db.user.findMany({
      where: {
        projectId,
        ...(requestedIds ? { id: { in: requestedIds } } : {}),
        telegramId: { not: null },
        isActive: true
      },
      select: { id: true }
    });
    const telegramUserIds = users.map((user) => user.id);
    const total = requestedIds
      ? requestedIds.length
      : await db.user.count({ where: { projectId } });
    const skipped = Math.max(0, total - telegramUserIds.length);

    type NotificationButton =
      | { text: string; url: string }
      | { text: string; callback_data: string };
    const validButtons: NotificationButton[] = [];
    for (const button of notification.buttons ?? []) {
      if (button.url) {
        validButtons.push({ text: button.text, url: button.url });
      } else if (button.callback_data) {
        validButtons.push({
          text: button.text,
          callback_data: button.callback_data
        });
      }
    }
    const rows: NotificationButton[][] = [];
    for (let index = 0; index < validButtons.length; index += 2) {
      rows.push(validButtons.slice(index, index + 2));
    }
    const replyMarkup =
      rows.length > 0
        ? ({ inline_keyboard: rows } as TelegramMediaReplyMarkup &
            TelegramTextReplyMarkup)
        : undefined;

    const deliveryResults: BroadcastRecipientResult[] = [];
    const concurrency = 20;
    const sendToUser = async (
      userId: string
    ): Promise<TelegramDeliveryResult> => {
      if (!notification.imageUrl) {
        return deliverTelegram({
          kind: 'text',
          projectId,
          userId,
          text: notification.message,
          parseMode: notification.parseMode ?? 'Markdown',
          replyMarkup,
          disableLinkPreview: notification.disableLinkPreview
        });
      }

      // Telegram ограничивает подпись к изображению 1024 символами. Для
      // длинного текста сначала отправляем изображение, затем обычное сообщение.
      if (notification.message.length > 1024) {
        const photoResult = await deliverTelegram({
          kind: 'photo',
          projectId,
          userId,
          media: notification.imageUrl
        });
        if (photoResult.success === false) return photoResult;
        return deliverTelegram({
          kind: 'text',
          projectId,
          userId,
          text: notification.message,
          parseMode: notification.parseMode ?? 'Markdown',
          replyMarkup,
          disableLinkPreview: notification.disableLinkPreview
        });
      }

      return deliverTelegram({
        kind: 'photo',
        projectId,
        userId,
        media: notification.imageUrl,
        caption: notification.message,
        parseMode: notification.parseMode ?? 'Markdown',
        replyMarkup
      });
    };

    for (let index = 0; index < telegramUserIds.length; index += concurrency) {
      const batch = telegramUserIds.slice(index, index + concurrency);
      const results = await Promise.all(batch.map(sendToUser));
      results.forEach((result, resultIndex) => {
        const userId = batch[resultIndex];
        if (result.success === true) {
          deliveryResults.push({ userId, success: true });
          return;
        }
        deliveryResults.push({
          userId,
          success: false,
          error: result.description,
          errorCode: result.errorCode,
          retryAfter: result.retryAfter,
          transient: result.transient
        });
        logger.error('Ошибка Telegram-рассылки', {
          projectId,
          userId,
          errorCode: result.errorCode,
          error: result.description,
          transient: result.transient,
          retryAfter: result.retryAfter
        });
      });
    }

    if (requestedIds && skipped > 0) {
      const eligibleIds = new Set(telegramUserIds);
      for (const userId of requestedIds) {
        if (!eligibleIds.has(userId)) {
          deliveryResults.push({
            userId,
            success: false,
            skipped: true,
            error: 'Пользователь неактивен или не привязан к Telegram'
          });
        }
      }
    }

    const sent = deliveryResults.filter((result) => result.success).length;
    const failed = deliveryResults.filter(
      (result) => !result.success && !result.skipped
    ).length;

    logger.info('Telegram-рассылка завершена', {
      projectId,
      total,
      eligible: telegramUserIds.length,
      sent,
      failed,
      skipped
    });

    return { sent, failed, skipped, total, results: deliveryResults };
  } catch (error) {
    logger.error('Ошибка массовой Telegram-рассылки', {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId
    });
    return {
      sent: 0,
      failed: 1,
      skipped: 0,
      total: userIds?.length ?? 0,
      results: [
        {
          userId: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      ]
    };
  }
}

// Утилитарные функции
function getBonusEmoji(type: BonusType): string {
  switch (type) {
    case 'PURCHASE':
      return '🛒';
    case 'BIRTHDAY':
      return '🎂';
    case 'MANUAL':
      return '👨‍💼';
    case 'REFERRAL':
      return '👥';
    case 'PROMO':
      return '🎁';
    default:
      return '💰';
  }
}

function getBonusTypeText(type: BonusType): string {
  switch (type) {
    case 'PURCHASE':
      return 'За покупку';
    case 'BIRTHDAY':
      return 'День рождения';
    case 'MANUAL':
      return 'Ручное начисление';
    case 'REFERRAL':
      return 'Реферальная программа';
    case 'PROMO':
      return 'Промоакция';
    default:
      return 'Бонус';
  }
}
