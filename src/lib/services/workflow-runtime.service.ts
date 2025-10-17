/**
 * @file: src/lib/services/workflow-runtime.service.ts
 * @description: Runtime сервис для загрузки и выполнения активных workflow
 * @project: SaaS Bonus System
 * @dependencies: BotFlowService, FlowExecutor
 * @created: 2025-10-12
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { SimpleWorkflowProcessor } from './simple-workflow-processor';
import { initializeNodeHandlers } from './workflow/handlers';
import type { WorkflowVersion } from '@/types/workflow';

export class WorkflowRuntimeService {
  private static activeVersionsCache: Map<string, WorkflowVersion> = new Map();
  private static activeFlowsCache: Map<string, any> = new Map();
  private static compiledFlowsCache: Map<string, any> = new Map();

  /**
   * Очистить весь кэш (для отладки)
   */
  static clearAllCache(): void {
    this.activeVersionsCache.clear();
    this.activeFlowsCache.clear();
    this.compiledFlowsCache.clear();
    console.log('All workflow caches cleared');
  }

  /**
   * Проверить наличие активного workflow для проекта
   * Быстрая проверка без загрузки всего workflow
   */
  static async hasActiveWorkflow(projectId: string): Promise<boolean> {
    try {
      // Проверяем кэш
      if (this.activeVersionsCache.has(projectId)) {
        return true;
      }

      // Быстрая проверка в БД (только count, без загрузки данных)
      const count = await db.workflowVersion.count({
        where: {
          workflow: {
            projectId,
            isActive: true
          },
          isActive: true
        }
      });

      return count > 0;
    } catch (error) {
      logger.error('Error checking for active workflow', { projectId, error });
      return false;
    }
  }

  // Инициализируем handlers при первом использовании
  private static initialized = false;
  private static initializeHandlers() {
    if (!this.initialized) {
      initializeNodeHandlers();
      this.initialized = true;
      logger.info('Node handlers initialized');
    }
  }

  /**
   * Получить активную версию workflow для проекта
   */
  static async getActiveWorkflowVersion(projectId: string): Promise<WorkflowVersion | null> {
    try {
      // Инициализируем handlers
      this.initializeHandlers();

      // Проверяем кэш
      const cached = this.activeVersionsCache.get(projectId);
      if (cached) {
        logger.debug('Returning cached active workflow version', { projectId, workflowId: cached.workflowId, version: cached.version });
        return cached;
      }

      // Загружаем активную версию из БД
      logger.debug('Loading active workflow version from database', { projectId });

      const activeVersion = await db.workflowVersion.findFirst({
        where: {
          workflow: {
            projectId,
            isActive: true
          },
          isActive: true
        },
        include: {
          workflow: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!activeVersion) {
        logger.debug('No active workflow version found for project', { projectId });
        return null;
      }

      // Преобразуем ноды из массива в объект для совместимости с типами
      const nodesArray = (activeVersion.nodes as any) || [];
      const nodesObject: Record<string, any> = {};

      nodesArray.forEach((node: any) => {
        nodesObject[node.id] = node;
      });

      // Преобразуем в WorkflowVersion
      const workflowVersion: WorkflowVersion = {
        id: activeVersion.id,
        workflowId: activeVersion.workflowId,
        version: activeVersion.version,
        nodes: nodesObject,
        entryNodeId: activeVersion.entryNodeId,
        variables: activeVersion.variables as any,
        settings: activeVersion.settings as any,
        isActive: activeVersion.isActive,
        createdAt: activeVersion.createdAt,
        // Добавляем connections из workflow
        connections: activeVersion.workflow.connections as any
      };

      // Кэшируем
      this.activeVersionsCache.set(projectId, workflowVersion);

      logger.info('Active workflow version loaded', {
        projectId,
        workflowId: workflowVersion.workflowId,
        version: workflowVersion.version,
        nodesCount: Object.keys(workflowVersion.nodes || {}).length
      });

      return workflowVersion;
    } catch (error) {
      logger.error('Failed to get active workflow version', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Выполнить workflow для проекта
   */
  static async executeWorkflow(projectId: string, trigger: 'start' | 'message' | 'callback', context: any): Promise<boolean> {
    try {
      const workflowVersion = await this.getActiveWorkflowVersion(projectId);
      if (!workflowVersion) {
        logger.debug('No active workflow version found for execution', { projectId });
        return false;
      }

      const processor = new SimpleWorkflowProcessor(workflowVersion, projectId);
      const result = await processor.process(context, trigger);

      return result;
    } catch (error) {
      console.error('💥 CRITICAL WORKFLOW ERROR:', {
        projectId,
        trigger,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Инвалидировать кэш для проекта
   */
  static invalidateCache(projectId: string): void {
    logger.debug('Invalidating workflow cache', { projectId });

    // Инвалидируем все кэши для проекта
    this.activeFlowsCache.delete(projectId);
    this.activeVersionsCache.delete(projectId);

    // Также инвалидируем compiledFlowsCache для всех flow в проекте
    for (const [flowId, flow] of Array.from(this.activeFlowsCache.entries())) {
      if (flow.projectId === projectId) {
        this.compiledFlowsCache.delete(flowId);
      }
    }
  }

  /**
   * Очистить весь кэш
   */
  static clearCache(): void {
    logger.debug('Clearing all workflow cache');
    this.compiledFlowsCache.clear();
    this.activeFlowsCache.clear();
  }

}

