/**
 * @file: src/lib/services/workflow/delay-job.service.ts
 * @description: Сервис для управления отложенными задачами workflow через Bull queue
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis, workflow-runtime.service
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import Bull from 'bull';
import { logger } from '@/lib/logger';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';

// Максимальная задержка: 24 часа (в миллисекундах)
const MAX_DELAY_MS = 24 * 60 * 60 * 1000; // 86400000 ms

// Конфигурация Redis для очереди задержек
const getRedisConfig = () => {
  // Если Redis клиент создан с host/port, используем их
  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };
  }
  
  // Иначе используем REDIS_URL
  return {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  };
};

// Создаем очередь для отложенных задач workflow
export const delayQueue = new Bull('workflow-delays', getRedisConfig());

// Интерфейс для данных задачи задержки
export interface DelayJobData {
  executionId: string;
  nodeId: string;
  projectId: string;
  workflowId: string;
  delayMs: number;
  createdAt: number;
}

/**
 * Сервис для управления отложенными задачами workflow
 */
export class DelayJobService {
  private static initialized = false;

  /**
   * Инициализирует обработчик очереди задержек
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Обработчик выполнения отложенных задач
    delayQueue.process(async (job: Bull.Job<DelayJobData>) => {
      const { executionId, nodeId, projectId, workflowId } = job.data;

      logger.info('Processing workflow delay job', {
        jobId: job.id,
        executionId,
        nodeId,
        projectId,
        workflowId,
        delayMs: job.data.delayMs
      });

      try {
        // Возобновляем выполнение workflow с указанной ноды
        await WorkflowRuntimeService.resumeWorkflowAfterDelay(
          executionId,
          nodeId,
          projectId,
          workflowId
        );

        logger.info('Workflow delay job completed successfully', {
          jobId: job.id,
          executionId
        });
      } catch (error) {
        logger.error('Workflow delay job failed', {
          jobId: job.id,
          executionId,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error; // Bull автоматически обработает retry
      }
    });

    // Обработчики событий очереди
    delayQueue.on('completed', (job: Bull.Job<DelayJobData>) => {
      logger.debug('Delay job completed', {
        jobId: job.id,
        executionId: job.data.executionId
      });
    });

    delayQueue.on('failed', (job: Bull.Job<DelayJobData> | undefined, error: Error) => {
      logger.error('Delay job failed', {
        jobId: job?.id,
        executionId: job?.data.executionId,
        error: error.message
      });
    });

    delayQueue.on('stalled', (job: Bull.Job<DelayJobData>) => {
      logger.warn('Delay job stalled', {
        jobId: job.id,
        executionId: job.data.executionId
      });
    });

    this.initialized = true;
    logger.info('✅ DelayJobService initialized');
  }

  /**
   * Планирует отложенное выполнение workflow
   * @param executionId ID выполнения workflow
   * @param nodeId ID ноды, с которой продолжить выполнение
   * @param projectId ID проекта
   * @param workflowId ID workflow
   * @param delayMs Задержка в миллисекундах
   * @returns Job ID для возможности отмены
   */
  static async scheduleDelay(
    executionId: string,
    nodeId: string,
    projectId: string,
    workflowId: string,
    delayMs: number
  ): Promise<string> {
    // Валидация максимальной задержки
    if (delayMs > MAX_DELAY_MS) {
      throw new Error(
        `Delay exceeds maximum allowed time (24 hours). Requested: ${delayMs}ms, Max: ${MAX_DELAY_MS}ms`
      );
    }

    if (delayMs < 0) {
      throw new Error(`Delay must be non-negative. Got: ${delayMs}ms`);
    }

    // Для задержек менее 1 секунды используем синхронное ожидание
    // (Bull не эффективен для очень коротких задержек)
    if (delayMs < 1000) {
      logger.debug('Delay is less than 1 second, using synchronous wait', {
        executionId,
        delayMs
      });
      // Возвращаем специальный маркер для синхронной обработки
      return `sync:${Date.now()}`;
    }

    const jobData: DelayJobData = {
      executionId,
      nodeId,
      projectId,
      workflowId,
      delayMs,
      createdAt: Date.now()
    };

    // Создаем задачу в очереди с задержкой
    const job = await delayQueue.add(jobData, {
      delay: delayMs,
      attempts: 3, // 3 попытки при ошибке
      backoff: {
        type: 'exponential',
        delay: 2000 // Начинаем с 2 секунд
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Храним завершенные задачи 24 часа
        count: 1000 // Максимум 1000 завершенных задач
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60 // Храним неудачные задачи 7 дней
      }
    });

    logger.info('Workflow delay scheduled', {
      jobId: job.id,
      executionId,
      nodeId,
      delayMs,
      scheduledFor: new Date(Date.now() + delayMs).toISOString()
    });

    return job.id.toString();
  }

  /**
   * Отменяет запланированную задержку
   * @param jobId ID задачи
   */
  static async cancelDelay(jobId: string): Promise<void> {
    if (jobId.startsWith('sync:')) {
      // Синхронные задержки нельзя отменить
      logger.warn('Cannot cancel synchronous delay', { jobId });
      return;
    }

    const job = await delayQueue.getJob(jobId);
    if (!job) {
      logger.warn('Delay job not found', { jobId });
      return;
    }

    await job.remove();
    logger.info('Workflow delay cancelled', { jobId });
  }

  /**
   * Получает информацию о запланированной задержке
   * @param jobId ID задачи
   */
  static async getDelayStatus(jobId: string): Promise<{
    id: string;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
    delayMs: number;
    scheduledFor: Date | null;
  } | null> {
    if (jobId.startsWith('sync:')) {
      return {
        id: jobId,
        status: 'active',
        delayMs: 0,
        scheduledFor: null
      };
    }

    const job = await delayQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const delay = job.opts.delay || 0;

    return {
      id: job.id!.toString(),
      status: state as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused',
      delayMs: delay,
      scheduledFor: delay > 0 ? new Date(Date.now() + delay) : null
    };
  }

  /**
   * Очищает старые завершенные задачи
   */
  static async cleanup(): Promise<void> {
    await delayQueue.clean(24 * 60 * 60 * 1000, 'completed', 1000); // 24 часа
    await delayQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed', 100); // 7 дней
    logger.info('Delay queue cleaned');
  }

  /**
   * Получает статистику очереди
   */
  static async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      delayQueue.getWaitingCount(),
      delayQueue.getActiveCount(),
      delayQueue.getCompletedCount(),
      delayQueue.getFailedCount(),
      delayQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed
    };
  }

  /**
   * Graceful shutdown очереди
   */
  static async shutdown(): Promise<void> {
    logger.info('Shutting down delay queue...');
    await delayQueue.close();
    logger.info('Delay queue shutdown complete');
  }
}

// Автоматическая инициализация при импорте модуля
DelayJobService.initialize();
