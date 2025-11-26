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
import { MenuCommandHandler } from './workflow/handlers/action-handlers';
import { nodeHandlersRegistry } from './workflow/node-handlers-registry';
import { ExecutionContextManager } from './workflow/execution-context-manager';
import { CacheService } from '@/lib/redis';
import type {
  WorkflowVersion,
  WorkflowNode,
  WorkflowConnection
} from '@/types/workflow';

const ACTIVE_VERSION_CACHE_TTL_SECONDS = 60 * 60; // 1 час
const ACTIVE_VERSION_MEMORY_TTL_MS = ACTIVE_VERSION_CACHE_TTL_SECONDS * 1000;
const PROCESSOR_CACHE_TTL_MS = 15 * 60 * 1000; // 15 минут

interface CachedWorkflowVersionEntry {
  version: WorkflowVersion;
  expiresAt: number;
}

interface SerializedWorkflowVersion extends Omit<WorkflowVersion, 'createdAt'> {
  createdAt: string;
}

interface CachedWorkflowProcessorEntry {
  processor: SimpleWorkflowProcessor;
  projectId: string;
  workflowId: string;
  version: number;
  createdAt: number;
  expiresAt: number;
}

export class WorkflowRuntimeService {
  private static activeVersionsCache: Map<string, CachedWorkflowVersionEntry> =
    new Map();
  private static activeFlowsCache: Map<string, CachedWorkflowProcessorEntry> =
    new Map();
  private static compiledFlowsCache: Map<string, any> = new Map();

  // Кеш для waiting executions (TTL: 5 минут)
  private static WAITING_EXECUTION_TTL_SECONDS = 5 * 60;

  private static getActiveVersionCacheKey(projectId: string): string {
    return `project:${projectId}:workflow:active-version`;
  }

  private static serializeWorkflowVersion(
    version: WorkflowVersion
  ): SerializedWorkflowVersion {
    return {
      ...version,
      createdAt:
        version.createdAt instanceof Date
          ? version.createdAt.toISOString()
          : version.createdAt
    };
  }

  private static deserializeWorkflowVersion(
    serialized: SerializedWorkflowVersion
  ): WorkflowVersion {
    return {
      ...serialized,
      createdAt: new Date(serialized.createdAt)
    };
  }

  private static getProcessorCacheKey(projectId: string): string {
    return projectId;
  }

  private static setMemoryCache(
    projectId: string,
    version: WorkflowVersion
  ): void {
    this.activeVersionsCache.set(projectId, {
      version,
      expiresAt: Date.now() + ACTIVE_VERSION_MEMORY_TTL_MS
    });
  }

  private static async cacheActiveVersion(
    projectId: string,
    version: WorkflowVersion
  ): Promise<void> {
    this.setMemoryCache(projectId, version);
    await CacheService.set(
      this.getActiveVersionCacheKey(projectId),
      this.serializeWorkflowVersion(version),
      ACTIVE_VERSION_CACHE_TTL_SECONDS
    );
  }

  private static getCachedVersion(projectId: string): WorkflowVersion | null {
    const cachedEntry = this.activeVersionsCache.get(projectId);
    if (!cachedEntry) {
      return null;
    }

    if (cachedEntry.expiresAt < Date.now()) {
      this.activeVersionsCache.delete(projectId);
      return null;
    }

    return cachedEntry.version;
  }

  private static getCachedProcessor(
    projectId: string,
    workflowVersion: WorkflowVersion
  ): SimpleWorkflowProcessor | null {
    const key = this.getProcessorCacheKey(projectId);
    const cachedEntry = this.activeFlowsCache.get(key);

    if (!cachedEntry) {
      return null;
    }

    const isSameWorkflow =
      cachedEntry.workflowId === workflowVersion.workflowId &&
      cachedEntry.version === workflowVersion.version;
    const isExpired = cachedEntry.expiresAt < Date.now();

    if (!isSameWorkflow || isExpired) {
      this.activeFlowsCache.delete(key);
      this.compiledFlowsCache.delete(key);
      return null;
    }

    return cachedEntry.processor;
  }

  private static storeProcessor(
    projectId: string,
    workflowVersion: WorkflowVersion,
    processor: SimpleWorkflowProcessor
  ): void {
    const key = this.getProcessorCacheKey(projectId);
    this.activeFlowsCache.set(key, {
      processor,
      projectId,
      workflowId: workflowVersion.workflowId,
      version: workflowVersion.version,
      createdAt: Date.now(),
      expiresAt: Date.now() + PROCESSOR_CACHE_TTL_MS
    });
  }

  private static getWorkflowProcessor(
    projectId: string,
    workflowVersion: WorkflowVersion
  ): SimpleWorkflowProcessor {
    const cached = this.getCachedProcessor(projectId, workflowVersion);
    if (cached) {
      return cached;
    }

    const processor = new SimpleWorkflowProcessor(workflowVersion, projectId);
    this.storeProcessor(projectId, workflowVersion, processor);
    return processor;
  }

  /**
   * Очистить весь кэш (для отладки)
   */
  static async invalidateCache(projectId: string): Promise<void> {
    logger.debug('Invalidating workflow cache', { projectId });
    this.activeVersionsCache.delete(projectId);
    this.activeFlowsCache.delete(projectId);
    this.compiledFlowsCache.delete(projectId);
    await CacheService.delete(this.getActiveVersionCacheKey(projectId));
    await CacheService.delete(this.getProcessorCacheKey(projectId));
  }

  static async clearAllCache(): Promise<void> {
    this.activeVersionsCache.clear();
    this.activeFlowsCache.clear();
    this.compiledFlowsCache.clear();
    await CacheService.deletePattern('project:*:workflow:*');
    console.log('All workflow caches cleared');
  }

  /**
   * Проверить наличие активного workflow для проекта
   * Быстрая проверка без загрузки всего workflow
   */
  static async hasActiveWorkflow(projectId: string): Promise<boolean> {
    try {
      const cachedVersion = this.getCachedVersion(projectId);
      if (cachedVersion) {
        return true;
      }

      const cachedInRedis = await CacheService.get<SerializedWorkflowVersion>(
        this.getActiveVersionCacheKey(projectId)
      );

      if (cachedInRedis) {
        const hydrated = this.deserializeWorkflowVersion(cachedInRedis);
        this.setMemoryCache(projectId, hydrated);
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

      // Принудительная регистрация MenuCommandHandler
      const hasMenuCommand = nodeHandlersRegistry.has('action.menu_command');
      logger.info('MenuCommandHandler check:', { hasMenuCommand });

      if (!hasMenuCommand) {
        logger.error('MenuCommandHandler not registered! Force registering...');
        nodeHandlersRegistry.register(new MenuCommandHandler());
        logger.info('MenuCommandHandler force registered');
      } else {
        logger.info('MenuCommandHandler already registered');
      }
    }
  }

  /**
   * Получить активную версию workflow для проекта
   */
  static async getActiveWorkflowVersion(
    projectId: string
  ): Promise<WorkflowVersion | null> {
    try {
      // Инициализируем handlers
      this.initializeHandlers();

      // Проверяем кэш в памяти
      const memoryCached = this.getCachedVersion(projectId);
      if (memoryCached) {
        const memoryConnections = memoryCached.connections || [];
        console.log('📦 Возвращаем workflow из кэша в памяти', {
          projectId,
          workflowId: memoryCached.workflowId,
          version: memoryCached.version,
          versionId: memoryCached.id,
          connectionsCount: memoryConnections.length,
          menuInviteConnections: memoryConnections
            .filter((c: any) => c.source === 'menu-invite-trigger')
            .map((c: any) => ({
              source: c.source,
              target: c.target
            }))
        });
        return memoryCached;
      }

      // Пробуем загрузить из Redis
      const redisCached = await CacheService.get<SerializedWorkflowVersion>(
        this.getActiveVersionCacheKey(projectId)
      );

      if (redisCached) {
        const hydrated = this.deserializeWorkflowVersion(redisCached);
        this.setMemoryCache(projectId, hydrated);
        const redisConnections = hydrated.connections || [];
        console.log('📦 Возвращаем workflow из Redis кэша', {
          projectId,
          workflowId: hydrated.workflowId,
          version: hydrated.version,
          versionId: hydrated.id,
          connectionsCount: redisConnections.length,
          menuInviteConnections: redisConnections
            .filter((c: any) => c.source === 'menu-invite-trigger')
            .map((c: any) => ({
              source: c.source,
              target: c.target
            }))
        });
        return hydrated;
      }

      // Загружаем активную версию из БД
      logger.info('💾 Загружаем активную версию workflow из БД', { projectId });

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
        logger.debug('No active workflow version found for project', {
          projectId
        });
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

      const connectionsList = workflowVersion.connections || [];
      console.log('✅ Загружена активная версия workflow из БД', {
        projectId,
        workflowId: workflowVersion.workflowId,
        version: workflowVersion.version,
        versionId: workflowVersion.id,
        nodesCount: Object.keys(workflowVersion.nodes || {}).length,
        connectionsCount: connectionsList.length,
        menuInviteConnections: connectionsList
          .filter((c: any) => c.source === 'menu-invite-trigger')
          .map((c: any) => ({
            source: c.source,
            target: c.target
          }))
      });

      // Кэшируем в памяти и Redis
      await this.cacheActiveVersion(projectId, workflowVersion);

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
  static async executeWorkflow(
    projectId: string,
    trigger: 'start' | 'message' | 'callback',
    context: any
  ): Promise<boolean> {
    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    try {
      console.log('🔧 executeWorkflow STARTED', {
        projectId,
        trigger,
        hasCallback: !!context.callbackQuery,
        callbackData: context.callbackQuery?.data
      });
      // ✅ КРИТИЧНО: Инициализируем handlers в начале
      this.initializeHandlers();
      console.log('🔧 Handlers initialized successfully');

      // 1) Сначала пробуем возобновить ожидающий execution
      const chatId: string | undefined =
        context.chat?.id?.toString() ??
        context.message?.chat?.id?.toString() ??
        context.callbackQuery?.message?.chat?.id?.toString();
      const telegramUserId: string | undefined =
        context.from?.id?.toString() ??
        context.callbackQuery?.from?.id?.toString();

      let waitType: 'contact' | 'callback' | 'input' | null = null;
      if (context.message?.contact) waitType = 'contact';
      else if (context.callbackQuery) waitType = 'callback';
      else if (context.message?.text) waitType = 'input';

      console.log('🔧 Checking for waiting execution', {
        chatId,
        waitType,
        trigger
      });

      // ✅ КРИТИЧНО: Для /start также проверяем waiting execution, чтобы не создавать новый, если есть ожидающий
      // Для /start команды waitType будет null, но мы всё равно проверяем наличие waiting execution
      const shouldCheckWaiting = chatId && (waitType || trigger === 'start');

      if (shouldCheckWaiting) {
        logger.info('🔍 Поиск waiting execution', {
          projectId,
          chatId,
          waitType,
          trigger
        });

        // ✅ ОПТИМИЗИРОВАНО: Сначала проверяем Redis кеш, потом БД
        let waitingExecution = null;

        // 1. Сначала проверяем Redis кеш
        const cachedExecution = await this.getCachedWaitingExecution(
          projectId,
          chatId,
          waitType === 'input' ? 'contact' : waitType // Для input используем contact
        );

        if (cachedExecution) {
          cacheHits++;
          logger.info('✅ Waiting execution найден в Redis кеше', {
            executionId: cachedExecution.executionId,
            cacheHit: true
          });

          // Проверяем что execution все еще существует и в правильном состоянии
          waitingExecution = await db.workflowExecution.findUnique({
            where: { id: cachedExecution.executionId },
            select: {
              id: true,
              status: true,
              waitType: true,
              currentNodeId: true,
              projectId: true,
              telegramChatId: true,
              workflowId: true,
              version: true
            }
          });

          if (!waitingExecution || waitingExecution.status !== 'waiting') {
            logger.warn(
              '⚠️ Cached execution больше не в waiting состоянии, инвалидируем кеш',
              {
                executionId: cachedExecution.executionId,
                currentStatus: waitingExecution?.status
              }
            );
            // Инвалидируем неактуальный кеш
            await this.invalidateWaitingExecutionCache(
              projectId,
              chatId,
              waitType === 'input' ? 'contact' : waitType
            );
            waitingExecution = null;
          }
        }

        // 2. Если не найдено в кеше — ищем в БД
        if (!waitingExecution) {
          cacheMisses++;
          logger.info('🔍 Поиск waiting execution в БД (кеш промах)', {
            projectId,
            chatId,
            waitType
          });

          waitingExecution = await db.workflowExecution.findFirst({
            where: {
              projectId,
              status: 'waiting',
              telegramChatId: chatId,
              // ✅ КРИТИЧНО: Для /start команды ищем любой waiting execution (contact, input, callback)
              // Для других триггеров ищем по конкретному waitType
              waitType:
                waitType === 'input'
                  ? ({ in: ['input', 'contact'] } as any)
                  : waitType ||
                    (trigger === 'start'
                      ? ({ in: ['contact', 'input', 'callback'] } as any)
                      : null)
            },
            orderBy: {
              startedAt: 'desc' // Берем самый последний waiting execution
            }
          });

          if (waitingExecution) {
            logger.info('✅ Waiting execution найден в БД', {
              executionId: waitingExecution.id,
              currentNodeId: waitingExecution.currentNodeId,
              cacheMiss: true
            });
          } else {
            logger.info('❌ Waiting execution не найден', {
              projectId,
              chatId,
              waitType,
              cacheMiss: true
            });
          }
        }

        console.log('🔧 Waiting execution search result', {
          found: !!waitingExecution,
          executionId: waitingExecution?.id,
          waitType: waitingExecution?.waitType,
          cacheUsed: true,
          trigger
        });

        logger.info('📊 Результат поиска waiting execution', {
          found: !!waitingExecution,
          executionId: waitingExecution?.id,
          currentNodeId: waitingExecution?.currentNodeId,
          waitType: waitingExecution?.waitType,
          searchMethod: cachedExecution ? 'cache' : 'database'
        });

        console.log('🔧 About to check if waitingExecution exists:', {
          waitingExecution: !!waitingExecution,
          waitingExecutionId: waitingExecution?.id,
          waitingExecutionType: typeof waitingExecution
        });

        if (waitingExecution) {
          // ✅ КРИТИЧНО: Если это /start команда, а не ожидание контакта/email, отменяем waiting execution
          // и создаём новый, так как пользователь хочет начать заново
          if (
            trigger === 'start' &&
            waitingExecution.waitType &&
            !context.message?.contact &&
            !context.message?.text?.includes('@')
          ) {
            console.log(
              '🔄 /start received while waiting for contact/email - canceling waiting execution and starting fresh',
              {
                executionId: waitingExecution.id,
                waitType: waitingExecution.waitType
              }
            );

            // Отменяем waiting execution
            await db.workflowExecution.update({
              where: { id: waitingExecution.id },
              data: {
                status: 'finished',
                finishedAt: new Date()
              }
            });

            // Инвалидируем кеш
            await this.invalidateWaitingExecutionCache(
              projectId,
              chatId!,
              waitingExecution.waitType as 'contact' | 'input' | 'callback'
            );

            // Продолжаем с созданием нового execution
            waitingExecution = null;
          }
        }

        if (waitingExecution) {
          console.log('✅ ENTERING WAITING EXECUTION BLOCK', {
            executionId: waitingExecution.id
          });
          console.log('🔧 About to resume workflow', {
            waitingExecutionId: waitingExecution.id,
            waitingExecutionStatus: waitingExecution.status,
            waitingExecutionWaitType: waitingExecution.waitType,
            trigger
          });

          try {
            // ✅ КРИТИЧНО: Используем активную версию workflow вместо версии из execution
            // Это гарантирует, что при возобновлении используется актуальная версия с правильными узлами
            logger.info(
              '🔧 Загружаем активную версию workflow для возобновления',
              {
                projectId,
                waitingExecutionId: waitingExecution.id,
                workflowId: waitingExecution.workflowId,
                executionVersion: waitingExecution.version,
                hasWorkflowId: !!waitingExecution.workflowId,
                hasVersion: !!waitingExecution.version
              }
            );

            // Сначала пробуем загрузить активную версию
            const activeVersion =
              await this.getActiveWorkflowVersion(projectId);

            logger.info('🔧 Результат getActiveWorkflowVersion', {
              found: !!activeVersion,
              activeVersionWorkflowId: activeVersion?.workflowId,
              activeVersionVersion: activeVersion?.version,
              waitingExecutionWorkflowId: waitingExecution.workflowId,
              waitingExecutionVersion: waitingExecution.version
            });

            let versionRecord;

            // ✅ КРИТИЧНО: Если workflowId или version undefined, всегда используем активную версию
            if (!waitingExecution.workflowId || !waitingExecution.version) {
              logger.warn(
                '⚠️ waitingExecution не содержит workflowId или version, используем активную версию',
                {
                  waitingExecutionId: waitingExecution.id,
                  hasWorkflowId: !!waitingExecution.workflowId,
                  hasVersion: !!waitingExecution.version,
                  activeVersionFound: !!activeVersion
                }
              );

              if (activeVersion) {
                // Загружаем полную запись из БД для получения connections
                versionRecord = await db.workflowVersion.findFirst({
                  where: {
                    id: activeVersion.id
                  },
                  include: { workflow: true }
                });
                logger.info(
                  '✅ Используем активную версию (workflowId/version отсутствуют)',
                  {
                    versionId: activeVersion.id,
                    version: activeVersion.version,
                    isActive: activeVersion.isActive
                  }
                );
              } else {
                logger.error(
                  '❌ Активная версия не найдена, и waitingExecution не содержит workflowId/version',
                  {
                    projectId,
                    waitingExecutionId: waitingExecution.id
                  }
                );
              }
            } else if (
              activeVersion &&
              activeVersion.workflowId === waitingExecution.workflowId
            ) {
              // Используем активную версию, если она для того же workflow
              logger.info(
                '✅ Используем активную версию workflow для возобновления',
                {
                  versionId: activeVersion.id,
                  version: activeVersion.version,
                  isActive: activeVersion.isActive
                }
              );

              // Загружаем полную запись из БД для получения connections
              versionRecord = await db.workflowVersion.findFirst({
                where: {
                  id: activeVersion.id
                },
                include: { workflow: true }
              });
            } else {
              // Fallback: используем версию из execution, если активная версия не найдена или для другого workflow
              logger.warn(
                '⚠️ Активная версия не найдена или для другого workflow, используем версию из execution',
                {
                  workflowId: waitingExecution.workflowId,
                  executionVersion: waitingExecution.version,
                  activeVersionWorkflowId: activeVersion?.workflowId
                }
              );

              versionRecord = await db.workflowVersion.findFirst({
                where: {
                  workflowId: waitingExecution.workflowId,
                  version: waitingExecution.version
                },
                include: { workflow: true }
              });
            }

            console.log('🔧 Version record loaded:', {
              found: !!versionRecord,
              versionId: versionRecord?.id,
              isActive: versionRecord?.isActive,
              workflowId: versionRecord?.workflowId,
              version: versionRecord?.version
            });

            if (!versionRecord) {
              console.error(
                '❌ Workflow version not found for waiting execution',
                {
                  workflowId: waitingExecution.workflowId,
                  version: waitingExecution.version
                }
              );
              return false;
            }

            console.log(
              '🔧 versionRecord.nodes type:',
              typeof versionRecord.nodes
            );
            console.log(
              '🔧 versionRecord.nodes isArray:',
              Array.isArray(versionRecord.nodes)
            );
            console.log(
              '🔧 versionRecord.nodes length/keys:',
              Array.isArray(versionRecord.nodes)
                ? versionRecord.nodes.length
                : Object.keys(versionRecord.nodes || {}).length
            );

            // Convert nodes array to object if needed
            let nodesObject: Record<string, any>;
            if (Array.isArray(versionRecord.nodes)) {
              nodesObject = {};
              (versionRecord.nodes as any[]).forEach((node: any) => {
                nodesObject[node.id] = node;
              });
              console.log(
                '🔧 Converted array to object, node count:',
                Object.keys(nodesObject).length
              );
            } else {
              nodesObject = (versionRecord.nodes as Record<string, any>) || {};
              console.log(
                '🔧 Nodes already object, node count:',
                Object.keys(nodesObject).length
              );
            }

            const connections = ((versionRecord.workflow as any)?.connections ||
              []) as WorkflowConnection[];

            logger.info('🔧 Loading workflow version for resume', {
              versionId: versionRecord.id,
              workflowId: versionRecord.workflowId,
              version: versionRecord.version,
              nodesCount: Object.keys(nodesObject).length,
              connectionsCount: connections.length,
              connections: connections.map((c: any) => ({
                id: c.id,
                source: c.source,
                target: c.target,
                type: c.type
              })),
              menuInviteConnections: connections.filter(
                (c: any) => c.source === 'menu-invite-trigger'
              )
            });

            const versionToUse: WorkflowVersion = {
              id: versionRecord.id,
              workflowId: versionRecord.workflowId,
              version: versionRecord.version,
              nodes: nodesObject as unknown as Record<string, WorkflowNode>,
              entryNodeId: versionRecord.entryNodeId,
              variables: versionRecord.variables as any,
              settings: versionRecord.settings as any,
              isActive: versionRecord.isActive,
              createdAt: versionRecord.createdAt,
              connections: connections
            };

            // Create processor
            const processor = this.getWorkflowProcessor(
              projectId,
              versionToUse
            );

            // ✅ КРИТИЧНО: Извлекаем контакт или email из входящего сообщения
            let contactPhone: string | undefined;
            let contactEmail: string | undefined;
            let messageText: string | undefined;

            if (trigger === 'message' && context.message) {
              // Проверяем, есть ли контакт в сообщении
              if (context.message.contact) {
                contactPhone = context.message.contact.phone_number;
                logger.info('📞 Contact received from user', {
                  phoneNumber: contactPhone,
                  executionId: waitingExecution.id
                });
              } else if (context.message.text) {
                // Если текст похож на email, используем его как email
                const text = context.message.text.trim();
                if (text.includes('@') && text.includes('.')) {
                  contactEmail = text;
                  logger.info('📧 Email received from user', {
                    email: contactEmail,
                    executionId: waitingExecution.id
                  });
                }
                messageText = text;
              }
            }

            // Resume execution context
            const resumedContext = await ExecutionContextManager.resumeContext(
              waitingExecution.id,
              chatId,
              context.from?.id,
              context.from?.username,
              messageText,
              trigger === 'callback' ? context.callbackQuery?.data : undefined
            );

            // ✅ КРИТИЧНО: Сохраняем контакт/email в переменные для использования в workflow
            // ВАЖНО: Сохраняем объект contactReceived, а не отдельные переменные с точкой в ключе
            if (contactPhone) {
              const contactReceivedData = {
                phoneNumber: contactPhone,
                type: 'phone',
                receivedAt: new Date().toISOString()
              };
              await resumedContext.variables.set(
                'contactReceived',
                contactReceivedData,
                'session'
              );
              logger.info('💾 Contact phone saved to variables', {
                phoneNumber: contactPhone,
                executionId: waitingExecution.id,
                contactReceivedData
              });
            } else if (contactEmail) {
              const contactReceivedData = {
                email: contactEmail,
                type: 'email',
                receivedAt: new Date().toISOString()
              };
              await resumedContext.variables.set(
                'contactReceived',
                contactReceivedData,
                'session'
              );
              logger.info('💾 Contact email saved to variables', {
                email: contactEmail,
                executionId: waitingExecution.id,
                contactReceivedData
              });
            }

            // For callback triggers, find the appropriate callback trigger node
            // instead of resuming from currentNodeId
            const callbackData = context.callbackQuery?.data;
            if (callbackData) {
              console.log('🔧 Processing callback trigger', { callbackData });
              console.log(
                '🔧 Available nodes in versionToUse:',
                Object.keys(versionToUse.nodes)
              );
              console.log(
                '🔧 Node types in versionToUse:',
                Object.values(versionToUse.nodes).map((n: any) => ({
                  id: n.id,
                  type: n.type
                }))
              );

              // Find the callback trigger node
              const callbackTriggerNode = Object.values(
                versionToUse.nodes
              ).find((node: WorkflowNode) => {
                console.log('🔧 Checking node:', {
                  id: node.id,
                  type: node.type,
                  config: node.data?.config
                });
                return (
                  node.type === 'trigger.callback' &&
                  node.data?.config?.['trigger.callback']?.callbackData ===
                    callbackData
                );
              });

              if (callbackTriggerNode) {
                console.log('🔧 Found callback trigger node', {
                  nodeId: callbackTriggerNode.id
                });

                // ✅ Проверяем connections для этого триггера
                const connections = versionToUse.connections || [];
                const triggerConnections = connections.filter(
                  (conn: any) => conn.source === callbackTriggerNode.id
                );
                logger.info('🔧 Connections for callback trigger', {
                  triggerNodeId: callbackTriggerNode.id,
                  connectionsCount: triggerConnections.length,
                  connections: triggerConnections.map((c: any) => ({
                    source: c.source,
                    target: c.target
                  }))
                });

                // Выполняем workflow начиная с callback trigger
                // executeWorkflow автоматически продолжит к следующему узлу по connections
                logger.info(
                  '🔧 About to execute workflow from callback trigger',
                  {
                    triggerNodeId: callbackTriggerNode.id,
                    executionId: resumedContext.executionId,
                    connectionsCount: triggerConnections.length,
                    connections: triggerConnections
                  }
                );
                await (processor as any).executeWorkflow(
                  resumedContext,
                  callbackTriggerNode.id
                );
                logger.info('🔧 Callback trigger processed successfully', {
                  triggerNodeId: callbackTriggerNode.id,
                  executionId: resumedContext.executionId
                });
                return true;
              } else {
                console.error(
                  '❌ No callback trigger node found for',
                  callbackData
                );
                return false;
              }
            } else {
              // ✅ КРИТИЧНО: Для waiting execution с waitType 'contact' или 'input'
              // НЕ выполняем currentNodeId снова (это была нода, которая установила waiting)
              // Вместо этого переходим к следующей ноде по connections
              if (
                waitingExecution.waitType === 'contact' ||
                waitingExecution.waitType === 'input'
              ) {
                const currentNodeId = waitingExecution.currentNodeId;
                if (currentNodeId) {
                  console.log(
                    '🔧 Determining next node for contact/input resume',
                    {
                      currentNodeId,
                      waitType: waitingExecution.waitType,
                      contactReceived: contactPhone || contactEmail
                    }
                  );

                  // Получаем следующую ноду по connections
                  const nextNodeId = await (processor as any).getNextNodeId(
                    currentNodeId
                  );

                  console.log('🔧 Next node determined from connections', {
                    currentNodeId,
                    nextNodeId,
                    nextNodeType: nextNodeId
                      ? versionToUse.nodes[nextNodeId]?.type
                      : null,
                    nextNodeLabel: nextNodeId
                      ? versionToUse.nodes[nextNodeId]?.data?.label
                      : null
                  });

                  if (nextNodeId) {
                    console.log(
                      '🔧 Resuming workflow from next node after contact/input',
                      {
                        currentNodeId,
                        nextNodeId,
                        waitType: waitingExecution.waitType
                      }
                    );

                    // Сбрасываем waiting состояние перед возобновлением
                    await db.workflowExecution.update({
                      where: { id: waitingExecution.id },
                      data: {
                        status: 'running',
                        waitType: null,
                        waitPayload: null,
                        currentNodeId: nextNodeId
                      }
                    });

                    await processor.resumeWorkflow(resumedContext, nextNodeId);
                    console.log(
                      '🔧 Workflow resumed successfully after contact/input'
                    );
                    return true;
                  } else {
                    console.error(
                      '❌ No next node found for waiting execution',
                      {
                        currentNodeId,
                        waitType: waitingExecution.waitType,
                        availableNodes: Object.keys(versionToUse.nodes)
                      }
                    );
                    return false;
                  }
                } else {
                  console.error('❌ No current node ID in waiting execution');
                  return false;
                }
              } else {
                // For other waiting types, resume from current node
                const nextNodeId = waitingExecution.currentNodeId;
                if (nextNodeId) {
                  console.log('🔧 Resuming workflow from node', { nextNodeId });
                  await processor.resumeWorkflow(resumedContext, nextNodeId);
                  console.log('🔧 Workflow resumed successfully');
                  return true;
                } else {
                  console.error('❌ No current node ID in waiting execution');
                  return false;
                }
              }
            }
          } catch (resumeError) {
            console.error('❌ Failed to resume workflow', {
              error: resumeError.message,
              stack: resumeError.stack,
              waitingExecutionId: waitingExecution.id
            });
            return false;
          }
        }
        // 2) Если waiting execution не найден — создаём новый workflow execution
        console.log('🔧 Proceeding to create new workflow execution', {
          trigger,
          chatId
        });

        console.log('🔧 About to get active workflow version', { projectId });
        const workflowVersion = await this.getActiveWorkflowVersion(projectId);
        console.log('🔧 getActiveWorkflowVersion returned', {
          hasVersion: !!workflowVersion,
          versionId: workflowVersion?.id
        });
        if (!workflowVersion) {
          console.log(
            '❌ CRITICAL: No active workflow version found - this causes "workflow not configured" error'
          );
          logger.debug('No active workflow version found for execution', {
            projectId
          });
          return false;
        }

        const processor = this.getWorkflowProcessor(projectId, workflowVersion);
        console.log('🔧 About to call processor.process', {
          projectId,
          trigger
        });
        const result = await processor.process(context, trigger);
        console.log('🔧 processor.process returned', {
          result,
          resultType: typeof result
        });

        const processingTime = Date.now() - startTime;
        console.log('🔧 executeWorkflow FINISHED', {
          projectId,
          trigger,
          result,
          processingTimeMs: processingTime,
          cacheHits,
          cacheMisses,
          cacheHitRate:
            cacheHits + cacheMisses > 0
              ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) + '%'
              : 'N/A'
        });
        return result;
      }

      // Для /start команд (без chatId/waitType) сразу создаём новый workflow
      console.log('🔧 Creating new workflow execution for start command', {
        trigger,
        chatId
      });
      const startWorkflowVersion =
        await this.getActiveWorkflowVersion(projectId);
      if (!startWorkflowVersion) {
        console.log(
          '❌ CRITICAL: No active workflow version found - this causes "workflow not configured" error'
        );
        logger.debug('No active workflow version found for execution', {
          projectId
        });
        return false;
      }

      const startProcessor = this.getWorkflowProcessor(
        projectId,
        startWorkflowVersion
      );
      console.log('🔧 About to call processor.process for start', {
        projectId,
        trigger
      });
      const startResult = await startProcessor.process(context, trigger);
      console.log('🔧 processor.process returned for start', {
        result: startResult,
        resultType: typeof startResult
      });

      const processingTime = Date.now() - startTime;
      console.log('🔧 executeWorkflow FINISHED', {
        projectId,
        trigger,
        result: startResult,
        processingTimeMs: processingTime,
        cacheHits,
        cacheMisses,
        cacheHitRate:
          cacheHits + cacheMisses > 0
            ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) + '%'
            : 'N/A'
      });

      return startResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('💥 CRITICAL WORKFLOW ERROR:', {
        projectId,
        trigger,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: processingTime,
        cacheHits,
        cacheMisses
      });
      console.log('🔧 executeWorkflow FINISHED WITH ERROR', {
        projectId,
        trigger,
        result: false
      });
      return false;
    }
  }

  // ==========================================
  // КЕШИРОВАНИЕ WAITING EXECUTIONS
  // ==========================================

  /**
   * Ключ кеша для waiting execution
   */
  private static getWaitingExecutionCacheKey(
    projectId: string,
    chatId: string,
    waitType: string
  ): string {
    return `workflow:execution:waiting:${projectId}:${chatId}:${waitType}`;
  }

  /**
   * Кешировать waiting execution в Redis
   */
  static async cacheWaitingExecution(
    executionId: string,
    projectId: string,
    chatId: string,
    waitType: string
  ): Promise<void> {
    try {
      const cacheKey = this.getWaitingExecutionCacheKey(
        projectId,
        chatId,
        waitType
      );
      const cacheData = {
        executionId,
        projectId,
        chatId,
        waitType,
        cachedAt: new Date().toISOString()
      };

      await CacheService.set(
        cacheKey,
        cacheData,
        this.WAITING_EXECUTION_TTL_SECONDS
      );

      logger.debug('✅ Cached waiting execution', {
        executionId,
        projectId,
        chatId,
        waitType,
        cacheKey,
        ttl: this.WAITING_EXECUTION_TTL_SECONDS
      });
    } catch (error) {
      logger.error('❌ Failed to cache waiting execution', {
        executionId,
        projectId,
        chatId,
        waitType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Не бросаем ошибку - кеширование опционально
    }
  }

  /**
   * Получить cached waiting execution из Redis
   */
  static async getCachedWaitingExecution(
    projectId: string,
    chatId: string,
    waitType: string
  ): Promise<{
    executionId: string;
    projectId: string;
    chatId: string;
    waitType: string;
  } | null> {
    try {
      const cacheKey = this.getWaitingExecutionCacheKey(
        projectId,
        chatId,
        waitType
      );
      const cachedData = await CacheService.get(cacheKey);

      if (!cachedData) {
        return null;
      }

      logger.debug('✅ Found cached waiting execution', {
        cacheKey,
        executionId: (
          cachedData as {
            executionId: string;
            projectId: string;
            chatId: string;
            waitType: string;
          }
        ).executionId,
        projectId,
        chatId,
        waitType
      });

      return cachedData as {
        executionId: string;
        projectId: string;
        chatId: string;
        waitType: string;
      };
    } catch (error) {
      logger.error('❌ Failed to get cached waiting execution', {
        projectId,
        chatId,
        waitType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Удалить cached waiting execution из Redis
   */
  static async invalidateWaitingExecutionCache(
    projectId: string,
    chatId: string,
    waitType: string
  ): Promise<void> {
    try {
      const cacheKey = this.getWaitingExecutionCacheKey(
        projectId,
        chatId,
        waitType
      );
      await CacheService.delete(cacheKey);

      logger.debug('🗑️ Invalidated waiting execution cache', {
        projectId,
        chatId,
        waitType,
        cacheKey
      });
    } catch (error) {
      logger.error('❌ Failed to invalidate waiting execution cache', {
        projectId,
        chatId,
        waitType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==========================================
  // КЕШИРОВАНИЕ USER VARIABLES
  // ==========================================

  /**
   * Ключ кеша для user variables
   */
  private static getUserVariablesCacheKey(
    projectId: string,
    userId: string
  ): string {
    return `workflow:user-variables:${projectId}:${userId}`;
  }

  /**
   * Ключ кеша для get_user_profile
   */
  private static getUserProfileCacheKey(userId: string): string {
    return `workflow:user-profile:${userId}`;
  }

  /**
   * Кешировать user variables в Redis
   */
  static async cacheUserVariables(
    projectId: string,
    userId: string,
    variables: Record<string, any>
  ): Promise<void> {
    try {
      const cacheKey = this.getUserVariablesCacheKey(projectId, userId);
      const cacheData = {
        variables,
        userId,
        projectId,
        cachedAt: new Date().toISOString()
      };

      await CacheService.set(cacheKey, cacheData, 2 * 60); // 2 минуты

      logger.debug('✅ Cached user variables', {
        userId,
        projectId,
        cacheKey,
        variablesCount: Object.keys(variables).length,
        ttl: 2 * 60
      });
    } catch (error) {
      logger.error('❌ Failed to cache user variables', {
        userId,
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Получить cached user variables из Redis
   */
  static async getCachedUserVariables(
    projectId: string,
    userId: string
  ): Promise<Record<string, any> | null> {
    try {
      const cacheKey = this.getUserVariablesCacheKey(projectId, userId);
      const cachedData = await CacheService.get(cacheKey);

      if (!cachedData) {
        return null;
      }

      logger.debug('✅ Found cached user variables', {
        userId,
        projectId,
        cacheKey,
        variablesCount: Object.keys(
          (cachedData as { variables: Record<string, any> }).variables
        ).length,
        cacheHit: true
      });

      return (cachedData as { variables: Record<string, any> }).variables;
    } catch (error) {
      logger.error('❌ Failed to get cached user variables', {
        userId,
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Кешировать результат get_user_profile в Redis
   */
  static async cacheUserProfile(userId: string, profile: any): Promise<void> {
    try {
      const cacheKey = this.getUserProfileCacheKey(userId);
      const cacheData = {
        profile,
        userId,
        cachedAt: new Date().toISOString()
      };

      await CacheService.set(cacheKey, cacheData, 30); // 30 секунд

      logger.debug('✅ Cached user profile', {
        userId,
        cacheKey,
        ttl: 30
      });
    } catch (error) {
      logger.error('❌ Failed to cache user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Получить cached user profile из Redis
   */
  static async getCachedUserProfile(userId: string): Promise<any | null> {
    try {
      const cacheKey = this.getUserProfileCacheKey(userId);
      const cachedData = await CacheService.get(cacheKey);

      if (!cachedData) {
        return null;
      }

      logger.debug('✅ Found cached user profile', {
        userId,
        cacheKey,
        cacheHit: true
      });

      return (cachedData as { profile: any }).profile;
    } catch (error) {
      logger.error('❌ Failed to get cached user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Инвалидировать кеш user variables при обновлении данных пользователя
   */
  static async invalidateUserVariablesCache(
    projectId: string,
    userId: string
  ): Promise<void> {
    try {
      const cacheKey = this.getUserVariablesCacheKey(projectId, userId);
      await CacheService.delete(cacheKey);

      logger.debug('🗑️ Invalidated user variables cache', {
        userId,
        projectId,
        cacheKey
      });
    } catch (error) {
      logger.error('❌ Failed to invalidate user variables cache', {
        userId,
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Инвалидировать кеш user profile при обновлении данных пользователя
   */
  static async invalidateUserProfileCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.getUserProfileCacheKey(userId);
      await CacheService.delete(cacheKey);

      logger.debug('🗑️ Invalidated user profile cache', {
        userId,
        cacheKey
      });
    } catch (error) {
      logger.error('❌ Failed to invalidate user profile cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Возобновляет выполнение workflow после задержки
   * Вызывается из Bull queue job handler в DelayJobService
   */
  static async resumeWorkflowAfterDelay(
    executionId: string,
    nodeId: string,
    projectId: string,
    workflowId: string
  ): Promise<void> {
    logger.info('Resuming workflow after delay', {
      executionId,
      nodeId,
      projectId,
      workflowId
    });

    try {
      // Получаем execution из БД
      const execution = await db.workflowExecution.findUnique({
        where: { id: executionId }
      });

      if (!execution) {
        throw new Error(`Workflow execution ${executionId} not found`);
      }

      // Проверяем, что execution еще активен
      if (execution.status === 'finished') {
        logger.warn('Cannot resume finished workflow execution', {
          executionId
        });
        return;
      }

      // Получаем версию workflow
      const versionRecord = await db.workflowVersion.findFirst({
        where: {
          workflowId,
          version: execution.version
        }
      });

      if (!versionRecord) {
        throw new Error(
          `Workflow version not found: workflowId=${workflowId}, version=${execution.version}`
        );
      }

      // Преобразуем nodes в нужный формат
      let nodesObject: Record<string, WorkflowNode>;
      if (Array.isArray(versionRecord.nodes)) {
        nodesObject = {};
        (versionRecord.nodes as any[]).forEach((node: any) => {
          nodesObject[node.id] = node;
        });
      } else {
        nodesObject = (versionRecord.nodes as Record<string, any>) || {};
      }

      const workflowVersion: WorkflowVersion = {
        id: versionRecord.id,
        workflowId: versionRecord.workflowId,
        version: versionRecord.version,
        nodes: nodesObject as Record<string, WorkflowNode>,
        entryNodeId: versionRecord.entryNodeId,
        variables:
          (versionRecord.variables as unknown as WorkflowVersion['variables']) ||
          [],
        settings:
          (versionRecord.settings as unknown as WorkflowVersion['settings']) ||
          undefined,
        isActive: versionRecord.isActive,
        createdAt: versionRecord.createdAt
      };

      // Создаем processor для выполнения workflow
      const processor = new SimpleWorkflowProcessor(workflowVersion, projectId);

      // Возобновляем контекст выполнения
      const context = await ExecutionContextManager.resumeContext(executionId);

      // Обновляем статус execution на 'running'
      await db.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'running',
          currentNodeId: nodeId
        }
      });

      // Возобновляем выполнение workflow с указанной ноды
      await processor.resumeWorkflow(context, nodeId);

      logger.info('Workflow resumed successfully after delay', {
        executionId,
        nodeId
      });
    } catch (error) {
      logger.error('Failed to resume workflow after delay', {
        executionId,
        nodeId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Обновляем статус execution на 'error'
      try {
        await db.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date()
          }
        });
      } catch (updateError) {
        logger.error('Failed to update execution status to error', {
          executionId,
          updateError:
            updateError instanceof Error
              ? updateError.message
              : String(updateError)
        });
      }

      throw error;
    }
  }
}
