/**
 * @file: src/lib/queues/mailing.queue.ts
 * @description: Bull очередь для асинхронной отправки рассылок
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { Queue, Worker, Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import type { MailingType } from '@prisma/client';
import { sendRichBroadcastMessage } from '@/lib/telegram/notifications';
import { createBullMQConnectionOptions } from '@/lib/queues/bullmq-connection';
import { MailingTrackerService } from '@/lib/services/mailing-tracker.service';

const queueConnection = createBullMQConnectionOptions('queue');
const workerConnection = createBullMQConnectionOptions('worker');

// Типы задач в очереди рассылок
export interface MailingJobData {
  mailingId: string;
  recipientId: string;
  type: MailingType;
  recipient: {
    userId?: string;
    email?: string;
    phone?: string;
    maxId?: string;
  };
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

// Создаем очередь для рассылок (только если Redis доступен)
export const mailingQueue = queueConnection
  ? new Queue<MailingJobData>('mailing', { connection: queueConnection })
  : null;

interface MailingButton {
  text: string;
  url?: string;
  callback_data?: string;
}

interface DeliveryOutcome {
  success: boolean;
  error?: string;
  errorCode?: number | string;
  retryAfter?: number;
  transient?: boolean;
  hasImage?: boolean;
  buttonsCount?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMailingButton(value: unknown): value is MailingButton {
  if (!isRecord(value) || typeof value.text !== 'string') return false;
  return (
    typeof value.url === 'string' || typeof value.callback_data === 'string'
  );
}

function getMaxAttempts(job: Job<MailingJobData>): number {
  const configured = job.opts.attempts;
  return typeof configured === 'number' && configured > 0 ? configured : 1;
}

function hasRetryRemaining(job: Job<MailingJobData>): boolean {
  return job.attemptsMade + 1 < getMaxAttempts(job);
}

function numericErrorCode(value: number | string | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

async function waitForRetryAfter(seconds: number | undefined): Promise<void> {
  if (!seconds || seconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function deliverMailingJob(
  job: Job<MailingJobData>,
  projectId: string
): Promise<DeliveryOutcome> {
  const { type, recipient, body, metadata } = job.data;

  if (type === 'EMAIL') {
    return {
      success: false,
      error: recipient.email
        ? 'Отправка Email ещё не подключена'
        : 'Email не указан'
    };
  }

  if (type === 'SMS') {
    return {
      success: false,
      error: recipient.phone
        ? 'Отправка SMS ещё не подключена'
        : 'Телефон не указан'
    };
  }

  if (type === 'TELEGRAM') {
    if (!recipient.userId) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const rawButtons = Array.isArray(metadata?.buttons)
      ? metadata.buttons.filter(isMailingButton)
      : undefined;

    // Оборачиваем ссылки в тексте и кнопках в трекинг-ссылки
    const { text: wrappedBody, buttons: wrappedButtons } =
      await MailingTrackerService.wrapMessageForRecipient(
        job.data.mailingId,
        job.data.recipientId,
        body,
        rawButtons
      );

    const imageUrl =
      typeof metadata?.imageUrl === 'string' ? metadata.imageUrl : undefined;
    const parseMode = metadata?.parseMode === 'Markdown' ? 'Markdown' : 'HTML';
    const result = await sendRichBroadcastMessage(
      projectId,
      {
        message: wrappedBody,
        imageUrl,
        buttons: wrappedButtons,
        parseMode,
        disableLinkPreview: true
      },
      [recipient.userId]
    );

    if (result.sent > 0) {
      return {
        success: true,
        hasImage: Boolean(imageUrl),
        buttonsCount: wrappedButtons?.length ?? 0
      };
    }

    const recipientResult =
      result.results.find((item) => item.userId === recipient.userId) ??
      result.results[0];
    return {
      success: false,
      error: recipientResult?.error ?? 'Ошибка отправки в Telegram',
      errorCode: recipientResult?.errorCode,
      retryAfter: recipientResult?.retryAfter,
      transient: recipientResult?.transient ?? false
    };
  }

  if (type === 'MAX') {
    if (!recipient.maxId) {
      return { success: false, error: 'Пользователь не привязан к MAX' };
    }
    const rawButtons = Array.isArray(metadata?.buttons)
      ? metadata.buttons.filter(isMailingButton)
      : undefined;
    const { text: wrappedBody, buttons: wrappedButtons } =
      await MailingTrackerService.wrapMessageForRecipient(
        job.data.mailingId,
        job.data.recipientId,
        body,
        rawButtons
      );
    const { maxBotManager } = await import('@/lib/max-bot/bot-manager');
    await maxBotManager.getBotForWebhook(projectId);
    const success = await maxBotManager.sendMessageToUser(
      projectId,
      Number(recipient.maxId),
      wrappedBody,
      {
        format: metadata?.parseMode === 'Markdown' ? 'markdown' : 'html',
        disableLinkPreview: true,
        buttons: wrappedButtons?.map((button) => ({
          text: button.text,
          ...(button.url ? { url: button.url } : {}),
          ...(button.callback_data ? { payload: button.callback_data } : {})
        }))
      }
    );
    return success
      ? {
          success: true,
          hasImage: false,
          buttonsCount: wrappedButtons?.length ?? 0
        }
      : { success: false, error: 'Ошибка отправки в MAX' };
  }

  return {
    success: false,
    error: 'Интеграция с этим мессенджером еще не реализована'
  };
}

async function completeMailingIfReady(mailingId: string): Promise<void> {
  const pendingRecipients = await db.mailingRecipient.count({
    where: { mailingId, status: 'PENDING' }
  });
  if (pendingRecipients !== 0) return;

  const [sentCount, failedCount] = await Promise.all([
    db.mailingRecipient.count({ where: { mailingId, status: 'SENT' } }),
    db.mailingRecipient.count({ where: { mailingId, status: 'FAILED' } })
  ]);

  await db.mailing.updateMany({
    where: { id: mailingId, status: 'SENDING' },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      sentCount,
      failedCount
    }
  });
}

async function finalizeDelivery(
  job: Job<MailingJobData>,
  outcome: DeliveryOutcome
): Promise<void> {
  const { mailingId, recipientId, recipient } = job.data;
  const completedAt = new Date();

  await db.$transaction([
    db.mailingRecipient.update({
      where: { id: recipientId },
      data: {
        status: outcome.success ? 'SENT' : 'FAILED',
        sentAt: outcome.success ? completedAt : null,
        error: outcome.error ?? null,
        errorCode: numericErrorCode(outcome.errorCode),
        errorDescription: outcome.error ?? null,
        retryAfter: outcome.retryAfter ?? null
      }
    }),
    db.mailingHistory.create({
      data: {
        mailingId,
        recipientId,
        userId: recipient.userId,
        type: outcome.success ? 'SENT' : 'FAILED',
        metadata: outcome.success
          ? {
              sentAt: completedAt.toISOString(),
              hasImage: outcome.hasImage ?? false,
              buttonsCount: outcome.buttonsCount ?? 0
            }
          : {
              error: outcome.error ?? 'Неизвестная ошибка',
              errorCode: outcome.errorCode,
              failedAt: completedAt.toISOString()
            }
      }
    }),
    db.mailing.update({
      where: { id: mailingId },
      data: outcome.success
        ? { sentCount: { increment: 1 } }
        : { failedCount: { increment: 1 } }
    })
  ]);

  await completeMailingIfReady(mailingId);
}

// Ленивая инициализация Worker
let mailingWorker: Worker<MailingJobData> | null = null;

export function getMailingWorker(): Worker<MailingJobData> | null {
  if (!workerConnection) {
    logger.warn('Mailing queue disabled: Redis not available');
    return null;
  }

  if (!mailingWorker) {
    mailingWorker = new Worker<MailingJobData>(
      'mailing',
      async (job: Job<MailingJobData>) => {
        const { mailingId, recipientId, type } = job.data;
        const [mailing, recipientRecord] = await Promise.all([
          db.mailing.findUnique({
            where: { id: mailingId },
            select: { projectId: true, status: true }
          }),
          db.mailingRecipient.findUnique({
            where: { id: recipientId },
            select: { status: true, mailingId: true }
          })
        ]);

        if (!mailing) throw new Error('Рассылка не найдена');
        if (!recipientRecord) throw new Error('Получатель рассылки не найден');
        if (recipientRecord.mailingId !== mailingId) {
          throw new Error('Получатель не принадлежит этой рассылке');
        }
        if (mailing.status === 'CANCELLED') {
          logger.info('Mailing job skipped because mailing was cancelled', {
            jobId: job.id,
            mailingId,
            recipientId,
            component: 'mailing-queue'
          });
          return;
        }
        if (recipientRecord.status === 'SENT') return;

        await db.mailingRecipient.update({
          where: { id: recipientId },
          data: {
            attemptCount: { increment: 1 },
            maxAttempts: getMaxAttempts(job),
            lastAttemptAt: new Date()
          }
        });

        logger.info('Processing mailing job', {
          jobId: job.id,
          mailingId,
          recipientId,
          type,
          attempt: job.attemptsMade + 1,
          maxAttempts: getMaxAttempts(job),
          component: 'mailing-queue'
        });

        let outcome: DeliveryOutcome;
        try {
          outcome = await deliverMailingJob(job, mailing.projectId);
        } catch (error) {
          outcome = {
            success: false,
            error:
              error instanceof Error ? error.message : 'Неизвестная ошибка',
            transient: true
          };
        }

        if (!outcome.success && outcome.transient && hasRetryRemaining(job)) {
          await db.mailingRecipient.update({
            where: { id: recipientId },
            data: {
              status: 'PENDING',
              error: outcome.error ?? null,
              errorCode: numericErrorCode(outcome.errorCode),
              errorDescription: outcome.error ?? null,
              retryAfter: outcome.retryAfter ?? null
            }
          });
          await waitForRetryAfter(outcome.retryAfter);
          throw new Error(outcome.error ?? 'Временная ошибка доставки');
        }

        await finalizeDelivery(job, outcome);

        const logContext = {
          jobId: job.id,
          mailingId,
          recipientId,
          type,
          error: outcome.error,
          component: 'mailing-queue'
        };
        if (outcome.success) {
          logger.info('Mailing sent successfully', logContext);
        } else {
          logger.error('Mailing failed permanently', logContext);
        }
      },
      {
        connection: workerConnection,
        concurrency: 10,
        // Один job с длинной подписью и изображением может вызвать два
        // Telegram API-вызова, поэтому 15 jobs/sec оставляют запас до 30/sec.
        limiter: { max: 15, duration: 1000 }
      }
    );
  }

  return mailingWorker;
}
