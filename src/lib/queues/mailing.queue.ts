/**
 * @file: src/lib/queues/mailing.queue.ts
 * @description: Bull очередь для асинхронной отправки рассылок
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import Bull from 'bull';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import type { MailingType } from '@prisma/client';
import { botManager } from '@/lib/telegram/bot-manager';

// Конфигурация Redis для очереди рассылок
const getRedisConfig = () => {
  if (process.env.REDIS_HOST) {
    return {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };
  }

  return {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  };
};

// Типы задач в очереди рассылок
export interface MailingJobData {
  mailingId: string;
  recipientId: string;
  type: MailingType;
  recipient: {
    userId?: string;
    email?: string;
    phone?: string;
  };
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

// Создаем очередь для рассылок
export const mailingQueue = new Bull<MailingJobData>(
  'mailing',
  getRedisConfig()
);

// Обработчик задач рассылки
mailingQueue.process(async (job: Bull.Job<MailingJobData>) => {
  const { mailingId, recipientId, type, recipient, subject, body, metadata } =
    job.data;

  try {
    logger.info('Processing mailing job', {
      jobId: job.id,
      mailingId,
      recipientId,
      type,
      component: 'mailing-queue'
    });

    let success = false;
    let error: string | null = null;

    // Отправка в зависимости от типа
    switch (type) {
      case 'EMAIL':
        if (recipient.email) {
          // TODO: Интеграция с email сервисом (SendGrid, Mailgun, etc.)
          success = true;
        } else {
          error = 'Email не указан';
        }
        break;

      case 'SMS':
        if (recipient.phone) {
          // TODO: Интеграция с SMS сервисом (Twilio, SMS.ru, etc.)
          success = true;
        } else {
          error = 'Телефон не указан';
        }
        break;

      case 'TELEGRAM':
        if (recipient.userId) {
          try {
            // Получаем проект из рассылки
            const mailing = await db.mailing.findUnique({
              where: { id: mailingId },
              select: { projectId: true }
            });

            if (!mailing) {
              error = 'Рассылка не найдена';
              break;
            }

            // Получаем пользователя для telegramId
            const user = await db.user.findUnique({
              where: { id: recipient.userId },
              select: { telegramId: true }
            });

            if (!user || !user.telegramId) {
              error = 'Пользователь не привязан к Telegram';
              break;
            }

            // Парсим метаданные для изображения и кнопок
            const imageUrl = metadata?.imageUrl as string | undefined;
            const buttons = metadata?.buttons as
              | Array<{
                  text: string;
                  url?: string;
                  callback_data?: string;
                }>
              | undefined;
            const parseMode =
              (metadata?.parseMode as 'HTML' | 'Markdown') || 'HTML';

            // Отправляем через BotManager
            const result = await botManager.sendRichBroadcastMessage(
              mailing.projectId,
              [recipient.userId],
              body,
              {
                imageUrl,
                buttons,
                parseMode
              }
            );

            if (result.success && result.sentCount > 0) {
              success = true;

              // Создаем запись в истории
              await db.mailingHistory.create({
                data: {
                  mailingId,
                  recipientId,
                  userId: recipient.userId || undefined,
                  type: 'SENT',
                  metadata: {
                    sentAt: new Date().toISOString(),
                    hasImage: !!imageUrl,
                    buttonsCount: buttons?.length || 0
                  }
                }
              });

              // Обновляем счетчик отправленных
              await db.mailing.update({
                where: { id: mailingId },
                data: {
                  sentCount: { increment: 1 }
                }
              });
            } else {
              error = result.errors.join(', ') || 'Ошибка отправки';
            }
          } catch (telegramError) {
            error =
              telegramError instanceof Error
                ? telegramError.message
                : 'Ошибка отправки в Telegram';
            logger.error('Telegram mailing error', {
              mailingId,
              recipientId,
              error: error,
              component: 'mailing-queue'
            });
          }
        } else {
          error = 'Пользователь не найден';
        }
        break;

      case 'WHATSAPP':
      case 'VIBER':
        // TODO: Интеграция с мессенджерами
        success = false;
        error = 'Интеграция с этим мессенджером еще не реализована';
        break;

      default:
        error = `Неизвестный тип рассылки: ${type}`;
    }

    // Обновляем статус получателя
    await db.mailingRecipient.update({
      where: { id: recipientId },
      data: {
        status: success ? 'SENT' : 'FAILED',
        sentAt: success ? new Date() : null,
        error: error || null
      }
    });

    // Создаем запись в истории для ошибок
    if (!success) {
      try {
        await db.mailingHistory.create({
          data: {
            mailingId,
            recipientId,
            userId: recipient.userId || undefined,
            type: 'FAILED',
            metadata: {
              error: error,
              failedAt: new Date().toISOString()
            }
          }
        });

        // Обновляем счетчик ошибок
        await db.mailing.update({
          where: { id: mailingId },
          data: {
            failedCount: { increment: 1 }
          }
        });
      } catch (historyError) {
        logger.error('Error creating mailing history', {
          mailingId,
          recipientId,
          error:
            historyError instanceof Error
              ? historyError.message
              : 'Unknown error',
          component: 'mailing-queue'
        });
      }
    }

    if (success) {
      logger.info('Mailing sent successfully', {
        jobId: job.id,
        mailingId,
        recipientId,
        type,
        component: 'mailing-queue'
      });
    } else {
      logger.error('Mailing failed', {
        jobId: job.id,
        mailingId,
        recipientId,
        type,
        error,
        component: 'mailing-queue'
      });
    }
  } catch (error) {
    logger.error('Error processing mailing job', {
      jobId: job.id,
      mailingId,
      recipientId,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailing-queue'
    });

    // Обновляем статус получателя
    await db.mailingRecipient.update({
      where: { id: recipientId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }
    });

    throw error;
  }
});

// Обработка ошибок
mailingQueue.on('failed', (job, error) => {
  logger.error('Mailing job failed', {
    jobId: job?.id,
    error: error.message,
    component: 'mailing-queue'
  });
});

// Обработка завершения
mailingQueue.on('completed', (job) => {
  logger.info('Mailing job completed', {
    jobId: job.id,
    component: 'mailing-queue'
  });
});
