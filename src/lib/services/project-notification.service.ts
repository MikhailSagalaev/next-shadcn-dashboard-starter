/**
 * @file: src/lib/services/project-notification.service.ts
 * @description: Сервис для управления уведомлениями проектов в БД
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-10-09
 * @author: AI Assistant + User
 */

import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { logger } from '../logger';

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type NotificationChannel = 'telegram' | 'email' | 'sms' | 'push';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  variables: string[];
}

export interface NotificationLog {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  sentAt: Date;
  success: boolean;
  error?: string;
}

export interface NotificationMetadata {
  imageUrl?: string;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
  parseMode?: 'Markdown' | 'HTML';
  priority?: string;
  [key: string]: unknown;
}

export interface SendNotificationRequest {
  userId: string;
  projectId: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}

export interface BulkNotificationResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  results: Array<{
    userId: string;
    success: boolean;
    skipped?: boolean;
    error?: string;
    errorCode?: number | string;
  }>;
}

export interface SendBulkNotificationRequest {
  type: string;
  channel: string;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}

export class ProjectNotificationService {
  /**
   * Получение шаблонов уведомлений для проекта
   */
  static async getTemplates(
    projectId: string
  ): Promise<NotificationTemplate[]> {
    try {
      // Пока возвращаем статические шаблоны
      // В будущем можно добавить таблицу templates
      const templates: NotificationTemplate[] = [
        {
          id: 'welcome',
          name: 'Приветственное сообщение',
          type: 'welcome',
          channel: 'telegram',
          title: 'Добро пожаловать!',
          message:
            'Добро пожаловать в нашу программу лояльности!\n\nВаш баланс: {balance} бонусов',
          variables: ['balance', 'firstName']
        },
        {
          id: 'bonus_earned',
          name: 'Бонусы начислены',
          type: 'bonus_earned',
          channel: 'telegram',
          title: 'Бонусы начислены',
          message: 'Поздравляем! Вам начислено {amount} бонусов за покупку.',
          variables: ['amount', 'balance']
        },
        {
          id: 'bonus_spent',
          name: 'Бонусы списаны',
          type: 'bonus_spent',
          channel: 'telegram',
          title: 'Бонусы списаны',
          message: 'С вашего счета списано {amount} бонусов.',
          variables: ['amount', 'balance']
        },
        {
          id: 'referral_bonus',
          name: 'Реферальные бонусы',
          type: 'referral_bonus',
          channel: 'telegram',
          title: 'Реферальные бонусы',
          message: 'Вы получили {amount} бонусов за приглашение друга!',
          variables: ['amount', 'referrerName']
        }
      ];

      logger.info('Templates retrieved', {
        projectId,
        count: templates.length
      });
      return templates;
    } catch (error) {
      logger.error('Failed to get notification templates', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение логов уведомлений для проекта
   */
  static async getNotificationLogs(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationLog[]> {
    try {
      const notifications = await db.notification.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              telegramUsername: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      const logs: NotificationLog[] = notifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId || '',
        channel: notification.channel as NotificationChannel,
        title: notification.title,
        message: notification.message,
        sentAt: notification.sentAt || notification.createdAt,
        success: !!notification.sentAt,
        error: notification.sentAt ? undefined : 'Not sent'
      }));

      logger.info('Notification logs retrieved', {
        projectId,
        count: logs.length,
        limit,
        offset
      });

      return logs;
    } catch (error) {
      logger.error('Failed to get notification logs', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение пользователей проекта для отправки уведомлений
   */
  static async getProjectUsers(projectId: string): Promise<
    Array<{
      id: string;
      email: string | null;
      phone: string | null;
      telegramId: bigint | null;
      telegramUsername: string | null;
      firstName: string | null;
      lastName: string | null;
      currentLevel: string;
      bonuses: Array<{ amount: unknown }>;
    }>
  > {
    try {
      const users = await db.user.findMany({
        where: { projectId },
        select: {
          id: true,
          email: true,
          phone: true,
          telegramId: true,
          telegramUsername: true,
          firstName: true,
          lastName: true,
          currentLevel: true,
          bonuses: {
            where: {
              isUsed: false,
              expiresAt: {
                gt: new Date()
              }
            },
            select: {
              amount: true
            }
          }
        }
      });

      logger.info('Project users retrieved', {
        projectId,
        count: users.length
      });

      return users;
    } catch (error) {
      logger.error('Failed to get project users', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Отправка уведомления пользователю
   */
  static async send(
    request: SendNotificationRequest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Создаем запись в БД
      const notification = await db.notification.create({
        data: {
          projectId: request.projectId,
          userId: request.userId,
          channel: request.channel,
          title: request.title,
          message: request.message,
          metadata: toPrismaJson(request.metadata)
        }
      });

      // Отправка через соответствующий канал
      let sendSuccess = false;
      let sendError: string | undefined;

      if (request.channel === 'telegram') {
        try {
          // Используем sendRichBroadcastMessage для отправки через Telegram бота
          const { sendRichBroadcastMessage } = await import(
            '@/lib/telegram/notifications'
          );

          const result = await sendRichBroadcastMessage(
            request.projectId,
            {
              message: request.message,
              imageUrl: request.metadata?.imageUrl,
              buttons: request.metadata?.buttons,
              parseMode: request.metadata?.parseMode || 'Markdown'
            },
            [request.userId] // Передаем массив с одним userId
          );

          sendSuccess = result.sent > 0;
          if (result.failed > 0) {
            sendError = 'Ошибка отправки через Telegram';
          }
        } catch (error) {
          sendError =
            error instanceof Error ? error.message : 'Unknown telegram error';
          logger.error('Failed to send telegram notification', {
            notificationId: notification.id,
            userId: request.userId,
            error: sendError
          });
        }
      } else {
        // Для других каналов (email, sms, push) пока просто помечаем как отправленное
        // TODO: Реализовать отправку через соответствующие провайдеры
        sendSuccess = true;
      }

      // Обновляем запись в БД с результатом отправки
      await db.notification.update({
        where: { id: notification.id },
        data: {
          sentAt: sendSuccess ? new Date() : null
        }
      });

      if (sendSuccess) {
        logger.info('Notification sent successfully', {
          notificationId: notification.id,
          userId: request.userId,
          channel: request.channel
        });
      }

      return {
        success: sendSuccess,
        error: sendError
      };
    } catch (error) {
      logger.error('Failed to send notification', {
        userId: request.userId,
        channel: request.channel,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Массовая отправка уведомлений
   */
  static async sendBulk(
    projectId: string,
    userIds: string[],
    notificationData: SendBulkNotificationRequest
  ): Promise<BulkNotificationResult> {
    try {
      // Telegram обрабатывается одной батчевой операцией. Раньше на каждого
      // пользователя запускалась отдельная мини-рассылка, причём ещё и в MAX.
      if (notificationData.channel === 'telegram') {
        const { sendRichBroadcastMessage } = await import(
          '@/lib/telegram/notifications'
        );
        const broadcast = await sendRichBroadcastMessage(
          projectId,
          {
            message: notificationData.message,
            imageUrl: notificationData.metadata?.imageUrl,
            buttons: notificationData.metadata?.buttons,
            parseMode: notificationData.metadata?.parseMode ?? 'Markdown'
          },
          userIds
        );

        if (broadcast.results.length > 0) {
          await db.notification.createMany({
            data: broadcast.results
              .filter((result) => result.userId)
              .map((result) => ({
                projectId,
                userId: result.userId,
                channel: notificationData.channel,
                title: notificationData.title,
                message: notificationData.message,
                metadata: toPrismaJson(notificationData.metadata),
                status: result.skipped
                  ? 'SKIPPED'
                  : result.success
                    ? 'SENT'
                    : 'FAILED',
                error: result.error,
                errorCode:
                  typeof result.errorCode === 'number'
                    ? result.errorCode
                    : undefined,
                attemptCount: result.skipped ? 0 : 1,
                lastAttemptAt: result.skipped ? undefined : new Date(),
                sentAt: result.success ? new Date() : undefined
              }))
          });
        }

        logger.info('Bulk Telegram notification completed', {
          projectId,
          total: broadcast.total,
          sent: broadcast.sent,
          failed: broadcast.failed,
          skipped: broadcast.skipped
        });

        return broadcast;
      }

      const results: BulkNotificationResult['results'] = [];
      const promises = userIds.map(async (userId) => {
        const result = await this.send({
          userId,
          projectId,
          ...notificationData
        });
        results.push({
          userId,
          success: result.success,
          error: result.error
        });
      });

      await Promise.allSettled(promises);
      const sent = results.filter((result) => result.success).length;
      const failed = results.length - sent;

      return {
        sent,
        failed,
        skipped: 0,
        total: userIds.length,
        results
      };
    } catch (error) {
      logger.error('Failed to send bulk notifications', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение статистики уведомлений
   */
  static async getStats(
    projectId: string,
    period?: { start: Date; end: Date }
  ) {
    try {
      const whereClause: any = { projectId };
      if (period) {
        whereClause.createdAt = {
          gte: period.start,
          lte: period.end
        };
      }

      const [total, sent, failed] = await Promise.all([
        db.notification.count({ where: whereClause }),
        db.notification.count({
          where: { ...whereClause, sentAt: { not: null } }
        }),
        db.notification.count({
          where: { ...whereClause, sentAt: null }
        })
      ]);

      const byChannel = await db.notification.groupBy({
        by: ['channel'],
        where: whereClause,
        _count: true
      });

      logger.info('Notification stats retrieved', {
        projectId,
        total,
        sent,
        failed
      });

      return {
        total,
        sent,
        failed,
        successRate: total > 0 ? (sent / total) * 100 : 0,
        byChannel: byChannel.map((item) => ({
          channel: item.channel,
          count: item._count
        }))
      };
    } catch (error) {
      logger.error('Failed to get notification stats', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
