/**
 * @file: src/lib/services/workflow/execution-context-manager.ts
 * @description: Менеджер контекста выполнения workflow
 * @project: SaaS Bonus System
 * @dependencies: VariableManager, Prisma, ExecutionContext
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { createVariableManager } from './variable-manager';
import type {
  ExecutionContext,
  TelegramContact,
  VariableScope
} from '@/types/workflow';

/**
 * Интерфейс для обновления состояния выполнения
 */
export interface ExecutionStateUpdate {
  status?: string;
  currentNodeId?: string;
  stepCount?: number;
  error?: string;
  waitType?: string | null;
  waitPayload?: any;
  variables?: Array<{
    scope: VariableScope;
    key: string;
    value: any;
    ttl?: number;
  }>;
}

/**
 * Интерфейс для расширенного логирования шага с полным payload
 */
export interface StepLogData {
  nodeId: string;
  nodeType: string;
  step: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  branchKey?: string;
  status?: string;
  inputData?: any;
  outputData?: any;
  variablesBefore?: Record<string, any>;
  variablesAfter?: Record<string, any>;
  httpRequest?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  httpResponse?: {
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  durationMs?: number;
  data?: any;
}

/**
 * Список чувствительных ключей для санитизации
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'private',
  'key',
  'bearer',
  'jwt',
  'session',
  'cookie',
  'csrf',
  'xsrf',
  'access_token',
  'refresh_token',
  'bot_token',
  'bottoken',
  'webhook_secret',
  'webhooksecret'
];

/**
 * Санитизирует объект, маскируя чувствительные данные
 */
function sanitizeData(data: any, maxDepth: number = 10): any {
  if (maxDepth <= 0) return '[MAX_DEPTH_EXCEEDED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Проверяем, не является ли строка слишком длинной (>1MB)
    if (data.length > 1024 * 1024) {
      return `[TRUNCATED: ${data.length} bytes]`;
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, maxDepth - 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));

    if (isSensitive && typeof value === 'string' && value.length > 0) {
      // Маскируем чувствительные данные, показывая только первые 4 символа
      sanitized[key] =
        value.length > 8
          ? `${value.substring(0, 4)}****[MASKED]`
          : '****[MASKED]';
    } else {
      sanitized[key] = sanitizeData(value, maxDepth - 1);
    }
  }

  return sanitized;
}

/**
 * Менеджер контекста выполнения workflow
 */
export class ExecutionContextManager {
  /**
   * Создает новый контекст выполнения
   */
  static async createContext(
    projectId: string,
    workflowId: string,
    version: number,
    sessionId: string,
    userId?: string,
    telegramChatId?: string,
    telegramUserId?: string,
    telegramUsername?: string,
    messageText?: string,
    callbackData?: string,
    contact?: TelegramContact
  ): Promise<ExecutionContext> {
    // Получаем токен бота и настройки лимитов для проекта
    const [botSettings, project] = await Promise.all([
      db.botSettings.findUnique({
        where: { projectId },
        select: { botToken: true, botUsername: true }
      }),
      db.project.findUnique({
        where: { id: projectId },
        select: { workflowMaxSteps: true, workflowTimeoutMs: true }
      })
    ]);

    if (!botSettings?.botToken) {
      console.error(
        'Bot token not found in bot settings for project:',
        projectId
      );
      throw new Error(
        `Bot token not configured for project ${projectId}. Please set up bot token in project settings.`
      );
    }

    // ✨ НОВОЕ: Используем лимиты из настроек проекта или значения по умолчанию
    const maxSteps = project?.workflowMaxSteps ?? 200;
    // timeoutMs доступен для будущего использования: project?.workflowTimeoutMs ?? 30000

    // ✅ КРИТИЧНО: Проверяем существование workflow перед созданием execution
    const workflowExists = await db.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true }
    });

    if (!workflowExists) {
      console.error('❌ Workflow not found in database, clearing cache:', {
        workflowId,
        projectId
      });
      // Очищаем кэш для этого проекта
      const { WorkflowRuntimeService } = await import(
        '../workflow-runtime.service'
      );
      await WorkflowRuntimeService.invalidateCache(projectId);
      throw new Error(
        `Workflow ${workflowId} not found. Cache has been cleared, please retry.`
      );
    }

    // Создаем запись о выполнении
    let execution: any;
    const executionPayload = {
      projectId,
      workflowId,
      version,
      sessionId,
      userId: userId || null,
      telegramChatId: telegramChatId || null,
      status: 'running'
    } as const;

    try {
      console.log(
        '🧾 Creating workflow execution with payload:',
        executionPayload
      );
      execution = await db.workflowExecution.create({
        data: executionPayload
      });
    } catch (dbError: any) {
      console.error('❌ Failed to create workflow execution record:', {
        payload: executionPayload,
        message: dbError?.message,
        code: dbError?.code,
        meta: dbError?.meta
      });
      // Если ошибка foreign key - очищаем кэш
      if (dbError?.code === 'P2003') {
        const { WorkflowRuntimeService } = await import(
          '../workflow-runtime.service'
        );
        await WorkflowRuntimeService.invalidateCache(projectId);
        console.log('🧹 Cache invalidated due to foreign key error');
      }
      throw dbError;
    }

    // Проверяем что execution создан
    if (!execution || !execution.id) {
      throw new Error('Failed to create workflow execution record');
    }

    // Создаем менеджер переменных
    const variableManager = createVariableManager(
      projectId,
      workflowId,
      userId,
      sessionId
    );

    // Предзагружаем переменные в кэш для синхронного доступа
    await variableManager.preloadCache();

    // Создаем простой logger без зависимостей
    const simpleLogger = {
      info: (message: string, data?: any) =>
        console.log(`[INFO] ${execution?.id || 'unknown'}: ${message}`, data),
      error: (message: string, data?: any) =>
        console.error(
          `[ERROR] ${execution?.id || 'unknown'}: ${message}`,
          data
        ),
      warn: (message: string, data?: any) =>
        console.warn(`[WARN] ${execution?.id || 'unknown'}: ${message}`, data),
      debug: (message: string, data?: any) =>
        console.debug(`[DEBUG] ${execution?.id || 'unknown'}: ${message}`, data)
    };

    // Создаем контекст
    const context: ExecutionContext = {
      executionId: execution.id,
      projectId,
      workflowId,
      version,
      sessionId,
      userId,
      telegram: {
        chatId: telegramChatId || sessionId,
        userId: telegramUserId || '',
        username: telegramUsername,
        firstName: telegramUsername,
        botToken: botSettings.botToken,
        message: {
          text: messageText,
          callbackData
        },
        contact: contact
      },
      variables: variableManager,
      logger: simpleLogger,
      services: {
        db,
        http: this.createHttpClient()
      },
      now: () => new Date(),
      step: 0,
      maxSteps: maxSteps // ✨ Используем настройки проекта
    };

    return context;
  }

  /**
   * Возобновляет существующий контекст выполнения
   */
  static async resumeContext(
    executionId: string,
    telegramChatId?: string,
    telegramUserId?: string,
    telegramUsername?: string,
    messageText?: string,
    callbackData?: string,
    contact?: TelegramContact
  ): Promise<ExecutionContext> {
    // Получаем существующий execution
    const execution = await db.workflowExecution.findUnique({
      where: { id: executionId }
    });

    if (!execution) {
      throw new Error(`Workflow execution ${executionId} not found`);
    }

    // Получаем токен бота и настройки лимитов для проекта
    const [botSettings, project] = await Promise.all([
      db.botSettings.findUnique({
        where: { projectId: execution.projectId },
        select: { botToken: true, botUsername: true }
      }),
      db.project.findUnique({
        where: { id: execution.projectId },
        select: { workflowMaxSteps: true, workflowTimeoutMs: true }
      })
    ]);

    if (!botSettings?.botToken) {
      throw new Error(
        `Bot token not configured for project ${execution.projectId}`
      );
    }

    // ✨ НОВОЕ: Используем лимиты из настроек проекта или значения по умолчанию
    const maxSteps = project?.workflowMaxSteps ?? 200;

    // Создаем менеджер переменных для существующего execution
    const variableManager = createVariableManager(
      execution.projectId,
      execution.workflowId,
      execution.userId || undefined,
      execution.sessionId
    );

    // Предзагружаем переменные в кэш для синхронного доступа
    await variableManager.preloadCache();

    // Создаем простой logger
    const simpleLogger = {
      info: (message: string, data?: any) =>
        console.log(`[INFO] ${execution.id}: ${message}`, data),
      error: (message: string, data?: any) =>
        console.error(`[ERROR] ${execution.id}: ${message}`, data),
      warn: (message: string, data?: any) =>
        console.warn(`[WARN] ${execution.id}: ${message}`, data),
      debug: (message: string, data?: any) =>
        console.debug(`[DEBUG] ${execution.id}: ${message}`, data)
    };

    // Создаем контекст для возобновления
    const context: ExecutionContext = {
      executionId: execution.id,
      projectId: execution.projectId,
      workflowId: execution.workflowId,
      version: execution.version,
      sessionId: execution.sessionId,
      userId: execution.userId || undefined,
      telegram: {
        chatId:
          telegramChatId || execution.telegramChatId || execution.sessionId,
        userId: telegramUserId || '',
        username: telegramUsername,
        firstName: telegramUsername,
        botToken: botSettings.botToken,
        message: {
          text: messageText,
          callbackData
        },
        contact: contact
      },
      variables: variableManager,
      logger: simpleLogger,
      services: {
        db,
        http: this.createHttpClient()
      },
      now: () => new Date(),
      step: 0, // Сбрасываем step для возобновления
      maxSteps: maxSteps // ✨ Используем настройки проекта
    };

    return context;
  }

  /**
   * Обновляет контекст для следующего шага
   */
  static updateContextForStep(
    context: ExecutionContext,
    step: number,
    nodeId: string,
    nodeType: string
  ): ExecutionContext {
    return {
      ...context,
      step,
      logger: {
        info: (message: string, data?: any) =>
          this.log(context.executionId, step, nodeId, 'info', message, {
            nodeType,
            ...data
          }),
        error: (message: string, data?: any) =>
          this.log(context.executionId, step, nodeId, 'error', message, {
            nodeType,
            ...data
          }),
        warn: (message: string, data?: any) =>
          this.log(context.executionId, step, nodeId, 'warn', message, {
            nodeType,
            ...data
          }),
        debug: (message: string, data?: any) =>
          this.log(context.executionId, step, nodeId, 'debug', message, {
            nodeType,
            ...data
          })
      }
    };
  }

  /**
   * Завершает выполнение
   */
  static async completeExecution(
    context: ExecutionContext,
    status: 'completed' | 'failed',
    error?: string,
    stepCount?: number
  ): Promise<void> {
    console.log('Completing workflow execution:', {
      executionId: context.executionId,
      status,
      stepCount: stepCount || context.step
    });

    try {
      await db.workflowExecution.update({
        where: { id: context.executionId },
        data: {
          status,
          finishedAt: new Date(),
          error,
          stepCount: stepCount || context.step
        }
      });

      // ✅ ИНВАЛИДИРУЕМ КЕШ WAITING EXECUTION
      try {
        // Получаем информацию о завершенном execution для инвалидации кеша
        const finishedExecution = await db.workflowExecution.findUnique({
          where: { id: context.executionId },
          select: {
            projectId: true,
            telegramChatId: true,
            waitType: true
          }
        });

        if (finishedExecution?.telegramChatId && finishedExecution?.waitType) {
          const { WorkflowRuntimeService } = await import(
            '@/lib/services/workflow-runtime.service'
          );
          await WorkflowRuntimeService.invalidateWaitingExecutionCache(
            finishedExecution.projectId,
            finishedExecution.telegramChatId,
            finishedExecution.waitType
          );
        }
      } catch (cacheError) {
        console.warn(
          'Failed to invalidate waiting execution cache:',
          cacheError
        );
        // Не бросаем ошибку - инвалидация кеша не критична
      }

      console.log('Workflow execution record updated successfully');

      // Очищаем переменные сессии если выполнение завершено
      if (status === 'completed') {
        try {
          await context.variables.cleanupExpired();
          console.log('Variables cleanup completed');
        } catch (cleanupError) {
          console.error('Failed to cleanup variables:', cleanupError);
          // Не бросаем ошибку, cleanup не критичен
        }
      }
    } catch (updateError) {
      console.error('Failed to complete execution:', {
        executionId: context.executionId,
        error:
          updateError instanceof Error ? updateError.message : 'Unknown error'
      });
    }
  }

  /**
   * Обновляет состояние выполнения атомарно с использованием транзакции
   * Включает retry logic с exponential backoff (max 3 attempts)
   *
   * @param context - Контекст выполнения
   * @param updates - Обновления состояния
   * @throws Error если все попытки неуспешны
   */
  static async updateExecutionState(
    context: ExecutionContext,
    updates: ExecutionStateUpdate
  ): Promise<void> {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 100;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await db.$transaction(async (tx) => {
          // Обновляем execution
          const executionUpdateData: Record<string, any> = {};

          if (updates.status !== undefined) {
            executionUpdateData.status = updates.status;
          }
          if (updates.currentNodeId !== undefined) {
            executionUpdateData.currentNodeId = updates.currentNodeId;
          }
          if (updates.stepCount !== undefined) {
            executionUpdateData.stepCount = updates.stepCount;
          }
          if (updates.error !== undefined) {
            executionUpdateData.error = updates.error;
          }
          if (updates.waitType !== undefined) {
            executionUpdateData.waitType = updates.waitType;
          }
          if (updates.waitPayload !== undefined) {
            executionUpdateData.waitPayload = updates.waitPayload;
          }

          // Обновляем execution только если есть что обновлять
          if (Object.keys(executionUpdateData).length > 0) {
            await tx.workflowExecution.update({
              where: { id: context.executionId },
              data: executionUpdateData
            });
          }

          // Обновляем переменные в той же транзакции
          if (updates.variables && updates.variables.length > 0) {
            for (const v of updates.variables) {
              const expiresAt = v.ttl
                ? new Date(Date.now() + v.ttl * 1000)
                : null;

              await tx.workflowVariable.upsert({
                where: {
                  unique_variable: {
                    projectId: context.projectId,
                    workflowId: context.workflowId,
                    userId: context.userId || null,
                    sessionId: context.sessionId,
                    scope: v.scope,
                    key: v.key
                  }
                },
                create: {
                  projectId: context.projectId,
                  workflowId: context.workflowId,
                  userId: context.userId || null,
                  sessionId: context.sessionId,
                  scope: v.scope,
                  key: v.key,
                  value: v.value,
                  expiresAt
                },
                update: {
                  value: v.value,
                  expiresAt
                }
              });

              // Также обновляем кэш в VariableManager
              if (
                context.variables &&
                typeof (context.variables as any).updateCache === 'function'
              ) {
                (context.variables as any).updateCache(v.key, v.value, v.scope);
              }
            }
          }
        });

        // Успешно - выходим из цикла
        console.log(
          `[ExecutionContextManager] State updated successfully for execution ${context.executionId}`
        );
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(
          `[ExecutionContextManager] Transaction failed (attempt ${attempt}/${MAX_RETRIES}):`,
          {
            executionId: context.executionId,
            error: lastError.message
          }
        );

        // Если это не последняя попытка, ждем с exponential backoff
        if (attempt < MAX_RETRIES) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // Все попытки неуспешны
    console.error(
      `[ExecutionContextManager] All ${MAX_RETRIES} attempts failed for execution ${context.executionId}:`,
      lastError?.message
    );
    throw (
      lastError ||
      new Error('Failed to update execution state after all retries')
    );
  }

  /**
   * Логирует шаг выполнения с полным payload
   */
  private static async log(
    executionId: string,
    step: number,
    nodeId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    data?: any
  ): Promise<void> {
    try {
      // Определяем тип ноды по nodeId (простая логика)
      let nodeType = 'unknown';
      if (nodeId.includes('trigger')) nodeType = 'trigger';
      else if (nodeId.includes('message')) nodeType = 'message';
      else if (nodeId.includes('condition')) nodeType = 'condition';
      else if (nodeId.includes('action')) nodeType = 'action';
      else if (nodeId.includes('flow')) nodeType = 'flow';

      const safeData = data ? JSON.parse(JSON.stringify(data)) : null;
      const maskedInput =
        safeData?.input && typeof safeData.input === 'string'
          ? safeData.input.slice(0, 2000)
          : safeData?.input;
      const maskedOutput =
        safeData?.output && typeof safeData.output === 'string'
          ? safeData.output.slice(0, 2000)
          : safeData?.output;

      await db.workflowLog.create({
        data: {
          executionId,
          step,
          nodeId,
          nodeType,
          level,
          message,
          branchKey: safeData?.branchKey,
          status: safeData?.status,
          input: maskedInput || null,
          output: maskedOutput || null,
          error: safeData?.error || null,
          durationMs: safeData?.durationMs || null,
          data: safeData && !safeData.data ? safeData : safeData?.data || null
        }
      });

      // Также выводим в консоль для отладки
      const logLevel = level.toUpperCase();
      console.log(
        `[${logLevel}] Execution ${executionId} Step ${step} Node ${nodeId}: ${message}`
      );
    } catch (error) {
      console.error('Failed to log execution step:', error);
    }
  }

  /**
   * Логирует шаг выполнения с полным payload (расширенная версия)
   * Включает inputData, outputData, variablesBefore/After, HTTP данные
   */
  static async logStepWithPayload(
    executionId: string,
    logData: StepLogData
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Санитизируем все данные перед сохранением
      const sanitizedInputData = logData.inputData
        ? sanitizeData(logData.inputData)
        : null;
      const sanitizedOutputData = logData.outputData
        ? sanitizeData(logData.outputData)
        : null;
      const sanitizedVariablesBefore = logData.variablesBefore
        ? sanitizeData(logData.variablesBefore)
        : null;
      const sanitizedVariablesAfter = logData.variablesAfter
        ? sanitizeData(logData.variablesAfter)
        : null;
      const sanitizedHttpRequest = logData.httpRequest
        ? sanitizeData(logData.httpRequest)
        : null;
      const sanitizedHttpResponse = logData.httpResponse
        ? sanitizeData(logData.httpResponse)
        : null;
      const sanitizedError = logData.error
        ? {
            message: logData.error.message,
            stack: logData.error.stack?.slice(0, 5000), // Ограничиваем stack trace
            code: logData.error.code
          }
        : null;

      await db.workflowLog.create({
        data: {
          executionId,
          step: logData.step,
          nodeId: logData.nodeId,
          nodeType: logData.nodeType,
          level: logData.level,
          message: logData.message,
          branchKey: logData.branchKey || null,
          status: logData.status || null,
          input: sanitizedInputData,
          output: sanitizedOutputData,
          error: sanitizedError,
          durationMs: logData.durationMs || null,
          data: logData.data ? sanitizeData(logData.data) : null,
          // Новые поля для полного payload
          inputData: sanitizedInputData,
          outputData: sanitizedOutputData,
          variablesBefore: sanitizedVariablesBefore,
          variablesAfter: sanitizedVariablesAfter,
          httpRequest: sanitizedHttpRequest,
          httpResponse: sanitizedHttpResponse,
          duration: logData.durationMs || null
        }
      });

      // Логируем в консоль для отладки
      const logLevel = logData.level.toUpperCase();
      console.log(
        `[${logLevel}] Execution ${executionId} Step ${logData.step} Node ${logData.nodeId}: ${logData.message}`,
        logData.durationMs ? `(${logData.durationMs}ms)` : ''
      );
    } catch (error) {
      console.error('Failed to log execution step with payload:', error);
    }
  }

  /**
   * Получает текущее состояние переменных для логирования
   */
  static async captureVariablesState(
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    try {
      const variables: Record<string, any> = {};

      // Получаем все переменные сессии
      const sessionVars = await context.variables.list('session');
      for (const [key, value] of Object.entries(sessionVars)) {
        variables[`session.${key}`] = value;
      }

      // Добавляем telegram контекст (без чувствительных данных)
      variables['telegram.chatId'] = context.telegram.chatId;
      variables['telegram.userId'] = context.telegram.userId;
      variables['telegram.username'] = context.telegram.username;

      return sanitizeData(variables);
    } catch (error) {
      console.error('Failed to capture variables state:', error);
      return {};
    }
  }

  /**
   * Создает sub-context для выполнения sub-workflow
   * Наследует telegram контекст и services от родительского контекста
   * Создает отдельную запись execution для отслеживания
   *
   * @param parentContext - Родительский контекст выполнения
   * @param subWorkflowId - ID sub-workflow
   * @param subVersion - Версия sub-workflow
   * @param nestingLevel - Уровень вложенности (для защиты от бесконечной рекурсии)
   */
  static async createSubContext(
    parentContext: ExecutionContext,
    subWorkflowId: string,
    subVersion: number,
    nestingLevel: number
  ): Promise<ExecutionContext> {
    // Генерируем уникальный sessionId для sub-workflow
    const subSessionId = `${parentContext.sessionId}_sub_${Date.now()}`;

    // Создаем запись о выполнении sub-workflow
    // Примечание: parentExecutionId может не существовать в старых версиях схемы
    const executionData: any = {
      projectId: parentContext.projectId,
      workflowId: subWorkflowId,
      version: subVersion,
      sessionId: subSessionId,
      userId: parentContext.userId || null,
      telegramChatId: parentContext.telegram.chatId || null,
      status: 'running'
    };

    // Пытаемся добавить parentExecutionId если поле существует в схеме
    try {
      executionData.parentExecutionId = parentContext.executionId;
    } catch {
      // Поле не существует в текущей версии схемы
      console.warn(
        '[ExecutionContextManager] parentExecutionId field not available in schema'
      );
    }

    const subExecution = await db.workflowExecution.create({
      data: executionData
    });

    // Создаем менеджер переменных для sub-workflow
    const variableManager = createVariableManager(
      parentContext.projectId,
      subWorkflowId,
      parentContext.userId,
      subSessionId
    );

    // Предзагружаем переменные в кэш
    await variableManager.preloadCache();

    // Создаем logger для sub-workflow
    const subLogger = {
      info: (message: string, data?: any) =>
        console.log(`[INFO] Sub-${subExecution.id}: ${message}`, data),
      error: (message: string, data?: any) =>
        console.error(`[ERROR] Sub-${subExecution.id}: ${message}`, data),
      warn: (message: string, data?: any) =>
        console.warn(`[WARN] Sub-${subExecution.id}: ${message}`, data),
      debug: (message: string, data?: any) =>
        console.debug(`[DEBUG] Sub-${subExecution.id}: ${message}`, data)
    };

    // Используем maxSteps из родительского контекста или значение по умолчанию
    const maxSteps = parentContext.maxSteps || 200;

    // Создаем sub-context
    const subContext: ExecutionContext = {
      executionId: subExecution.id,
      projectId: parentContext.projectId,
      workflowId: subWorkflowId,
      version: subVersion,
      sessionId: subSessionId,
      userId: parentContext.userId,
      // Наследуем telegram контекст от родителя
      telegram: {
        ...parentContext.telegram
      },
      variables: variableManager,
      logger: subLogger,
      // Наследуем services от родителя
      services: parentContext.services,
      now: () => new Date(),
      step: 0,
      maxSteps: maxSteps
    };

    // Добавляем уровень вложенности в контекст
    (subContext as any).nestingLevel = nestingLevel;
    (subContext as any).parentExecutionId = parentContext.executionId;

    console.log(
      `[ExecutionContextManager] Created sub-context for workflow ${subWorkflowId}`,
      {
        subExecutionId: subExecution.id,
        parentExecutionId: parentContext.executionId,
        nestingLevel,
        subSessionId
      }
    );

    return subContext;
  }

  /**
   * Создает HTTP клиент для выполнения запросов
   */
  private static createHttpClient() {
    return {
      get: async (url: string, options?: any) => {
        const response = await fetch(url, { ...options, method: 'GET' });
        return response.json();
      },
      post: async (url: string, data?: any, options?: any) => {
        const response = await fetch(url, {
          ...options,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...options?.headers },
          body: data ? JSON.stringify(data) : undefined
        });
        return response.json();
      },
      put: async (url: string, data?: any, options?: any) => {
        const response = await fetch(url, {
          ...options,
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...options?.headers },
          body: data ? JSON.stringify(data) : undefined
        });
        return response.json();
      },
      delete: async (url: string, options?: any) => {
        const response = await fetch(url, { ...options, method: 'DELETE' });
        return response.json();
      }
    };
  }
}
