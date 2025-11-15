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
import { mailingQueue, type MailingJobData } from '@/lib/queues/mailing.queue';
import type { MailingType, MailingStatus } from '@prisma/client';

export interface CreateMailingInput {
  projectId: string;
  name: string;
  type: MailingType;
  segmentId?: string;
  templateId?: string;
  scheduledAt?: Date;
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
          isActive: data.isActive ?? true,
        },
      });

      logger.info('Шаблон рассылки создан', {
        templateId: template.id,
        projectId: data.projectId,
        type: data.type,
        component: 'mailing-service',
      });

      return template;
    } catch (error) {
      logger.error('Ошибка создания шаблона рассылки', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
        data,
      });

      logger.info('Шаблон рассылки обновлен', {
        templateId: template.id,
        projectId,
        component: 'mailing-service',
      });

      return template;
    } catch (error) {
      logger.error('Ошибка обновления шаблона рассылки', {
        templateId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
          ...(type ? { type } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return templates;
    } catch (error) {
      logger.error('Ошибка получения шаблонов рассылок', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
          projectId,
        },
      });

      return template;
    } catch (error) {
      logger.error('Ошибка получения шаблона рассылки', {
        templateId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
        },
        include: {
          segment: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
          template: true,
        },
      });

      logger.info('Рассылка создана', {
        mailingId: mailing.id,
        projectId: data.projectId,
        type: data.type,
        component: 'mailing-service',
      });

      return mailing;
    } catch (error) {
      logger.error('Ошибка создания рассылки', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
      });
      throw error;
    }
  }

  /**
   * Запуск рассылки
   */
  static async startMailing(projectId: string, mailingId: string): Promise<void> {
    try {
      const mailing = await db.mailing.findFirst({
        where: {
          id: mailingId,
          projectId,
        },
        include: {
          segment: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
          template: true,
          recipients: true,
        },
      });

      if (!mailing) {
        throw new Error('Рассылка не найдена');
      }

      if (mailing.status !== 'DRAFT' && mailing.status !== 'SCHEDULED') {
        throw new Error('Рассылка уже запущена или завершена');
      }

      // Обновляем статус на SENDING
      await db.mailing.update({
        where: { id: mailingId },
        data: {
          status: 'SENDING',
          sentAt: new Date(),
        },
      });

      // Получаем список получателей
      let recipients: Array<{ userId?: string; email?: string; phone?: string }> = [];

      if (mailing.segment) {
        // Получаем пользователей из сегмента
        recipients = mailing.segment.members.map((member) => ({
          userId: member.user.id,
          email: member.user.email || undefined,
          phone: member.user.phone || undefined,
        }));
      } else if (mailing.recipients.length > 0) {
        // Используем существующих получателей
        recipients = mailing.recipients.map((r) => ({
          userId: r.userId || undefined,
          email: r.email || undefined,
          phone: r.phone || undefined,
        }));
      }

      // Создаем записи получателей, если их нет
      if (mailing.recipients.length === 0) {
        await db.mailingRecipient.createMany({
          data: recipients.map((recipient) => ({
            mailingId: mailing.id,
            userId: recipient.userId,
            email: recipient.email,
            phone: recipient.phone,
            status: 'PENDING',
          })),
        });
      }

      // Получаем обновленный список получателей
      const mailingRecipients = await db.mailingRecipient.findMany({
        where: { mailingId: mailing.id },
      });

      // Добавляем задачи в очередь
      const subject = mailing.template?.subject || '';
      const body = mailing.template?.body || '';

      for (const recipient of mailingRecipients) {
        if (recipient.status === 'PENDING') {
          await mailingQueue.add({
            mailingId: mailing.id,
            recipientId: recipient.id,
            type: mailing.type,
            recipient: {
              userId: recipient.userId || undefined,
              email: recipient.email || undefined,
              phone: recipient.phone || undefined,
            },
            subject,
            body,
            metadata: recipient.metadata as Record<string, any> || {},
          }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          });
        }
      }

      logger.info('Рассылка запущена', {
        mailingId: mailing.id,
        projectId,
        recipientsCount: mailingRecipients.length,
        component: 'mailing-service',
      });
    } catch (error) {
      logger.error('Ошибка запуска рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
      });

      // Обновляем статус на FAILED в случае ошибки
      await db.mailing.update({
        where: { id: mailingId },
        data: {
          status: 'FAILED',
        },
      });

      throw error;
    }
  }

  /**
   * Получение статистики рассылки
   */
  static async getMailingStats(mailingId: string) {
    try {
      const recipients = await db.mailingRecipient.findMany({
        where: { mailingId },
      });

      const stats = {
        total: recipients.length,
        sent: recipients.filter((r) => r.status === 'SENT').length,
        failed: recipients.filter((r) => r.status === 'FAILED').length,
        pending: recipients.filter((r) => r.status === 'PENDING').length,
        bounced: recipients.filter((r) => r.status === 'BOUNCED').length,
      };

      // Обновляем статистику в рассылке
      await db.mailing.update({
        where: { id: mailingId },
        data: {
          statistics: stats,
          status: stats.pending === 0 ? 'COMPLETED' : undefined,
        },
      });

      return stats;
    } catch (error) {
      logger.error('Ошибка получения статистики рассылки', {
        mailingId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
          projectId,
        },
        include: {
          segment: true,
          template: true,
          recipients: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      });

      return mailing;
    } catch (error) {
      logger.error('Ошибка получения рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
    }
  ) {
    try {
      const mailing = await db.mailing.update({
        where: {
          id: mailingId,
          projectId,
        },
        data,
        include: {
          segment: true,
          template: true,
        },
      });

      logger.info('Рассылка обновлена', {
        mailingId: mailing.id,
        projectId,
        component: 'mailing-service',
      });

      return mailing;
    } catch (error) {
      logger.error('Ошибка обновления рассылки', {
        mailingId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
      });
      throw error;
    }
  }

  /**
   * Удаление рассылки
   */
  static async deleteMailing(projectId: string, mailingId: string): Promise<void> {
    try {
      await db.mailing.delete({
        where: {
          id: mailingId,
          projectId,
        },
      });

      logger.info('Рассылка удалена', {
        mailingId,
        projectId,
        component: 'mailing-service',
      });
    } catch (error) {
      logger.error('Ошибка удаления рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
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
          ...(status ? { status } : {}),
        },
        include: {
          segment: {
            select: {
              id: true,
              name: true,
              memberCount: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              recipients: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return mailings;
    } catch (error) {
      logger.error('Ошибка получения списка рассылок', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
      });
      throw error;
    }
  }

  /**
   * Отмена рассылки
   */
  static async cancelMailing(projectId: string, mailingId: string): Promise<void> {
    try {
      await db.mailing.update({
        where: {
          id: mailingId,
          projectId,
        },
        data: {
          status: 'CANCELLED',
        },
      });

      logger.info('Рассылка отменена', {
        mailingId,
        projectId,
        component: 'mailing-service',
      });
    } catch (error) {
      logger.error('Ошибка отмены рассылки', {
        mailingId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'mailing-service',
      });
      throw error;
    }
  }
}

