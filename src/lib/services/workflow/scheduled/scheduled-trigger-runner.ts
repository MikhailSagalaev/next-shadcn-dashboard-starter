/**
 * @file: src/lib/services/workflow/scheduled/scheduled-trigger-runner.ts
 * @description: Claims and enqueues scheduled workflow runs, then executes queued runs.
 * @project: SaaS Bonus System
 * @created: 2026-05-27
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  addScheduledWorkflowExecutionJob,
  type ScheduledWorkflowExecutionJobData
} from '@/lib/queues/workflow.queue';
import { ExecutionContextManager } from '../execution-context-manager';
import { SimpleWorkflowProcessor } from '../../simple-workflow-processor';
import { initializeNodeHandlers } from '../handlers';
import { normalizeNodes } from '../utils/node-utils';
import { parseCron, cronMatches } from './cron-matcher';
import { AudienceResolver } from './audience-resolver';
import type {
  ScheduleTriggerConfig,
  WorkflowVersion,
  WorkflowNode,
  WorkflowConnection,
  WorkflowConnectionType
} from '@/types/workflow';

const DEFAULT_TIMEZONE = 'UTC';

function defaultDedupeWindow(
  audienceType: string
): NonNullable<ScheduleTriggerConfig['dedupeWindow']> {
  return audienceType === 'birthday_today' ? 'year' : 'day';
}

interface ScheduledRunStats {
  workflowsScanned: number;
  workflowsMatched: number;
  /** Preserved public field; now counts successfully enqueued per-user runs. */
  executionsStarted: number;
  dedupeSkipped: number;
  executionsFailed: number;
}

interface ScheduledWorkflowEntry {
  workflowId: string;
  projectId: string;
  versionId: string;
  versionNumber: number;
  triggerNodeId: string;
  triggerConfig: ScheduleTriggerConfig;
  nodes: Record<string, WorkflowNode>;
  connections: WorkflowConnection[];
}

interface ClaimedScheduledRun {
  id: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isConnectionType(value: unknown): value is WorkflowConnectionType {
  return (
    value === 'default' ||
    value === 'true' ||
    value === 'false' ||
    value === 'timeout'
  );
}

function normalizeConnections(value: unknown): WorkflowConnection[] {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(candidate)) return [];

  const connections: WorkflowConnection[] = [];
  candidate.forEach((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.source !== 'string' ||
      typeof item.target !== 'string'
    ) {
      return;
    }

    connections.push({
      id:
        typeof item.id === 'string'
          ? item.id
          : `${item.source}-${item.target}-${index}`,
      source: item.source,
      target: item.target,
      type: isConnectionType(item.type) ? item.type : 'default',
      ...(typeof item.sourceHandle === 'string'
        ? { sourceHandle: item.sourceHandle }
        : {}),
      ...(typeof item.targetHandle === 'string'
        ? { targetHandle: item.targetHandle }
        : {}),
      ...(typeof item.animated === 'boolean' ? { animated: item.animated } : {})
    });
  });

  return connections;
}

export class ScheduledTriggerRunner {
  static async runDueWorkflows(
    now: Date = new Date()
  ): Promise<ScheduledRunStats> {
    const stats: ScheduledRunStats = {
      workflowsScanned: 0,
      workflowsMatched: 0,
      executionsStarted: 0,
      dedupeSkipped: 0,
      executionsFailed: 0
    };

    const candidates = await this.findScheduledWorkflows();
    stats.workflowsScanned = candidates.length;

    for (const entry of candidates) {
      try {
        if (!this.cronMatchesNow(entry.triggerConfig, now)) continue;
        stats.workflowsMatched++;
        await this.enqueueForWorkflow(entry, now, stats);
      } catch (error) {
        stats.executionsFailed++;
        logger.error('Scheduled trigger workflow enqueue failed', {
          workflowId: entry.workflowId,
          projectId: entry.projectId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return stats;
  }

  /** Worker entry point: reconstructs the claimed version and executes one user run. */
  static async executeQueuedExecution(
    jobData: ScheduledWorkflowExecutionJobData
  ): Promise<void> {
    initializeNodeHandlers();

    const version = await db.workflowVersion.findUnique({
      where: { id: jobData.workflowVersionId },
      include: {
        workflow: {
          select: {
            id: true,
            projectId: true,
            connections: true
          }
        }
      }
    });

    if (
      !version ||
      version.workflowId !== jobData.workflowId ||
      version.workflow.id !== jobData.workflowId ||
      version.workflow.projectId !== jobData.projectId
    ) {
      throw new Error(
        `Scheduled workflow version ${jobData.workflowVersionId} is unavailable or does not match its claim`
      );
    }

    const context = await ExecutionContextManager.createScheduledContext({
      projectId: jobData.projectId,
      workflowId: jobData.workflowId,
      version: version.version,
      userId: jobData.userId,
      triggerNodeId: version.entryNodeId
    });

    const workflowVersion: WorkflowVersion = {
      id: version.id,
      workflowId: version.workflowId,
      version: version.version,
      nodes: normalizeNodes(version.nodes),
      entryNodeId: version.entryNodeId,
      connections: normalizeConnections(version.workflow.connections),
      isActive: version.isActive,
      createdAt: version.createdAt
    };

    const processor = new SimpleWorkflowProcessor(
      workflowVersion,
      jobData.projectId
    );
    await processor.resumeWorkflow(context, version.entryNodeId);
  }

  private static async findScheduledWorkflows(): Promise<
    ScheduledWorkflowEntry[]
  > {
    const versions = await db.workflowVersion.findMany({
      where: {
        isActive: true,
        workflow: { isActive: true }
      },
      include: {
        workflow: {
          select: {
            id: true,
            projectId: true,
            connections: true
          }
        }
      }
    });

    const entries: ScheduledWorkflowEntry[] = [];
    for (const version of versions) {
      const nodes = normalizeNodes(version.nodes);
      const entryNode = nodes[version.entryNodeId];
      if (!entryNode || entryNode.type !== 'trigger.schedule') continue;

      const config = entryNode.data?.config?.['trigger.schedule'];
      if (!config) {
        logger.warn('Workflow has trigger.schedule entry node without config', {
          workflowId: version.workflowId,
          versionId: version.id
        });
        continue;
      }

      entries.push({
        workflowId: version.workflowId,
        projectId: version.workflow.projectId,
        versionId: version.id,
        versionNumber: version.version,
        triggerNodeId: version.entryNodeId,
        triggerConfig: config,
        nodes,
        connections: normalizeConnections(version.workflow.connections)
      });
    }

    return entries;
  }

  private static cronMatchesNow(
    config: ScheduleTriggerConfig,
    now: Date
  ): boolean {
    try {
      return cronMatches(
        parseCron(config.cron),
        now,
        config.timezone || DEFAULT_TIMEZONE
      );
    } catch (error) {
      logger.error('Invalid cron expression in scheduled trigger', {
        cron: config.cron,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private static async enqueueForWorkflow(
    entry: ScheduledWorkflowEntry,
    now: Date,
    stats: ScheduledRunStats
  ): Promise<void> {
    const dedupeWindow =
      entry.triggerConfig.dedupeWindow ??
      defaultDedupeWindow(entry.triggerConfig.audience.type);
    const bucket = this.bucketLabel(dedupeWindow, now);
    let audienceSize = 0;

    for await (const page of AudienceResolver.resolvePages(
      entry.projectId,
      entry.triggerConfig.audience
    )) {
      audienceSize += page.userIds.length;

      for (const userId of page.userIds) {
        try {
          const claim = await this.claimRun(entry, userId, bucket, now);
          if (!claim) {
            stats.dedupeSkipped++;
            continue;
          }

          try {
            await addScheduledWorkflowExecutionJob({
              type: 'scheduled_workflow_execution',
              ledgerRunId: claim.id,
              projectId: entry.projectId,
              workflowId: entry.workflowId,
              workflowVersionId: entry.versionId,
              userId,
              timestamp: Date.now()
            });
            stats.executionsStarted++;
          } catch (error) {
            await this.markEnqueueFailed(claim.id, error);
            throw error;
          }
        } catch (error) {
          stats.executionsFailed++;
          logger.error('Scheduled trigger user enqueue failed', {
            workflowId: entry.workflowId,
            versionId: entry.versionId,
            userId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    if (audienceSize === 0) {
      logger.info('Scheduled trigger has empty audience', {
        workflowId: entry.workflowId,
        audienceType: entry.triggerConfig.audience.type
      });
      return;
    }

    logger.info('Scheduled trigger audience enqueued', {
      workflowId: entry.workflowId,
      projectId: entry.projectId,
      audienceType: entry.triggerConfig.audience.type,
      audienceSize,
      cron: entry.triggerConfig.cron
    });
  }

  /**
   * The unique database constraint is the atomic dedupe boundary. A FAILED row
   * with zero worker attempts represents enqueue failure and may be reclaimed.
   */
  private static async claimRun(
    entry: ScheduledWorkflowEntry,
    userId: string,
    bucket: string,
    now: Date
  ): Promise<ClaimedScheduledRun | null> {
    const identity = {
      workflowId: entry.workflowId,
      workflowVersionId: entry.versionId,
      userId,
      bucket
    };

    try {
      return await db.scheduledWorkflowRun.create({
        data: {
          ...identity,
          projectId: entry.projectId,
          status: 'QUEUED',
          queuedAt: now
        },
        select: { id: true }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const existing = await db.scheduledWorkflowRun.findFirst({
        where: identity,
        select: { id: true, status: true, attempts: true }
      });
      if (!existing) throw error;

      if (existing.status === 'FAILED' && existing.attempts === 0) {
        const reclaimed = await db.scheduledWorkflowRun.updateMany({
          where: {
            id: existing.id,
            status: 'FAILED',
            attempts: 0
          },
          data: {
            status: 'QUEUED',
            queuedAt: now,
            lastError: null
          }
        });
        if (reclaimed.count === 1) return { id: existing.id };
      }

      return null;
    }
  }

  private static async markEnqueueFailed(
    runId: string,
    error: unknown
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await db.scheduledWorkflowRun.updateMany({
      where: { id: runId, status: 'QUEUED', attempts: 0 },
      data: {
        status: 'FAILED',
        lastError: message.slice(0, 2000)
      }
    });
  }

  private static bucketLabel(
    window: NonNullable<ScheduleTriggerConfig['dedupeWindow']>,
    now: Date
  ): string {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    switch (window) {
      case 'year':
        return `${year}`;
      case 'month':
        return `${year}-${month}`;
      case 'week': {
        const target = new Date(
          Date.UTC(year, now.getUTCMonth(), now.getUTCDate())
        );
        const dayNumber = (target.getUTCDay() + 6) % 7;
        target.setUTCDate(target.getUTCDate() - dayNumber + 3);
        const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
        const week =
          1 +
          Math.round(
            ((target.getTime() - firstThursday.getTime()) / 86400000 -
              3 +
              ((firstThursday.getUTCDay() + 6) % 7)) /
              7
          );
        return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
      }
      case 'none': {
        const hour = String(now.getUTCHours()).padStart(2, '0');
        const minute = String(now.getUTCMinutes()).padStart(2, '0');
        return `none-${year}-${month}-${day}T${hour}-${minute}Z`;
      }
      case 'day':
        return `${year}-${month}-${day}`;
      default: {
        const exhaustive: never = window;
        return exhaustive;
      }
    }
  }
}
