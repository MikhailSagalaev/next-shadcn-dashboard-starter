/**
 * @file: workflow.queue.ts
 * @description: BullMQ queue for asynchronous workflow processing, including scheduled per-user runs.
 * @project: SaaS Bonus System
 * @dependencies: bullmq, ioredis
 * @created: 2025-10-31
 * @author: AI Assistant + User
 */

import { Job, Queue, Worker } from 'bullmq';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createBullMQConnectionOptions } from '@/lib/queues/bullmq-connection';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';

interface WorkflowJobBase {
  projectId: string;
  timestamp?: number;
}

interface HeavyWorkflowExecutionJobData extends WorkflowJobBase {
  type: 'heavy_workflow_execution';
  executionId: string;
  context?: unknown;
  trigger?: 'start' | 'message' | 'callback';
}

interface UserVariablesUpdateJobData extends WorkflowJobBase {
  type: 'user_variables_update';
  userId: string;
}

interface StatisticsAggregationJobData extends WorkflowJobBase {
  type: 'statistics_aggregation';
}

export interface ScheduledWorkflowExecutionJobData extends WorkflowJobBase {
  type: 'scheduled_workflow_execution';
  ledgerRunId: string;
  workflowId: string;
  workflowVersionId: string;
  userId: string;
}

export type WorkflowJobData =
  | HeavyWorkflowExecutionJobData
  | UserVariablesUpdateJobData
  | StatisticsAggregationJobData
  | ScheduledWorkflowExecutionJobData;

const queueConnection = createBullMQConnectionOptions('queue');
const workerConnection = createBullMQConnectionOptions('worker');

export const workflowQueue = queueConnection
  ? new Queue<WorkflowJobData>('workflow-processing', {
      connection: queueConnection
    })
  : null;

let workflowWorker: Worker<WorkflowJobData> | null = null;
let workflowQueueClosed = false;
let workflowQueueClosePromise: Promise<void> | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function processScheduledWorkflowJob(
  data: ScheduledWorkflowExecutionJobData
): Promise<{ success: true; skipped?: true }> {
  const run = await db.scheduledWorkflowRun.findUnique({
    where: { id: data.ledgerRunId }
  });

  if (!run) {
    throw new Error(`Scheduled workflow run ${data.ledgerRunId} not found`);
  }
  if (
    run.projectId !== data.projectId ||
    run.workflowId !== data.workflowId ||
    run.workflowVersionId !== data.workflowVersionId ||
    run.userId !== data.userId
  ) {
    throw new Error(
      `Scheduled workflow job ${data.ledgerRunId} does not match its ledger claim`
    );
  }
  if (run.status === 'COMPLETED') {
    return { success: true, skipped: true };
  }

  await db.scheduledWorkflowRun.update({
    where: { id: data.ledgerRunId },
    data: {
      status: 'RUNNING',
      attempts: { increment: 1 },
      startedAt: new Date(),
      completedAt: null,
      lastError: null
    }
  });

  try {
    const { ScheduledTriggerRunner } = await import(
      '@/lib/services/workflow/scheduled/scheduled-trigger-runner'
    );
    await ScheduledTriggerRunner.executeQueuedExecution(data);

    await db.scheduledWorkflowRun.update({
      where: { id: data.ledgerRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastError: null
      }
    });

    return { success: true };
  } catch (error) {
    const message = errorMessage(error);
    try {
      await db.scheduledWorkflowRun.update({
        where: { id: data.ledgerRunId },
        data: {
          status: 'FAILED',
          lastError: message.slice(0, 2000)
        }
      });
    } catch (ledgerError) {
      logger.error('Failed to mark scheduled workflow run as failed', {
        ledgerRunId: data.ledgerRunId,
        error: errorMessage(ledgerError)
      });
    }
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unknown workflow job data: ${JSON.stringify(value)}`);
}

export function getWorkflowWorker(): Worker<WorkflowJobData> | null {
  if (!workerConnection || workflowQueueClosed) {
    logger.warn(
      workflowQueueClosed
        ? 'Workflow queue disabled: queue is closed'
        : 'Workflow queue disabled: Redis not available'
    );
    return null;
  }

  if (!workflowWorker) {
    workflowWorker = new Worker<WorkflowJobData>(
      'workflow-processing',
      async (job: Job<WorkflowJobData>) => {
        const data = job.data;

        try {
          switch (data.type) {
            case 'heavy_workflow_execution': {
              logger.info('Processing heavy workflow execution job', {
                jobId: job.id,
                projectId: data.projectId,
                executionId: data.executionId,
                trigger: data.trigger
              });

              const result = await WorkflowRuntimeService.executeWorkflow(
                data.projectId,
                data.trigger || 'message',
                data.context
              );

              logger.info('Heavy workflow execution completed', {
                jobId: job.id,
                projectId: data.projectId,
                executionId: data.executionId,
                result,
                processingTime: Date.now() - (data.timestamp || 0)
              });
              return result;
            }
            case 'scheduled_workflow_execution':
              logger.info('Processing scheduled workflow execution job', {
                jobId: job.id,
                projectId: data.projectId,
                workflowId: data.workflowId,
                userId: data.userId,
                ledgerRunId: data.ledgerRunId
              });
              return processScheduledWorkflowJob(data);
            case 'user_variables_update':
              logger.info('User variables update completed', {
                jobId: job.id,
                projectId: data.projectId,
                userId: data.userId,
                processingTime: Date.now() - (data.timestamp || 0)
              });
              return { success: true };
            case 'statistics_aggregation':
              logger.info('Statistics aggregation completed', {
                jobId: job.id,
                projectId: data.projectId,
                processingTime: Date.now() - (data.timestamp || 0)
              });
              return { success: true };
            default:
              return assertNever(data);
          }
        } catch (error) {
          logger.error(`Failed to process workflow job ${data.type}`, {
            jobId: job.id,
            projectId: data.projectId,
            error: errorMessage(error)
          });
          throw error;
        }
      },
      {
        connection: workerConnection
      }
    );
  }

  return workflowWorker;
}

export function closeWorkflowQueue(): Promise<void> {
  if (workflowQueueClosePromise) return workflowQueueClosePromise;

  workflowQueueClosed = true;
  const workerToClose = workflowWorker;
  workflowWorker = null;

  workflowQueueClosePromise = (async () => {
    const results = await Promise.allSettled([
      workerToClose?.close() ?? Promise.resolve(),
      workflowQueue?.close() ?? Promise.resolve()
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error('Failed to close workflow queue resource', {
          error: errorMessage(result.reason)
        });
      }
    }
  })();

  return workflowQueueClosePromise;
}

export async function addScheduledWorkflowExecutionJob(
  data: ScheduledWorkflowExecutionJobData
): Promise<void> {
  if (!workflowQueue) {
    throw new Error('Workflow queue is unavailable: Redis is not configured');
  }

  await workflowQueue.add('scheduled_workflow_execution', data, {
    jobId: `scheduled-${data.ledgerRunId}`,
    priority: 1,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 1000,
    removeOnFail: 1000
  });
}

export async function addHeavyWorkflowJob(
  projectId: string,
  executionId: string,
  context: unknown,
  trigger: 'start' | 'message' | 'callback' = 'message'
): Promise<void> {
  if (!workflowQueue) {
    logger.warn('Workflow queue not available, skipping heavy workflow job', {
      projectId,
      executionId
    });
    return;
  }

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
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5
      }
    );
  } catch (error) {
    logger.error('Failed to add heavy workflow job to queue', {
      projectId,
      executionId,
      error: errorMessage(error)
    });
  }
}

export async function addUserVariablesUpdateJob(
  projectId: string,
  userId: string
): Promise<void> {
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
      'user_variables_update',
      {
        type: 'user_variables_update',
        projectId,
        userId,
        timestamp: Date.now()
      },
      {
        priority: 2,
        attempts: 2,
        removeOnComplete: 20,
        removeOnFail: 10
      }
    );
  } catch (error) {
    logger.error('Failed to add user variables update job to queue', {
      projectId,
      userId,
      error: errorMessage(error)
    });
  }
}

export async function addStatisticsAggregationJob(
  projectId: string
): Promise<void> {
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
      'statistics_aggregation',
      {
        type: 'statistics_aggregation',
        projectId,
        timestamp: Date.now()
      },
      {
        priority: 3,
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 20
      }
    );
  } catch (error) {
    logger.error('Failed to add statistics aggregation job to queue', {
      projectId,
      error: errorMessage(error)
    });
  }
}

if (workerConnection) {
  const worker = getWorkflowWorker();
  worker?.on('completed', (job) => {
    logger.debug('Workflow job completed', {
      jobId: job.id,
      type: job.data.type,
      projectId: job.data.projectId,
      processingTime: Date.now() - (job.data.timestamp || 0)
    });
  });
  worker?.on('failed', (job, error) => {
    logger.error('Workflow job failed', {
      jobId: job?.id,
      type: job?.data.type,
      projectId: job?.data.projectId,
      error: error.message,
      attempts: job?.attemptsMade
    });
  });
  worker?.on('stalled', (jobId: string) => {
    logger.warn('Workflow job stalled', { jobId });
  });
}

export default workflowQueue;
