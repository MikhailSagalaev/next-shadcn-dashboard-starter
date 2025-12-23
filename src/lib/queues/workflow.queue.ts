/**
 * @file: workflow.queue.ts
 * @description: Bull очередь для асинхронной обработки тяжелых workflow операций
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-10-31
 * @author: AI Assistant + User
 */

import { Queue, Worker, Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';
import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import { ExecutionContextManager } from '@/lib/services/workflow/execution-context-manager';

// Конфигурация Redis для очередей
const getRedisConfig = () => {
  // Проверяем доступность Redis
  const hasRedisUrl = !!process.env.REDIS_URL;
  const hasRedisHost = !!process.env.REDIS_HOST;

  if (!hasRedisUrl && !hasRedisHost) {
    return null; // Redis недоступен
  }

  if (process.env.REDIS_HOST) {
    return {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    };
  }

  return {
    connection: process.env.REDIS_URL || 'redis://localhost:6379'
  };
};

const redisConfig = getRedisConfig();

// Типы задач в workflow очереди
export interface WorkflowJobData {
  type:
    | 'heavy_workflow_execution'
    | 'user_variables_update'
    | 'statistics_aggregation';
  projectId: string;
  executionId?: string;
  userId?: string;
  context?: any;
  trigger?: 'start' | 'message' | 'callback';
  retryCount?: number;
  timestamp?: number;
}

// Создаем очередь для workflow операций (только если Redis доступен)
export const workflowQueue = redisConfig
  ? new Queue<WorkflowJobData>('workflow-processing', redisConfig as any)
  : null;

// Ленивая инициализация Worker
let workflowWorker: Worker<WorkflowJobData> | null = null;

export function getWorkflowWorker(): Worker<WorkflowJobData> | null {
  if (!redisConfig) {
    logger.warn('Workflow queue disabled: Redis not available');
    return null;
  }

  if (!workflowWorker) {
    workflowWorker = new Worker<WorkflowJobData>(
      'workflow-processing',
      async (job: Job<WorkflowJobData>) => {
        const {
          type,
          projectId,
          executionId,
          context,
          trigger,
          userId,
          timestamp
        } = job.data;

        try {
          switch (type) {
            case 'heavy_workflow_execution':
              logger.info('Processing heavy workflow execution job', {
                jobId: job.id,
                projectId,
                executionId,
                trigger
              });

              const result = await WorkflowRuntimeService.executeWorkflow(
                projectId,
                trigger || 'message',
                context
              );

              logger.info('Heavy workflow execution completed', {
                jobId: job.id,
                projectId,
                executionId,
                result,
                processingTime: Date.now() - (timestamp || 0)
              });

              return result;

            case 'user_variables_update':
              logger.info('Processing user variables update job', {
                jobId: job.id,
                projectId,
                userId
              });

              logger.info('User variables update completed', {
                jobId: job.id,
                projectId,
                userId,
                processingTime: Date.now() - (timestamp || 0)
              });

              return { success: true };

            case 'statistics_aggregation':
              logger.info('Processing statistics aggregation job', {
                jobId: job.id,
                projectId
              });

              logger.info('Statistics aggregation completed', {
                jobId: job.id,
                projectId,
                processingTime: Date.now() - (timestamp || 0)
              });

              return { success: true };

            default:
              throw new Error(`Unknown workflow job type: ${type}`);
          }
        } catch (error) {
          logger.error(`Failed to process workflow job ${type}`, {
            jobId: job.id,
            projectId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }
      },
      redisConfig as any
    );
  }

  return workflowWorker;
}

// Функции для добавления задач в очередь
export const addHeavyWorkflowJob = async (
  projectId: string,
  executionId: string,
  context: any,
  trigger: 'start' | 'message' | 'callback' = 'message'
): Promise<void> => {
  if (!workflowQueue) {
    logger.warn('Workflow queue not available, skipping heavy workflow job', {
      projectId,
      executionId
    });
    return;
  }

  try {
    await workflowQueue.add(
      'heavy_workflow_execution' as any,
      {
        type: 'heavy_workflow_execution',
        projectId,
        executionId,
        context,
        trigger,
        timestamp: Date.now()
      },
      {
        priority: 1, // Высокий приоритет для workflow
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10, // Удаляем после выполнения
        removeOnFail: 5
      }
    );

    logger.info('Added heavy workflow job to queue', {
      projectId,
      executionId,
      trigger
    });
  } catch (error) {
    logger.error('Failed to add heavy workflow job to queue', {
      projectId,
      executionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const addUserVariablesUpdateJob = async (
  projectId: string,
  userId: string
): Promise<void> => {
  if (!workflowQueue) {
    logger.warn(
      'Workflow queue not available, skipping user variables update job',
      {
        projectId,
        userId
      }
    );
    return;
  }

  try {
    await workflowQueue.add(
      'user_variables_update' as any,
      {
        type: 'user_variables_update',
        projectId,
        userId,
        timestamp: Date.now()
      },
      {
        priority: 2, // Средний приоритет
        attempts: 2,
        removeOnComplete: 20,
        removeOnFail: 10
      }
    );

    logger.debug('Added user variables update job to queue', {
      projectId,
      userId
    });
  } catch (error) {
    logger.error('Failed to add user variables update job to queue', {
      projectId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const addStatisticsAggregationJob = async (
  projectId: string
): Promise<void> => {
  if (!workflowQueue) {
    logger.warn(
      'Workflow queue not available, skipping statistics aggregation job',
      {
        projectId
      }
    );
    return;
  }

  try {
    await workflowQueue.add(
      'statistics_aggregation' as any,
      {
        type: 'statistics_aggregation',
        projectId,
        timestamp: Date.now()
      },
      {
        priority: 3, // Низкий приоритет
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 20
      }
    );

    logger.debug('Added statistics aggregation job to queue', {
      projectId
    });
  } catch (error) {
    logger.error('Failed to add statistics aggregation job to queue', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Мониторинг Worker (только если Redis доступен)
if (redisConfig) {
  const worker = getWorkflowWorker();
  if (worker) {
    worker.on('completed', (job) => {
      logger.debug('Workflow job completed', {
        jobId: job.id,
        type: job.data.type,
        projectId: job.data.projectId,
        processingTime: Date.now() - (job.data.timestamp || 0)
      });
    });

    worker.on('failed', (job, err) => {
      logger.error('Workflow job failed', {
        jobId: job?.id,
        type: job?.data?.type,
        projectId: job?.data?.projectId,
        error: err.message,
        attempts: job?.attemptsMade
      });
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn('Workflow job stalled', {
        jobId
      });
    });
  }
}

export default workflowQueue;
