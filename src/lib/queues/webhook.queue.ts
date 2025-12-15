/**
 * @file: webhook.queue.ts
 * @description: Bull очереди для асинхронной обработки webhook запросов
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

import { Queue, Worker, Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { UserService, BonusService } from '@/lib/services/user.service';
import { sendBonusNotification } from '@/lib/telegram/notifications';
import type {
  WebhookRegisterUserPayload,
  WebhookPurchasePayload,
  WebhookSpendBonusesPayload
} from '@/types/bonus';

// Конфигурация Redis для очередей
const getRedisConfig = (): { connection: { host: string; port: number; password?: string } } | null => {
  // Проверяем доступность Redis
  const hasRedisUrl = !!process.env.REDIS_URL;
  const hasRedisHost = !!process.env.REDIS_HOST;

  if (!hasRedisUrl && !hasRedisHost) {
    return null; // Redis недоступен
  }

  if (process.env.REDIS_URL) {
    // Парсим REDIS_URL в объект connection
    try {
      const url = new URL(process.env.REDIS_URL);
      return {
        connection: {
          host: url.hostname || 'localhost',
          port: parseInt(url.port || '6379'),
          password: url.password || undefined
        }
      };
    } catch {
      return null;
    }
  }

  return {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined
    }
  };
};

const redisConfig = getRedisConfig();

// Типы задач в очереди
export interface WebhookJobData {
  type: 'register_user' | 'purchase' | 'spend_bonuses' | 'tilda_order';
  projectId: string;
  payload: any;
  webhookSecret: string;
  timestamp: number;
  retryCount?: number;
}

// Создаем очереди (только если Redis доступен)
export const webhookQueue = redisConfig ? new Queue<WebhookJobData>(
  'webhook-processing',
  redisConfig
) : null;
export const notificationQueue = redisConfig ? new Queue('notifications', redisConfig) : null;
export const analyticsQueue = redisConfig ? new Queue('analytics-update', redisConfig) : null;

// Ленивая инициализация Workers
let webhookWorker: Worker<WebhookJobData> | null = null;

export function getWebhookWorker(): Worker<WebhookJobData> | null {
  if (!redisConfig) {
    logger.warn('Webhook queue disabled: Redis not available');
    return null;
  }

  if (!webhookWorker) {
    webhookWorker = new Worker<WebhookJobData>(
      'webhook-processing',
      async (job: Job<WebhookJobData>) => {
    const { type, projectId, payload } = job.data;
    logger.info(`Processing ${type} job`, { jobId: job.id, projectId });

    try {
      let result;
      
      switch (type) {
        case 'register_user':
          result = await processUserRegistration(projectId, payload);
          // Добавляем задачу на отправку приветственного уведомления (если очередь доступна)
          if (notificationQueue) {
            await notificationQueue.add(
              'welcome',
              {
                userId: result.user.id,
                projectId
              },
              {
                delay: 1000 // Отправить через 1 секунду
              }
            );
          }
          break;
          
        case 'purchase':
          result = await processPurchase(projectId, payload);
          // Добавляем задачи на обновление аналитики и отправку уведомления (если очереди доступны)
          const tasks = [];
          if (analyticsQueue) {
            tasks.push(analyticsQueue.add('update-user-stats', {
              userId: result.user.id,
              projectId,
              amount: payload.amount
            }));
          }
          if (notificationQueue) {
            tasks.push(notificationQueue.add('bonus-earned', {
              userId: result.user.id,
              bonusId: result.bonus.id,
              projectId
            }));
          }
          if (tasks.length > 0) {
            await Promise.all(tasks);
          }
          break;
          
        case 'spend_bonuses':
          result = await processSpendBonuses(projectId, payload);
          // Добавляем задачу на отправку уведомления (если очередь доступна)
          if (notificationQueue) {
            await notificationQueue.add('bonus-spent', {
              userId: result.user.id,
              amount: payload.amount,
              projectId
            });
          }
          break;
          
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to process ${type}`, {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
  redisConfig
);

    // Обработчики событий для Workers
    webhookWorker.on('completed', (job) => {
      logger.info('Webhook job completed', {
        jobId: job.id,
        type: job.data.type,
        duration: Date.now() - job.data.timestamp
      });
    });

    webhookWorker.on('failed', (job, err) => {
      logger.error('Webhook job failed', {
        jobId: job?.id,
        type: job?.data?.type,
        error: err.message,
        attempts: job?.attemptsMade
      });
    });

    webhookWorker.on('stalled', (jobId: string) => {
      logger.warn('Webhook job stalled', {
        jobId
      });
    });
  }
  
  return webhookWorker;
}

// Worker для notification очереди (только если Redis доступен)
export const notificationWorker = redisConfig ? new Worker(
  'notifications',
  async (job: Job) => {
    const { name, data } = job;
    
    try {
      switch (name) {
        case 'welcome':
          const { userId, projectId } = data;
          logger.info('Sending welcome notification', { userId, projectId });
          // await sendWelcomeNotification(userId, projectId);
          break;
          
        case 'bonus-earned':
          const { userId: earnUserId, bonusId, projectId: earnProjectId } = data;
          const user = await db.user.findUnique({ where: { id: earnUserId } });
          const bonus = await db.bonus.findUnique({ where: { id: bonusId } });
          
          if (user && bonus) {
            await sendBonusNotification(user as any, bonus as any, earnProjectId);
          }
          break;
          
        case 'bonus-spent':
          const { userId: spentUserId, amount, projectId: spentProjectId } = data;
          logger.info('Sending bonus spent notification', { 
            userId: spentUserId, 
            amount, 
            projectId: spentProjectId 
          });
          break;
          
        default:
          logger.warn(`Unknown notification job type: ${name}`);
      }
    } catch (error) {
      logger.error(`Failed to process notification ${name}`, {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Не пробрасываем ошибку для уведомлений
    }
  },
  redisConfig
) : null;

// Worker для analytics очереди (только если Redis доступен)
export const analyticsWorker = redisConfig
  ? new Worker(
      'analytics-update',
      async (job: Job) => {
        const { userId, projectId, amount } = job.data;

        try {
          // Обновляем статистику пользователя
          await db.user.update({
            where: { id: userId },
            data: {
              totalPurchases: {
                increment: amount
              }
            }
          });

          // Инвалидируем кэш аналитики и проекта
          try {
            const { CacheService } = await import('@/lib/redis');
            await CacheService.invalidateProject(projectId);
          } catch {}
        } catch (error) {
          logger.error('Failed to update user stats', {
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },
      redisConfig
    )
  : null;



// Настройки повторных попыток для BullMQ
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000
  },
  removeOnComplete: 100, // Хранить последние 100 выполненных задач
  removeOnFail: 50 // Хранить последние 50 неудачных задач
};

// Функция для добавления задачи в очередь
export async function enqueueWebhookJob(
  type: WebhookJobData['type'],
  projectId: string,
  payload: any,
  options: any = {}
): Promise<Job<WebhookJobData> | null> {
  if (!webhookQueue) {
    logger.warn('Webhook queue not available, cannot enqueue job', {
      type,
      projectId
    });
    return null;
  }

  const jobData: WebhookJobData = {
    type,
    projectId,
    payload,
    webhookSecret: '', // Заполняется при необходимости
    timestamp: Date.now()
  };

  const job = await webhookQueue.add(type, jobData, {
    ...defaultJobOptions,
    ...options
  });

  logger.info('Webhook job enqueued', {
    jobId: job.id,
    type,
    projectId
  });

  return job;
}

// Вспомогательные функции обработки (перенесены из route.ts)
async function processUserRegistration(
  projectId: string,
  payload: WebhookRegisterUserPayload
) {
  const {
    email,
    phone,
    firstName,
    lastName,
    birthDate,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    referralCode
  } = payload;

  if (!email && !phone) {
    throw new Error('Должен быть указан email или телефон');
  }

  // Проверяем существование пользователя
  const existingUser = await UserService.findUserByContact(
    projectId,
    email,
    phone
  );

  if (existingUser) {
    return {
      success: true,
      message: 'Пользователь уже существует',
      user: existingUser
    };
  }

  // Создаем нового пользователя
  const user = await UserService.createUser({
    projectId,
    email,
    phone,
    firstName,
    lastName,
    birthDate: birthDate ? new Date(birthDate) : undefined,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    referralCode
  });

  return {
    success: true,
    message: 'Пользователь успешно зарегистрирован',
    user
  };
}

async function processPurchase(
  projectId: string,
  payload: WebhookPurchasePayload
) {
  const { userEmail, userPhone, purchaseAmount, orderId, description } =
    payload;

  if (!userEmail && !userPhone) {
    throw new Error('Должен быть указан email или телефон пользователя');
  }

  // Находим пользователя
  const user = await UserService.findUserByContact(
    projectId,
    userEmail,
    userPhone
  );

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  // Начисляем бонусы
  const result = await BonusService.awardPurchaseBonus(
    user.id,
    purchaseAmount,
    orderId,
    description
  );

  // Получаем баланс
  const balance = await UserService.getUserBalance(user.id);

  return {
    success: true,
    message: 'Бонусы успешно начислены',
    user,
    bonus: result.bonus,
    balance,
    levelInfo: result.levelInfo,
    referralInfo: result.referralInfo
  };
}

async function processSpendBonuses(
  projectId: string,
  payload: WebhookSpendBonusesPayload
) {
  const {
    userEmail,
    userPhone,
    bonusAmount: amount,
    orderId,
    description
  } = payload;

  if (!userEmail && !userPhone) {
    throw new Error('Должен быть указан email или телефон пользователя');
  }

  // Находим пользователя
  const user = await UserService.findUserByContact(
    projectId,
    userEmail,
    userPhone
  );

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  // Списываем бонусы
  const transactions = await BonusService.spendBonuses(
    user.id,
    amount,
    description || `Списание бонусов для заказа ${orderId}`,
    { orderId }
  );

  // Получаем обновленный баланс
  const balance = await UserService.getUserBalance(user.id);

  // Считаем общую сумму списанных бонусов
  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    success: true,
    message: 'Бонусы успешно списаны',
    user,
    spent: {
      amount: totalSpent,
      transactionsCount: transactions.length
    },
    balance
  };
}

// Dashboard для мониторинга очередей
export async function getQueueStats() {
  if (!webhookQueue || !notificationQueue || !analyticsQueue) {
    return {
      webhook: { waiting: 0, active: 0, completed: 0, failed: 0 },
      notifications: { waiting: 0, active: 0, completed: 0, failed: 0 },
      analytics: { waiting: 0, active: 0, completed: 0, failed: 0 }
    };
  }

  const [webhookStats, notificationStats, analyticsStats] = await Promise.all([
    webhookQueue.getJobCounts(),
    notificationQueue.getJobCounts(),
    analyticsQueue.getJobCounts()
  ]);

  return {
    webhook: webhookStats,
    notifications: notificationStats,
    analytics: analyticsStats
  };
}

// Graceful shutdown
export async function closeQueues() {
  const closeTasks = [];
  
  if (webhookQueue) closeTasks.push(webhookQueue.close());
  if (notificationQueue) closeTasks.push(notificationQueue.close());
  if (analyticsQueue) closeTasks.push(analyticsQueue.close());
  if (webhookWorker) closeTasks.push(webhookWorker.close());
  if (notificationWorker) closeTasks.push(notificationWorker.close());
  if (analyticsWorker) closeTasks.push(analyticsWorker.close());
  
  if (closeTasks.length > 0) {
    await Promise.all(closeTasks);
  }
}
