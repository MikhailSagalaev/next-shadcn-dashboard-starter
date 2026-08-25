/**
 * @file: src/lib/services/mailing.service.ts
 * @description: Сервис для управления рассылками
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger, Bull Queue
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getMailingWorker,
  mailingQueue,
  type MailingJobData
} from '@/lib/queues/mailing.queue';
import type { MailingType, MailingStatus, Prisma } from '@prisma/client';

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface CreateMailingInput {
  projectId: string;
  name: string;
  type: MailingType;
  segmentId?: string;
  templateId?: string;
  scheduledAt?: Date;
  messageText?: string;
  messageHtml?: string;
  statistics?: Record<string, unknown>;
}

export interface QueueTelegramBroadcastInput {
  projectId: string;
  title: string;
  message: string;
  imageUrl?: string;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
  parseMode?: 'Markdown' | 'HTML';
}

export interface QueueTelegramBroadcastResult {
  mailingId: string;
  total: number;
  eligible: number;
  skipped: number;
}

export interface CreateMailingTemplateInput {
  projectId: string;
  name: string;
  subject: string;
  body: string;
  type: MailingType;
  isActive?: boolean;
}

export interface UpdateMailingTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  type?: MailingType;
  isActive?: boolean;
}

export class MailingService {
  /**
   * Создание шаблона рассылки
   */
  static async createTemplate(data: CreateMailingTemplateInput) {
    try {
      const template = await db.mailingTemplate.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          subject: data.subject,
          body: data.body,
          type: data.type,
          isActive: data.isActive ?? true
        }
      });

      logger.info('Шаблон рассылки создан', {
        templateId: template.id,
        projectId: data.projectId,
        type: data.type,
        component: 'mailing-service'
      });

      return template;
    } catch (error) {
      logger.error('Ошибка создания шаблона рассылки', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Обновление шаблона рассылки
   */
  static async updateTemplate(
    projectId: string,
    templateId: string,
    data: UpdateMailingTemplateInput
  ) {
    try {
      const template = await db.mailingTemplate.update({
        where: { id: templateId },
        data
      });

      logger.info('Шаблон рассылки обновлен', {
        templateId: template.id,
        projectId,
        component: 'mailing-service'
      });

      return template;
    } catch (error) {
      logger.error('Ошибка обновления шаблона рассылки', {
        templateId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Получение списка шаблонов рассылок
   */
  static async getTemplates(projectId: string, type?: MailingType) {
    try {
      const templates = await db.mailingTemplate.findMany({
        where: {
          projectId,
          ...(type ? { type } : {})
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return templates;
    } catch (error) {
      logger.error('Ошибка получения шаблонов рассылок', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Получение шаблона по ID
   */
  static async getTemplate(projectId: string, templateId: string) {
    try {
      const template = await db.mailingTemplate.findFirst({
        where: {
          id: templateId,
          projectId
        }
      });

      return template;
    } catch (error) {
      logger.error('Ошибка получения шаблона рассылки', {
        templateId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Создание рассылки
   */
  static async createMailing(data: CreateMailingInput) {
    try {
      const mailing = await db.mailing.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          type: data.type,
          segmentId: data.segmentId,
          templateId: data.templateId,
          status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: data.scheduledAt,
          messageText: data.messageText,
          messageHtml: data.messageHtml,
          statistics: toPrismaJson(data.statistics)
        },
        include: {
          segment: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          template: true
        }
      });

      logger.info('Рассылка создана', {
        mailingId: mailing.id,
        projectId: data.projectId,
        type: data.type,
        component: 'mailing-service'
      });

      return mailing;
    } catch (error) {
      logger.error('Ошибка создания рассылки', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Очистка недействительных привязок Telegram по результатам рассылки (403, 400)
   */
  static async cleanUnavailableRecipients(
    projectId: string,
    mailingId: string
  ) {
    try {
      const mailing = await db.mailing.findFirst({
        where: { id: mailingId, projectId },
        select: { id: true, type: true }
      });
      if (!mailing) throw new Error('Рассылка не найдена');
      if (mailing.type !== 'TELEGRAM') {
        throw new Error('Автоочистка доступна только для Telegram');
      }
      const failedRecipients = await db.mailingRecipient.findMany({
        where: {
          mailingId,
          status: 'FAILED',
          userId: { not: null },
          OR: [
            { error: { contains: 'blocked by the user' } },
            { error: { contains: 'user is deactivated' } },
            { error: { contains: 'chat not found' } }
          ]
        },
        select: { userId: true }
      });

      const userIds = failedRecipients
        .map((r) => r.userId)
        .filter((id): id is string => Boolean(id));

      if (userIds.length === 0) {
        return { cleanedCount: 0 };
      }

      const result = await db.user.updateMany({
        where: {
          id: { in: userIds },
          projectId
        },
        data: {
          telegramId: null
        }
      });

      logger.info('Недействительные Telegram-привязки очищены', {
        projectId,
        mailingId,
        cleanedCount: result.count
      });

      return { cleanedCount: result.count };
    } catch (error) {
      logger.error('Ошибка очистки недействительных Telegram-привязок', {
        projectId,
        mailingId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Создаёт фоновую Telegram-рассылку для всех активных привязанных
   * пользователей. Получатели без telegramId учитываются как skipped, но не
   * создают тысячи заведомо неуспешных jobs.
   */
  static async queueTelegramBroadcast(
    data: QueueTelegramBroadcastInput
  ): Promise<QueueTelegramBroadcastResult> {
    if (!mailingQueue || !getMailingWorker()) {
      throw new Error(
        'Очередь рассылок недоступна. Настройте REDIS_URL или REDIS_HOST.'
      );
    }

    const [total, eligibleUsers] = await Promise.all([
      db.user.count({ where: { projectId: data.projectId } }),
      db.user.findMany({
        where: {
          projectId: data.projectId,
          telegramId: { not: null }
        },
        select: {
          id: true,
          email: true,
          phone: true,
          telegramId: true
        }
      })
    ]);

    if (eligibleUsers.length === 0) {
      throw new Error('В проекте нет пользователей, привязанных к Telegram.');
    }

    const mailing = await db.mailing.create({
      data: {
        projectId: data.projectId,
        name: data.title,
        type: 'TELEGRAM',
        status: 'SENDING',
        sentAt: new Date(),
        messageText: data.message,
        statistics: toPrismaJson({
          imageUrl: data.imageUrl,
          buttons: data.buttons,
          parseMode: data.parseMode ?? 'HTML',
          audienceTotal: total,
          audienceEligible: eligibleUsers.length,
          audienceSkipped: total - eligibleUsers.length
        })
      }
    });

    try {
      const chunkSize = 500;
      for (let index = 0; index < eligibleUsers.length; index += chunkSize) {
        const chunk = eligibleUsers.slice(index, index + chunkSize);
        await db.mailingRecipient.createMany({
          data: chunk.map((user) => ({
            mailingId: mailing.id,
            userId: user.id,
            email: user.email ?? undefined,
            phone: user.phone ?? undefined,
            telegramId: user.telegramId?.toString(),
            status: 'PENDING'
          })),
          skipDuplicates: true
        });
      }

      const recipients = await db.mailingRecipient.findMany({
        where: { mailingId: mailing.id, status: 'PENDING' },
        select: { id: true, userId: true, email: true, phone: true }
      });
      const metadata = {
        imageUrl: data.imageUrl,
        buttons: data.buttons,
        parseMode: data.parseMode ?? 'HTML'
      };

      for (let index = 0; index < recipients.length; index += chunkSize) {
        const chunk = recipients.slice(index, index + chunkSize);
        await mailingQueue.addBulk(
          chunk.map((recipient) => ({
            name: 'send-message',
            data: {
              mailingId: mailing.id,
              recipientId: recipient.id,
              type: 'TELEGRAM',
              recipient: {
                userId: recipient.userId ?? undefined,
                email: recipient.email ?? undefined,
                phone: recipient.phone ?? undefined
              },
              subject: data.title,
              body: data.message,
              metadata
            } satisfies MailingJobData,
            opts: {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: 1000,
              removeOnFail: 5000
            }
          }))
        );
      }

      logger.info('Telegram broadcast queued', {
        mailingId: mailing.id,
        projectId: data.projectId,
        total,
        eligible: eligibleUsers.length,
        skipped: total - eligibleUsers.length,
        component: 'mailing-service'
      });

      return {
        mailingId: mailing.id,
        total,
        eligible: eligibleUsers.length,
        skipped: total - eligibleUsers.length
      };
    } catch (error) {
      await db.mailing.update({
        where: { id: mailing.id },
        data: { status: 'FAILED', completedAt: new Date() }
      });
      throw error;
    }
  }

  /**
   * Запуск рассылки
   */
  static async startMailing(
    projectId: string,
    mailingId: string
  ): Promise<{ recipientCount: number }> {
    try {
      const mailing = await db.mailing.findFirst({
        where: {
          id: mailingId,
          projectId
        },
        include: {
          segment: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          template: true,
          recipients: true
        }
      });

      if (!mailing) {
        throw new Error('Рассылка не найдена');
      }

      if (mailing.status !== 'DRAFT' && mailing.status !== 'SCHEDULED') {
        throw new Error('Рассылка уже запущена или завершена');
      }

      if (!mailingQueue) {
        throw new Error('Очередь рассылок недоступна. Попробуйте позже.');
      }

      let recipients: Array<{
        userId?: string;
        email?: string;
        phone?: string;
        telegramId?: string;
        maxId?: string;
      }> = [];

      if (mailing.segment) {
        recipients = mailing.segment.members
          .filter(
            ({ user }) =>
              user.projectId === projectId &&
              user.isActive &&
              ((mailing.type === 'TELEGRAM' && user.telegramId !== null) ||
                (mailing.type === 'MAX' && user.maxId !== null) ||
                (mailing.type === 'EMAIL' && Boolean(user.email)) ||
                (mailing.type !== 'TELEGRAM' &&
                  mailing.type !== 'MAX' &&
                  mailing.type !== 'EMAIL' &&
                  Boolean(user.phone)))
          )
          .map(({ user }) => ({
            userId: user.id,
            email: user.email || undefined,
            phone: user.phone || undefined,
            telegramId: user.telegramId?.toString(),
            maxId: user.maxId?.toString()
          }));
      } else if (mailing.recipients.length > 0) {
        recipients = mailing.recipients.map((r) => ({
          userId: r.userId || undefined,
          email: r.email || undefined,
          phone: r.phone || undefined,
          telegramId: r.telegramId || undefined,
          maxId: r.maxId || undefined
        }));
      } else {
        const channelWhere: Prisma.UserWhereInput =
          mailing.type === 'TELEGRAM'
            ? { telegramId: { not: null } }
            : mailing.type === 'MAX'
              ? { maxId: { not: null } }
              : mailing.type === 'EMAIL'
                ? { email: { not: null }, isActive: true }
                : { phone: { not: null }, isActive: true };
        recipients = await db.user
          .findMany({
            where: { projectId, ...channelWhere },
            select: {
              id: true,
              email: true,
              phone: true,
              telegramId: true,
              maxId: true
            }
          })
          .then((users) =>
            users.map((user) => ({
              userId: user.id,
              email: user.email || undefined,
              phone: user.phone || undefined,
              telegramId: user.telegramId?.toString(),
              maxId: user.maxId?.toString()
            }))
          );
      }

      if (recipients.length === 0) {
        throw new Error(
          'Нет получателей с активным контактом для выбранного канала'
        );
      }

      await db.$transaction(async (tx) => {
        const claimed = await tx.mailing.updateMany({
          where: { id: mailingId, projectId, status: mailing.status },
          data: { status: 'SENDING', sentAt: new Date(), completedAt: null }
        });
        if (claimed.count !== 1) {
          throw new Error('Рассылку уже запустил другой администратор');
        }
        if (mailing.recipients.length === 0) {
          await tx.mailingRecipient.createMany({
            data: recipients.map((recipient) => ({
              mailingId: mailing.id,
              userId: recipient.userId,
              email: recipient.email,
              phone: recipient.phone,
              telegramId: recipient.telegramId,
              maxId: recipient.maxId,
              status: 'PENDING'
            }))
          });
        }
      });

      const mailingRecipients = await db.mailingRecipient.findMany({
        where: { mailingId: mailing.id, status: 'PENDING' }
      });

      getMailingWorker();
      const subject = mailing.template?.subject || '';
      const body =
        mailing.template?.body ||
        mailing.messageText ||
        mailing.messageHtml ||
        '';

      // Telegram и MAX используют общий редактор текста и кнопок.
      const mailingMetadata = (mailing.statistics as Record<string, any>) || {};
      const messengerMetadata: Record<string, any> = {};

      if (mailing.type === 'TELEGRAM' || mailing.type === 'MAX') {
        if (mailing.type === 'TELEGRAM' && mailingMetadata.imageUrl) {
          messengerMetadata.imageUrl = mailingMetadata.imageUrl;
        }
        if (mailingMetadata.buttons) {
          messengerMetadata.buttons = mailingMetadata.buttons;
        }
        if (mailingMetadata.parseMode) {
          messengerMetadata.parseMode = mailingMetadata.parseMode;
        }
      }

      for (const recipient of mailingRecipients) {
        if (recipient.status === 'PENDING') {
          // Объединяем метаданные рассылки с метаданными получателя
          const combinedMetadata = {
            ...messengerMetadata,
            ...((recipient.metadata as Record<string, any>) || {})
          };

          await mailingQueue.add(
            'send-message',
            {
              mailingId: mailing.id,
              recipientId: recipient.id,
              type: mailing.type,
              recipient: {
                userId: recipient.userId || undefined,
                email: recipient.email || undefined,
                phone: recipient.phone || undefined,
                maxId: recipient.maxId || undefined
              },
              subject,
              body,
              metadata: combinedMetadata
            },
            {
              jobId: `mailing-${mailing.id}-${recipient.id}`,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000
              }
            }
          );
        }
      }

      logger.info('Рассылка запущена', {
        mailingId: mailing.id,
        projectId,
        recipientsCount: mailingRecipients.length,
        component: 'mailing-service'
      });
      return { recipientCount: mailingRecipients.length };
    } catch (error) {
      logger.error('Ошибка запуска рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });

      await db.mailing.updateMany({
        where: { id: mailingId, projectId, status: 'SENDING' },
        data: { status: 'FAILED', completedAt: new Date() }
      });

      throw error;
    }
  }

  /**
   * Получение статистики рассылки
   */
  static async getMailingStats(projectId: string, mailingId: string) {
    try {
      const mailing = await db.mailing.findFirst({
        where: { id: mailingId, projectId },
        include: {
          recipients: true
        }
      });

      if (!mailing) {
        throw new Error('Рассылка не найдена');
      }

      const recipients = mailing.recipients;

      // Telegram/MAX подтверждают приём сообщения API, но не отдают боту
      // персональные read receipts. Поэтому здесь нет фиктивного Open Rate:
      // доказуемое действие после отправки — переход по отслеживаемой ссылке.
      const stats = {
        total: recipients.length,
        sent: recipients.filter((r) => r.status === 'SENT').length,
        failed: recipients.filter((r) => r.status === 'FAILED').length,
        pending: recipients.filter((r) => r.status === 'PENDING').length,
        bounced: recipients.filter((r) => r.status === 'BOUNCED').length,
        clicked: recipients.filter((r) => r.clickedAt !== null).length
      };

      const clickThroughRate =
        stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0;

      const errorsBreakdown: Record<string, number> = {};
      let blockedCount = 0;
      let deactivatedCount = 0;
      let chatNotFoundCount = 0;

      for (const r of recipients) {
        if (r.error) {
          if (r.error.includes('blocked by the user')) {
            blockedCount++;
            errorsBreakdown['Заблокирован бот'] =
              (errorsBreakdown['Заблокирован бот'] || 0) + 1;
          } else if (r.error.includes('user is deactivated')) {
            deactivatedCount++;
            errorsBreakdown['Удален аккаунт Telegram'] =
              (errorsBreakdown['Удален аккаунт Telegram'] || 0) + 1;
          } else if (r.error.includes('chat not found')) {
            chatNotFoundCount++;
            errorsBreakdown['Чат не найден'] =
              (errorsBreakdown['Чат не найден'] || 0) + 1;
          } else {
            const label = r.error.slice(0, 60);
            errorsBreakdown[label] = (errorsBreakdown[label] || 0) + 1;
          }
        }
      }

      // Загружаем ссылки рассылки и детальную статистику кликов
      const links = await db.mailingLink.findMany({
        where: { mailingId },
        include: {
          _count: {
            select: { clicks: true }
          }
        }
      });

      const linkClicks = await db.mailingLinkClick.findMany({
        where: { mailingId }
      });

      const linksAnalytics = links.map((link) => {
        const clicksForThisLink = linkClicks.filter(
          (c) => c.url === link.originalUrl
        );
        const uniqueRecipients = new Set(
          clicksForThisLink.map((c) => c.recipientId)
        ).size;
        return {
          id: link.id,
          originalUrl: link.originalUrl,
          shortCode: link.shortCode,
          totalClicks: clicksForThisLink.length || link._count.clicks,
          uniqueClicks: uniqueRecipients,
          ctr:
            stats.sent > 0
              ? Math.round((uniqueRecipients / stats.sent) * 1000) / 10
              : 0
        };
      });

      return {
        ...stats,
        clickThroughRate: Math.round(clickThroughRate * 100) / 100,
        readTrackingAvailable: false,
        errorsBreakdown,
        blockedCount,
        deactivatedCount,
        chatNotFoundCount,
        linksAnalytics
      };
    } catch (error) {
      logger.error('Ошибка получения статистики рассылки', {
        mailingId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Получение истории рассылки
   */
  static async getMailingHistory(
    projectId: string,
    mailingId: string,
    options?: {
      limit?: number;
      offset?: number;
      eventType?: string;
    }
  ) {
    try {
      const history = await db.mailingHistory.findMany({
        where: {
          mailingId,
          mailing: { projectId },
          ...(options?.eventType
            ? {
                type: options.eventType as
                  | 'SENT'
                  | 'OPENED'
                  | 'CLICKED'
                  | 'FAILED'
              }
            : {})
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              telegramId: true,
              maxId: true
            }
          },
          recipient: {
            select: {
              id: true,
              email: true,
              phone: true,
              telegramId: true,
              maxId: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: options?.limit || 100,
        skip: options?.offset || 0
      });

      return history;
    } catch (error) {
      logger.error('Ошибка получения истории рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Получение рассылки по ID
   */
  static async getMailing(projectId: string, mailingId: string) {
    try {
      const mailing = await db.mailing.findFirst({
        where: {
          id: mailingId,
          projectId
        },
        include: {
          segment: true,
          template: true,
          recipients: {
            include: {
              user: true
            }
          },
          _count: {
            select: {
              recipients: true
            }
          }
        }
      });

      return mailing;
    } catch (error) {
      logger.error('Ошибка получения рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Обновление рассылки
   */
  static async updateMailing(
    projectId: string,
    mailingId: string,
    data: {
      name?: string;
      segmentId?: string;
      templateId?: string;
      scheduledAt?: Date;
      status?: MailingStatus;
      messageText?: string;
      messageHtml?: string;
      statistics?: Record<string, any>;
    }
  ) {
    try {
      const mailing = await db.mailing.update({
        where: {
          id: mailingId,
          projectId
        },
        data,
        include: {
          segment: true,
          template: true
        }
      });

      logger.info('Рассылка обновлена', {
        mailingId: mailing.id,
        projectId,
        component: 'mailing-service'
      });

      return mailing;
    } catch (error) {
      logger.error('Ошибка обновления рассылки', {
        mailingId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Удаление рассылки
   */
  static async deleteMailing(
    projectId: string,
    mailingId: string
  ): Promise<void> {
    try {
      await db.mailing.delete({
        where: {
          id: mailingId,
          projectId
        }
      });

      logger.info('Рассылка удалена', {
        mailingId,
        projectId,
        component: 'mailing-service'
      });
    } catch (error) {
      logger.error('Ошибка удаления рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Получение списка рассылок
   */
  static async getMailings(projectId: string, status?: MailingStatus) {
    try {
      const mailings = await db.mailing.findMany({
        where: {
          projectId,
          ...(status ? { status } : {})
        },
        include: {
          segment: {
            select: {
              id: true,
              name: true,
              memberCount: true
            }
          },
          template: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              recipients: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return mailings;
    } catch (error) {
      logger.error('Ошибка получения списка рассылок', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }

  /**
   * Отмена рассылки
   */
  static async cancelMailing(
    projectId: string,
    mailingId: string
  ): Promise<void> {
    try {
      await db.mailing.update({
        where: {
          id: mailingId,
          projectId
        },
        data: {
          status: 'CANCELLED'
        }
      });

      logger.info('Рассылка отменена', {
        mailingId,
        projectId,
        component: 'mailing-service'
      });
    } catch (error) {
      logger.error('Ошибка отмены рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service'
      });
      throw error;
    }
  }
}
