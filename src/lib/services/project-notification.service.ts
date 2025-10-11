/**
 * @file: src/lib/services/project-notification.service.ts
 * @description: Сервис для управления уведомлениями проектов в БД
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-10-09
 * @author: AI Assistant + User
 */

import { db } from '../db';
import { logger } from '../logger';
import type { Notification, User } from '@prisma/client';

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

export interface SendNotificationRequest {
  userId: string;
  projectId: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  metadata?: any;
}

export interface BulkNotificationResult {
  sent: number;
  failed: number;
  total: number;
  results: Array<{
    userId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface SendBulkNotificationRequest {
  type: string;
  channel: string;
  title: string;
  message: string;
  metadata?: any;
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
      bonuses: Array<{ amount: any }>;
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
          metadata: request.metadata
        }
      });

      // Здесь должна быть логика отправки через соответствующий канал
      // Пока просто помечаем как отправленное
      await db.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() }
      });

      logger.info('Notification sent successfully', {
        notificationId: notification.id,
        userId: request.userId,
        channel: request.channel
      });

      return { success: true };
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
      const results: Array<{
        userId: string;
        success: boolean;
        error?: string;
      }> = [];

      // Отправляем уведомления параллельно
      const promises = userIds.map(async (userId) => {
        try {
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
          return result;
        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      await Promise.allSettled(promises);

      const sent = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      logger.info('Bulk notification sent', {
        projectId,
        total: userIds.length,
        sent,
        failed
      });

      return {
        sent,
        failed,
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
