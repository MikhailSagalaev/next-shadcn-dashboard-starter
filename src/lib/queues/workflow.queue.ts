/**
 * @file: workflow.queue.ts
 * @description: Bull очередь для асинхронной обработки тяжелых workflow операций
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-10-31
 * @author: AI Assistant + User
 */

import Bull from 'bull';
import { logger } from '@/lib/logger';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';
import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import { ExecutionContextManager } from '@/lib/services/workflow/execution-context-manager';

// Конфигурация Redis для очередей (используем существующую из webhook.queue.ts)
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
};

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

// Создаем очередь для workflow операций
export const workflowQueue = new Bull<WorkflowJobData>(
  'workflow-processing',
  redisConfig
);

// Обработчики задач workflow очереди
workflowQueue.process('heavy_workflow_execution', async (job) => {
  const { projectId, executionId, context, trigger } = job.data;
  logger.info('Processing heavy workflow execution job', {
    jobId: job.id,
    projectId,
    executionId,
    trigger
  });

  try {
    // Выполняем тяжелую workflow операцию асинхронно
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
      processingTime: Date.now() - job.timestamp
    });

    return result;
  } catch (error) {
    logger.error('Failed to process heavy workflow execution', {
      jobId: job.id,
      projectId,
      executionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});

workflowQueue.process('user_variables_update', async (job) => {
  const { projectId, userId } = job.data;
  logger.info('Processing user variables update job', {
    jobId: job.id,
    projectId,
    userId
  });

  try {
    // Здесь можно реализовать обновление кеша user variables
    // Пока просто логируем
    logger.info('User variables update completed', {
      jobId: job.id,
      projectId,
      userId,
      processingTime: Date.now() - job.timestamp
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to process user variables update', {
      jobId: job.id,
      projectId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});

workflowQueue.process('statistics_aggregation', async (job) => {
  const { projectId } = job.data;
  logger.info('Processing statistics aggregation job', {
    jobId: job.id,
    projectId
  });

  try {
    // Здесь можно реализовать агрегацию статистики проекта
    // Пока просто логируем
    logger.info('Statistics aggregation completed', {
      jobId: job.id,
      projectId,
      processingTime: Date.now() - job.timestamp
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to process statistics aggregation', {
      jobId: job.id,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});

// Функции для добавления задач в очередь
export const addHeavyWorkflowJob = async (
  projectId: string,
  executionId: string,
  context: any,
  trigger: 'start' | 'message' | 'callback' = 'message'
): Promise<void> => {
  try {
    await workflowQueue.add(
      'heavy_workflow_execution',
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
  try {
    await workflowQueue.add(
      'user_variables_update',
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
  try {
    await workflowQueue.add(
      'statistics_aggregation',
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

// Мониторинг очереди
workflowQueue.on('completed', (job, result) => {
  logger.debug('Workflow job completed', {
    jobId: job.id,
    type: job.data.type,
    projectId: job.data.projectId,
    processingTime: Date.now() - job.timestamp
  });
});

workflowQueue.on('failed', (job, err) => {
  logger.error('Workflow job failed', {
    jobId: job?.id,
    type: job?.data?.type,
    projectId: job?.data?.projectId,
    error: err.message,
    attempts: job?.attemptsMade
  });
});

workflowQueue.on('stalled', (job) => {
  logger.warn('Workflow job stalled', {
    jobId: job?.id,
    type: job?.data?.type,
    projectId: job?.data?.projectId
  });
});

export default workflowQueue;
