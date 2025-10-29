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
import { CacheService } from '@/lib/redis';
import type { WorkflowVersion, WorkflowNode, WorkflowConnection } from '@/types/workflow';

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
  private static activeVersionsCache: Map<string, CachedWorkflowVersionEntry> = new Map();
  private static activeFlowsCache: Map<string, CachedWorkflowProcessorEntry> = new Map();
  private static compiledFlowsCache: Map<string, any> = new Map();

  private static getActiveVersionCacheKey(projectId: string): string {
    return `project:${projectId}:workflow:active-version`;
  }

  private static serializeWorkflowVersion(version: WorkflowVersion): SerializedWorkflowVersion {
    return {
      ...version,
      createdAt: version.createdAt instanceof Date ? version.createdAt.toISOString() : version.createdAt
    };
  }

  private static deserializeWorkflowVersion(serialized: SerializedWorkflowVersion): WorkflowVersion {
    return {
      ...serialized,
      createdAt: new Date(serialized.createdAt)
    };
  }

  private static getProcessorCacheKey(projectId: string): string {
    return projectId;
  }

  private static setMemoryCache(projectId: string, version: WorkflowVersion): void {
    this.activeVersionsCache.set(projectId, {
      version,
      expiresAt: Date.now() + ACTIVE_VERSION_MEMORY_TTL_MS
    });
  }

  private static async cacheActiveVersion(projectId: string, version: WorkflowVersion): Promise<void> {
    this.setMemoryCache(projectId, version);
    await CacheService.set(this.getActiveVersionCacheKey(projectId), this.serializeWorkflowVersion(version), ACTIVE_VERSION_CACHE_TTL_SECONDS);
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

  private static getCachedProcessor(projectId: string, workflowVersion: WorkflowVersion): SimpleWorkflowProcessor | null {
    const key = this.getProcessorCacheKey(projectId);
    const cachedEntry = this.activeFlowsCache.get(key);

    if (!cachedEntry) {
      return null;
    }

    const isSameWorkflow = cachedEntry.workflowId === workflowVersion.workflowId && cachedEntry.version === workflowVersion.version;
    const isExpired = cachedEntry.expiresAt < Date.now();

    if (!isSameWorkflow || isExpired) {
      this.activeFlowsCache.delete(key);
      this.compiledFlowsCache.delete(key);
      return null;
    }

    return cachedEntry.processor;
  }

  private static storeProcessor(projectId: string, workflowVersion: WorkflowVersion, processor: SimpleWorkflowProcessor): void {
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

  private static getWorkflowProcessor(projectId: string, workflowVersion: WorkflowVersion): SimpleWorkflowProcessor {
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
    }
  }

  /**
   * Получить активную версию workflow для проекта
   */
  static async getActiveWorkflowVersion(projectId: string): Promise<WorkflowVersion | null> {
    try {
      // Инициализируем handlers
      this.initializeHandlers();

      // Проверяем кэш в памяти
      const memoryCached = this.getCachedVersion(projectId);
      if (memoryCached) {
        logger.debug('Returning in-memory cached active workflow version', {
          projectId,
          workflowId: memoryCached.workflowId,
          version: memoryCached.version
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
        logger.debug('Returning Redis cached active workflow version', {
          projectId,
          workflowId: hydrated.workflowId,
          version: hydrated.version
        });
        return hydrated;
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

      console.log('🔁 Loaded active workflow version from DB:', {
        projectId,
        workflowId: workflowVersion.workflowId,
        version: workflowVersion.version,
        nodesCount: Object.keys(workflowVersion.nodes || {}).length
      });

      // Кэшируем в памяти и Redis
      await this.cacheActiveVersion(projectId, workflowVersion);

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
      // ✅ КРИТИЧНО: Инициализируем handlers в начале
      this.initializeHandlers();
      
      // 1) Сначала пробуем возобновить ожидающий execution
      const chatId: string | undefined = context.chat?.id?.toString();
      const telegramUserId: string | undefined = context.from?.id?.toString();

      let waitType: 'contact' | 'callback' | 'input' | null = null;
      if (context.message?.contact) waitType = 'contact';
      else if (context.callbackQuery) waitType = 'callback';
      else if (context.message?.text) waitType = 'input';

      if (chatId && waitType) {
        const waitingExecution = await db.workflowExecution.findFirst({
          where: {
            projectId,
            status: 'waiting',
            telegramChatId: chatId,
            waitType: waitType === 'input' ? ({ in: ['input', 'contact'] } as any) : waitType
          }
        });

        if (waitingExecution) {
          // Загружаем нужную версию workflow
          const versionRecord = await db.workflowVersion.findFirst({
            where: { workflowId: waitingExecution.workflowId, version: waitingExecution.version },
            include: { workflow: true }
          });

          if (!versionRecord) {
            logger.error('Workflow version not found for waiting execution', {
              workflowId: waitingExecution.workflowId,
              version: waitingExecution.version
            });
          } else {
            // Преобразуем nodes из массива в объект
            const nodesArray = (versionRecord.nodes as any) || [];
            const nodesObject: Record<string, any> = {};
            nodesArray.forEach((node: any) => {
              nodesObject[node.id] = node;
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
              connections: ((versionRecord.workflow as any)?.connections || []) as WorkflowConnection[]
            };
            // Обновляем пользователя при contact (НЕ создаём нового через бота)
            if ((waitingExecution.waitType === 'contact' || waitType === 'contact') && context.message?.contact) {
              const contact = context.message.contact;

              const raw = contact.phone_number;
              const digits = raw.replace(/[^0-9]/g, ''); // Удаляем ВСЕ нецифровые символы
              const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
              
                  // Формируем только нормализованные варианты (БЕЗ raw с пробелами!)
                  const plus = `+${digits}`;
                  const candidates = new Set<string>([plus, digits, last10]);
                  
                  // ✨ ДОПОЛНИТЕЛЬНО: Добавляем варианты с пробелами для поиска в базе
                  const withSpaces = `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
                  candidates.add(withSpaces);
                  
                  // Дополнительные варианты для РФ номеров
                  if (digits.length === 11 && digits.startsWith('8')) {
                    candidates.add(`+7${digits.slice(1)}`);
                    candidates.add(`7${digits.slice(1)}`);
                    const withSpaces7 = `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
                    candidates.add(withSpaces7);
                  } else if (digits.length === 11 && digits.startsWith('7')) {
                    candidates.add(`+7${digits.slice(1)}`);
                    candidates.add(`8${digits.slice(1)}`);
                    const withSpaces7 = `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
                    candidates.add(withSpaces7);
                  }

              logger.info('📞 Resume(contact): normalized candidates', {
                raw,
                digitsOnly: digits,
                last10,
                candidates: Array.from(candidates),
                projectId
              });

              const existing = await db.user.findFirst({
                where: {
                  projectId,
                  OR: [
                    telegramUserId ? { telegramId: BigInt(telegramUserId) } : undefined,
                    ...Array.from(candidates).map((ph) => ({ phone: ph }))
                  ].filter(Boolean) as any
                }
              });

              logger.info('🔍 User search result in workflow-runtime', {
                found: !!existing,
                userIdInDB: existing?.id,
                phoneInDB: existing?.phone,
                telegramIdInDB: existing?.telegramId?.toString(),
                searchedCandidates: Array.from(candidates)
              });

              if (existing) {
                await db.user.update({
                  where: { id: existing.id },
                  data: {
                    telegramId: telegramUserId ? BigInt(telegramUserId) : existing.telegramId,
                    telegramUsername: context.from?.username,
                    // не перезаписываем phone, если он уже сохранён в другом формате
                    firstName: contact.first_name || existing.firstName,
                    lastName: contact.last_name || existing.lastName,
                    isActive: true
                  }
                });

                logger.info('✅ Resume(contact): existing user matched and updated', { 
                  userId: existing.id, 
                  phoneInDB: existing.phone,
                  newTelegramId: telegramUserId
                });

                await db.workflowExecution.update({
                  where: { id: waitingExecution.id },
                  data: { userId: existing.id, status: 'running', waitType: null }
                });
              } else {
                // Пользователь не найден — НЕ создаём нового. Продолжаем без userId
                await db.workflowExecution.update({
                  where: { id: waitingExecution.id },
                  data: { status: 'running', waitType: null }
                });

                logger.info('Resume(contact): no user matched, continue without userId');
              }
            } else {
              // Просто снимаем wait и ставим running
              await db.workflowExecution.update({
                where: { id: waitingExecution.id },
                data: { status: 'running', waitType: null }
              });
            }

            // Восстанавливаем контекст
            const resumedContext = await (await import('./workflow/execution-context-manager')).ExecutionContextManager.resumeContext(
              waitingExecution.id,
              chatId,
              telegramUserId,
              context.from?.username,
              waitType === 'input' ? context.message?.text : undefined,
              waitType === 'callback' ? context.callbackQuery?.data : undefined
            );

            // Пробрасываем контакт, если есть
            if (waitType === 'contact' && context.message?.contact) {
              (resumedContext as any).telegram.contact = {
                phoneNumber: context.message.contact.phone_number,
                firstName: context.message.contact.first_name,
                lastName: context.message.contact.last_name,
                userId: context.message.contact.user_id
              };

              // ✅ КРИТИЧНО: Сохраняем contactReceived в workflow_variables
              const contactReceivedData = {
                phoneNumber: context.message.contact.phone_number,
                firstName: context.message.contact.first_name,
                lastName: context.message.contact.last_name,
                userId: context.message.contact.user_id,
                receivedAt: new Date().toISOString()
              };

              await resumedContext.variables.set('contactReceived', contactReceivedData);
              
              // ✅ КРИТИЧНО: Сохраняем projectId в workflow_variables
              await resumedContext.variables.set('projectId', projectId);

              logger.info('💾 Saving contactReceived and projectId to workflow variables', {
                executionId: waitingExecution.id,
                contactReceivedData,
                projectId
              });
            }

            // Вычисляем следующую ноду
            const connections: WorkflowConnection[] = versionToUse.connections || [];
            const nextConn = connections.find((c) => c.source === waitingExecution.currentNodeId);
            const nextNodeId = nextConn?.target;

            if (nextNodeId) {
              const processorForResume = this.getWorkflowProcessor(projectId, versionToUse);
              await processorForResume.resumeWorkflow(resumedContext, nextNodeId);
              return true;
            } else {
              logger.error('Next node after waiting not found', { currentNodeId: waitingExecution.currentNodeId });
              return false;
            }
          }
        }
      }

      // 2) Иначе — обычный запуск workflow
      const workflowVersion = await this.getActiveWorkflowVersion(projectId);
      if (!workflowVersion) {
        logger.debug('No active workflow version found for execution', { projectId });
        return false;
      }

      const processor = this.getWorkflowProcessor(projectId, workflowVersion);
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
  static async invalidateCache(projectId: string): Promise<void> {
    logger.debug('Invalidating workflow cache', { projectId });

    this.activeVersionsCache.delete(projectId);

    // Удаляем потенциально кешированный flow по ключу projectId
    this.activeFlowsCache.delete(projectId);

    const flowsEntries = Array.from(this.activeFlowsCache.entries());
    for (const [flowKey, flowValue] of flowsEntries) {
      if (flowValue?.projectId === projectId) {
        this.activeFlowsCache.delete(flowKey);
        this.compiledFlowsCache.delete(flowKey);
      }
    }

    await CacheService.delete(this.getActiveVersionCacheKey(projectId));
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

