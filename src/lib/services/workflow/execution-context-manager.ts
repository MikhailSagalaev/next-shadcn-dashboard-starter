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
  TelegramContact
} from '@/types/workflow';

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
    callbackData?: string
  ): Promise<ExecutionContext> {
    // Получаем токен бота для проекта из BotSettings
    const botSettings = await db.botSettings.findUnique({
      where: { projectId },
      select: { botToken: true, botUsername: true }
    });

    if (!botSettings?.botToken) {
      console.error('Bot token not found in bot settings for project:', projectId);
      throw new Error(`Bot token not configured for project ${projectId}. Please set up bot token in project settings.`);
    }

    // Создаем запись о выполнении
    let execution: any;
    try {
      execution = await db.workflowExecution.create({
        data: {
          projectId,
          workflowId,
          version,
          sessionId,
          userId: userId || null,
          telegramChatId: telegramChatId || null,
          status: 'running'
        }
      });
    } catch (dbError) {
      console.error('Failed to create workflow execution record:', dbError);
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

    // Создаем простой logger без зависимостей
    const simpleLogger = {
      info: (message: string, data?: any) => console.log(`[INFO] ${execution?.id || 'unknown'}: ${message}`, data),
      error: (message: string, data?: any) => console.error(`[ERROR] ${execution?.id || 'unknown'}: ${message}`, data),
      warn: (message: string, data?: any) => console.warn(`[WARN] ${execution?.id || 'unknown'}: ${message}`, data),
      debug: (message: string, data?: any) => console.debug(`[DEBUG] ${execution?.id || 'unknown'}: ${message}`, data)
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
        }
      },
      variables: variableManager,
      logger: simpleLogger,
      services: {
        db,
        http: this.createHttpClient()
      },
      now: () => new Date(),
      step: 0,
      maxSteps: 200
    };

    return context;
  }

  /**
   * Обновляет контекст для следующего шага
   */
  static updateContextForStep(context: ExecutionContext, step: number, nodeId: string, nodeType: string): ExecutionContext {
    return {
      ...context,
      step,
      logger: {
        info: (message: string, data?: any) => this.log(context.executionId, step, nodeId, 'info', message, { nodeType, ...data }),
        error: (message: string, data?: any) => this.log(context.executionId, step, nodeId, 'error', message, { nodeType, ...data }),
        warn: (message: string, data?: any) => this.log(context.executionId, step, nodeId, 'warn', message, { nodeType, ...data }),
        debug: (message: string, data?: any) => this.log(context.executionId, step, nodeId, 'debug', message, { nodeType, ...data })
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
        error: updateError instanceof Error ? updateError.message : 'Unknown error'
      });
    }
  }

  /**
   * Логирует шаг выполнения
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

      await db.workflowLog.create({
        data: {
          executionId,
          step,
          nodeId,
          nodeType,
          level,
          message,
          data: data ? JSON.parse(JSON.stringify(data)) : null
        }
      });

      // Также выводим в консоль для отладки
      const logLevel = level.toUpperCase();
      console.log(`[${logLevel}] Execution ${executionId} Step ${step} Node ${nodeId}: ${message}`);

    } catch (error) {
      console.error('Failed to log execution step:', error);
    }
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

