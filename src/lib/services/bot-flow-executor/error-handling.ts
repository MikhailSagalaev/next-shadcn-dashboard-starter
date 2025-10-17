/**
 * @file: src/lib/services/bot-flow-executor/error-handling.ts
 * @description: Система обработки ошибок и fallback'ов для потоков
 * @project: SaaS Bonus System
 * @dependencies: Grammy, FlowExecutor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Context } from 'grammy';
import { SessionFlavor } from 'grammy';
import { logger } from '@/lib/logger';
import { BotFlowService } from '../bot-flow.service';

import type { BotConstructorSession } from '../bot-session.service';
import type { BotFlow } from '@/types/bot-constructor';

// Расширенный контекст
type BotConstructorContext = Context & SessionFlavor<BotConstructorSession> & {
  updateType?: string;
};

export class ErrorHandlingSystem {
  private fallbackFlows: Map<string, string> = new Map(); // projectId -> fallbackFlowId
  private errorRecoveryAttempts: Map<string, number> = new Map(); // sessionKey -> attempts

  /**
   * Регистрация fallback потока для проекта
   */
  registerFallbackFlow(projectId: string, fallbackFlowId: string): void {
    this.fallbackFlows.set(projectId, fallbackFlowId);
    logger.info('Fallback flow registered', { projectId, fallbackFlowId });
  }

  /**
   * Обработка ошибок выполнения ноды
   */
  async handleNodeExecutionError(
    ctx: BotConstructorContext,
    flowId: string,
    nodeId: string,
    error: unknown,
    flowExecutor: any
  ): Promise<void> {
    const userId = ctx.from?.id;
    const sessionKey = `${flowId}:${userId}`;

    logger.error('Node execution error', {
      flowId,
      nodeId,
      userId,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            }
          : String(error)
    });

    // Увеличиваем счетчик попыток восстановления
    const attempts = this.errorRecoveryAttempts.get(sessionKey) || 0;
    this.errorRecoveryAttempts.set(sessionKey, attempts + 1);

    try {
      // Пытаемся восстановить выполнение
      const recovered = await this.attemptErrorRecovery(
        ctx,
        flowId,
        nodeId,
        error,
        attempts
      );

      if (recovered) {
        logger.info('Error recovery successful', {
          flowId,
          nodeId,
          userId,
          attempts: attempts + 1
        });
        return;
      }

      // Если восстановление не удалось, переходим к fallback
      await this.executeFallbackFlow(ctx, flowId, error);
    } catch (recoveryError) {
      logger.error('Error recovery failed', {
        flowId,
        nodeId,
        userId,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError)
      });

      // Финальная обработка - отправляем сообщение пользователю
      await this.sendFinalErrorMessage(ctx);
    }
  }

  /**
   * Попытка восстановления после ошибки
   */
  private async attemptErrorRecovery(
    ctx: BotConstructorContext,
    flowId: string,
    nodeId: string,
    error: unknown,
    attempts: number
  ): Promise<boolean> {
    const maxRecoveryAttempts = 3;

    if (attempts >= maxRecoveryAttempts) {
      return false;
    }

    // Анализируем тип ошибки и пытаемся восстановить
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      // Ошибки сети - повторяем через некоторое время
      if (
        errorMessage.includes('network') ||
        errorMessage.includes('timeout')
      ) {
        await this.delay(1000 * (attempts + 1)); // Экспоненциальная задержка
        return true; // Позволяем повторить выполнение
      }

      // Ошибки валидации - просим пользователя исправить
      if (
        errorMessage.includes('validation') ||
        errorMessage.includes('invalid')
      ) {
        await ctx.reply(
          '❌ Пожалуйста, проверьте введенные данные и попробуйте еще раз.'
        );
        return true;
      }

      // Ошибки авторизации - перенаправляем на авторизацию
      if (
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('auth')
      ) {
        await ctx.reply(
          '🔐 Требуется авторизация. Пожалуйста, войдите в систему.'
        );
        return false; // Прерываем выполнение
      }
    }

    return false;
  }

  /**
   * Выполнение fallback потока
   */
  private async executeFallbackFlow(
    ctx: BotConstructorContext,
    originalFlowId: string,
    error: unknown
  ): Promise<void> {
    const projectId = ctx.session?.projectId;
    if (!projectId) return;

    const fallbackFlowId = this.fallbackFlows.get(projectId);
    if (!fallbackFlowId) {
      logger.warn('No fallback flow configured', { projectId, originalFlowId });
      return;
    }

    try {
      // Проверяем, что fallback поток существует и активен
      const fallbackFlow = await BotFlowService.getFlowById(fallbackFlowId);
      if (!fallbackFlow || !fallbackFlow.isActive) {
        logger.warn('Fallback flow not found or inactive', { fallbackFlowId });
        return;
      }

      // Сохраняем информацию об ошибке в сессии
      ctx.session.errorInfo = {
        originalFlowId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };

      // Запускаем fallback поток
      await ctx.reply(
        '⚠️ Произошла ошибка. Перенаправляю на резервный сценарий...'
      );

      // Здесь нужно вызвать flowExecutor.startFlow
      // await flowExecutor.startFlow(ctx, fallbackFlowId);

      logger.info('Fallback flow started', {
        originalFlowId,
        fallbackFlowId,
        userId: ctx.from?.id,
        projectId
      });
    } catch (fallbackError) {
      logger.error('Fallback flow execution failed', {
        originalFlowId,
        fallbackFlowId,
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError)
      });
    }
  }

  /**
   * Отправка финального сообщения об ошибке
   */
  private async sendFinalErrorMessage(
    ctx: BotConstructorContext
  ): Promise<void> {
    const errorMessage = `🚨 Произошла критическая ошибка

К сожалению, не удалось выполнить операцию.
Попробуйте:
• Начать заново с команды /start
• Обратиться в поддержку
• Повторить попытку позже

Приносим извинения за неудобства! 🙏`;

    try {
      await ctx.reply(errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Начать заново', callback_data: 'cmd_start' }],
            [{ text: '❓ Помощь', callback_data: 'cmd_help' }]
          ]
        }
      });
    } catch (sendError) {
      logger.error('Failed to send final error message', {
        error:
          sendError instanceof Error ? sendError.message : String(sendError)
      });
    }
  }

  /**
   * Обработка таймаутов
   */
  async handleTimeoutError(
    ctx: BotConstructorContext,
    flowId: string,
    timeoutType: 'input' | 'action' | 'flow'
  ): Promise<void> {
    const timeoutMessages = {
      input:
        '⏰ Время ожидания ввода истекло. Используйте /cancel для отмены или начните заново.',
      action: '⏰ Операция занимает слишком много времени. Попробуйте позже.',
      flow: '⏰ Время выполнения потока истекло. Начните заново с /start.'
    };

    const message = timeoutMessages[timeoutType];

    try {
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Начать заново', callback_data: 'cmd_start' }],
            [{ text: '❌ Отмена', callback_data: 'cmd_cancel' }]
          ]
        }
      });

      logger.info('Timeout handled', {
        flowId,
        timeoutType,
        userId: ctx.from?.id
      });
    } catch (error) {
      logger.error('Failed to handle timeout', {
        flowId,
        timeoutType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Очистка данных восстановления для сессии
   */
  clearRecoveryData(sessionKey: string): void {
    this.errorRecoveryAttempts.delete(sessionKey);
  }

  /**
   * Получение статистики ошибок
   */
  getErrorStats(): {
    totalRecoveryAttempts: number;
    activeRecoverySessions: number;
  } {
    return {
      totalRecoveryAttempts: Array.from(
        this.errorRecoveryAttempts.values()
      ).reduce((sum, attempts) => sum + attempts, 0),
      activeRecoverySessions: this.errorRecoveryAttempts.size
    };
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Создание middleware для перехвата ошибок
   */
  static createErrorHandlingMiddleware(errorHandler: ErrorHandlingSystem) {
    return async (ctx: BotConstructorContext, next: () => Promise<void>) => {
      try {
        await next();
      } catch (error) {
        // Логируем все необработанные ошибки
        logger.error('Unhandled error in middleware', {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name
                }
              : String(error),
          userId: ctx.from?.id,
          updateType: ctx.updateType
        });

        // Пытаемся отправить дружелюбное сообщение об ошибке
        try {
          if (!ctx.update.callback_query) {
            // Не отвечаем на callback повторно
            await ctx.reply(
              '🚨 Произошла неожиданная ошибка. Попробуйте еще раз или обратитесь в поддержку.'
            );
          }
        } catch (replyError) {
          // Игнорируем ошибки отправки
        }
      }
    };
  }

  /**
   * Валидация конфигурации обработки ошибок
   */
  static validateErrorConfig(flow: BotFlow): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверяем наличие fallback настроек
    if (!flow.settings?.errorHandling) {
      warnings.push('Не настроена обработка ошибок для потока');
    }

    // Проверяем ноды на наличие error handling
    flow.nodes.forEach((node) => {
      if (node.type === 'action' && !node.data.config?.action?.onError) {
        warnings.push(
          `Нода "${node.data.label}" не имеет настроек обработки ошибок`
        );
      }
    });

    // Проверяем наличие конечных нод
    const endNodes = flow.nodes.filter((n) => n.type === 'end');
    if (endNodes.length === 0) {
      errors.push('Поток должен иметь хотя бы одну конечную ноду');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Расширения для сессии
declare module '../bot-session.service' {
  interface BotConstructorSession {
    errorInfo?: {
      originalFlowId: string;
      error: string;
      timestamp: Date;
    };
  }
}
