/**
 * @file: src/lib/services/mailing-tracker.service.ts
 * @description: Сервис для генерации трекинг-ссылок и достоверного учета переходов (CTR) рассылок
 * @project: SaaS Bonus System
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface MailingButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TrackClickParams {
  shortCode: string;
  recipientId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface TrackClickResult {
  destinationUrl: string;
  mailingId?: string;
  recipientId?: string;
}

function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 символов, например 'a3f8b91c'
}

function getAppBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://gupil.ru';
  return url.replace(/\/+$/, '');
}

export class MailingTrackerService {
  /**
   * Извлекает все HTTP/HTTPS ссылки из текста и кнопок и регистрирует их в БД
   */
  static async registerMailingLinks(
    mailingId: string,
    text: string,
    buttons?: MailingButton[]
  ): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>(); // originalUrl -> shortCode
    const urls = new Set<string>();

    // 1. Извлекаем ссылки из текста
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(text)) !== null) {
      const foundUrl = match[1];
      // Не оборачиваем уже сокращенные ссылки нашего домена
      if (!foundUrl.includes('/r/')) {
        urls.add(foundUrl);
      }
    }

    // 2. Извлекаем ссылки из кнопок
    if (Array.isArray(buttons)) {
      for (const btn of buttons) {
        if (btn.url && !btn.url.includes('/r/')) {
          urls.add(btn.url);
        }
      }
    }

    if (urls.size === 0) {
      return urlMap;
    }

    // 3. Загружаем существующие ссылки для этой рассылки
    const existingLinks = await db.mailingLink.findMany({
      where: {
        mailingId,
        originalUrl: { in: Array.from(urls) }
      }
    });

    for (const link of existingLinks) {
      urlMap.set(link.originalUrl, link.shortCode);
    }

    // 4. Создаем новые ссылки при необходимости
    const urlsToCreate = Array.from(urls).filter((url) => !urlMap.has(url));

    for (const originalUrl of urlsToCreate) {
      let shortCode = generateShortCode();
      // Гарантируем уникальность shortCode
      let attempts = 0;
      while (attempts < 5) {
        const collision = await db.mailingLink.findUnique({
          where: { shortCode }
        });
        if (!collision) break;
        shortCode = generateShortCode();
        attempts++;
      }

      try {
        const created = await db.mailingLink.create({
          data: {
            mailingId,
            originalUrl,
            shortCode
          }
        });
        urlMap.set(originalUrl, created.shortCode);
      } catch (err) {
        logger.warn('Ошибка при сохранении ссылки рассылки', {
          mailingId,
          originalUrl,
          err: err instanceof Error ? err.message : String(err)
        });
      }
    }

    return urlMap;
  }

  /**
   * Оборачивает ссылки в тексте и на кнопках в персональные трекинг-ссылки получателя
   */
  static async wrapMessageForRecipient(
    mailingId: string,
    recipientId: string,
    text: string,
    buttons?: MailingButton[]
  ): Promise<{ text: string; buttons?: MailingButton[] }> {
    try {
      const urlMap = await this.registerMailingLinks(mailingId, text, buttons);
      if (urlMap.size === 0) {
        return { text, buttons };
      }

      const baseUrl = getAppBaseUrl();

      // Заменяем ссылки в тексте
      let wrappedText = text;
      for (const [originalUrl, shortCode] of urlMap.entries()) {
        const trackingUrl = `${baseUrl}/r/${shortCode}?r=${encodeURIComponent(recipientId)}`;
        // Экранируем спецсимволы в URL для регулярного выражения
        const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        wrappedText = wrappedText.replace(
          new RegExp(escaped, 'g'),
          trackingUrl
        );
      }

      // Заменяем ссылки в кнопках
      let wrappedButtons = buttons;
      if (Array.isArray(buttons)) {
        wrappedButtons = buttons.map((btn) => {
          if (btn.url && urlMap.has(btn.url)) {
            const shortCode = urlMap.get(btn.url)!;
            const trackingUrl = `${baseUrl}/r/${shortCode}?r=${encodeURIComponent(recipientId)}`;
            return { ...btn, url: trackingUrl };
          }
          return btn;
        });
      }

      return { text: wrappedText, buttons: wrappedButtons };
    } catch (error) {
      logger.error('Ошибка оборачивания ссылок в сообщении', {
        mailingId,
        recipientId,
        error: error instanceof Error ? error.message : String(error)
      });
      return { text, buttons };
    }
  }

  /**
   * Фиксация клика по ссылке и формирование целевого URL с UTM-метками
   */
  static async recordClick(
    params: TrackClickParams
  ): Promise<TrackClickResult> {
    const { shortCode, recipientId, userAgent, ipAddress } = params;

    const link = await db.mailingLink.findUnique({
      where: { shortCode },
      include: {
        mailing: {
          select: {
            id: true,
            projectId: true,
            name: true,
            type: true
          }
        }
      }
    });

    if (!link) {
      return { destinationUrl: getAppBaseUrl() };
    }

    const now = new Date();
    let recipient: any = null;

    if (recipientId) {
      recipient = await db.mailingRecipient.findFirst({
        where: { id: recipientId, mailingId: link.mailingId }
      });
    }

    try {
      // Клик является доказуемым действием, но не read receipt: Telegram/MAX
      // Bot API не сообщают, что пользователь просто открыл сообщение.
      if (recipient) {
        await db.$transaction(async (tx) => {
          const firstClick = await tx.mailingRecipient.updateMany({
            where: {
              id: recipient.id,
              mailingId: link.mailingId,
              clickedAt: null
            },
            data: { clickedAt: now }
          });
          await tx.mailingRecipient.update({
            where: { id: recipient.id },
            data: { clickCount: { increment: 1 } }
          });
          await tx.mailingLinkClick.create({
            data: {
              mailingId: link.mailingId,
              recipientId: recipient.id,
              url: link.originalUrl,
              clickedAt: now,
              userAgent: userAgent ? userAgent.slice(0, 500) : undefined,
              ipAddress: ipAddress ? ipAddress.slice(0, 100) : undefined
            }
          });
          await tx.mailingHistory.create({
            data: {
              mailingId: link.mailingId,
              recipientId: recipient.id,
              userId: recipient.userId,
              linkId: link.id,
              type: 'CLICKED',
              timestamp: now,
              metadata: {
                shortCode,
                userAgent: userAgent ? userAgent.slice(0, 100) : undefined,
                ipAddress: ipAddress ? ipAddress.slice(0, 45) : undefined
              }
            }
          });
          if (firstClick.count === 1) {
            await tx.mailing.update({
              where: { id: link.mailingId },
              data: { clickedCount: { increment: 1 } }
            });
          }
        });
      }
    } catch (dbErr) {
      logger.error('Ошибка записи статистики клика', {
        shortCode,
        recipientId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr)
      });
    }

    // Формируем целевой URL с UTM-метками даже для неперсонального перехода.
    const destinationUrl = this.appendUtmParameters(
      link.originalUrl,
      link.mailing,
      recipient,
      link.id
    );

    return {
      destinationUrl,
      mailingId: link.mailingId,
      recipientId: recipient?.id
    };
  }

  /**
   * Добавляет UTM-метки к целевому URL
   */
  private static appendUtmParameters(
    originalUrl: string,
    mailing: { id: string; name: string; type: string },
    recipient?: { userId?: string | null } | null,
    linkId?: string
  ): string {
    try {
      const url = new URL(originalUrl);

      // Добавляем UTM только если они еще не заданы вручную в ссылке
      if (!url.searchParams.has('utm_source')) {
        url.searchParams.set('utm_source', mailing.type.toLowerCase());
      }
      if (!url.searchParams.has('utm_medium')) {
        url.searchParams.set('utm_medium', 'broadcast');
      }
      if (!url.searchParams.has('utm_campaign')) {
        url.searchParams.set('utm_campaign', `m_${mailing.id}`);
      }
      if (!url.searchParams.has('utm_content') && linkId) {
        url.searchParams.set('utm_content', linkId);
      }
      if (recipient?.userId && !url.searchParams.has('utm_user')) {
        url.searchParams.set('utm_user', recipient.userId);
      }

      return url.toString();
    } catch {
      // Если URL относительный или сложный
      return originalUrl;
    }
  }
}
