/**
 * @file: src/lib/services/bot-session.service.ts
 * @description: Сервис для интеграции Grammy Sessions с базой данных
 * @project: SaaS Bonus System
 * @dependencies: Grammy, Prisma, BotFlowService
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { session } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import { BotFlowService } from './bot-flow.service';
import { logger } from '@/lib/logger';

// Расширенный интерфейс сессии для конструктора ботов
export interface BotConstructorSession {
  // Grammy session data
  step?: string;
  projectId?: string;
  awaitingContact?: boolean;
  awaitingEmail?: boolean;
  linkingMethod?: 'phone' | 'email';

  // Bot constructor session data
  currentFlowId?: string;
  currentNodeId?: string;
  flowStack?: string[]; // Стек для вложенных потоков
  variables?: Record<string, any>;
  lastActivity?: Date;
  retryCount?: number;
  timeoutAt?: Date;
}

// Контекст с сессией конструктора
export type BotConstructorContext = Context &
  SessionFlavor<BotConstructorSession>;

export class BotSessionService {
  /**
   * Создание middleware для интеграции сессий с базой данных
   */
  static createSessionMiddleware(projectId: string) {
    return session({
      initial: (): BotConstructorSession => ({
        projectId,
        variables: {},
        flowStack: [],
        retryCount: 0,
        lastActivity: new Date()
      }),

      // Кастомное хранилище сессий
      storage: {
        async read(key: string): Promise<BotConstructorSession | undefined> {
          try {
            // Ключ имеет формат: session:<projectId>:<userId>
            const [, projectId, userId] = key.split(':');

            if (!userId) return undefined;

            // Получаем активную сессию потока (если есть)
            const activeSession = await BotFlowService.getSession(
              projectId,
              userId,
              'active'
            );

            if (!activeSession) {
              return {
                projectId,
                variables: {},
                flowStack: [],
                retryCount: 0,
                lastActivity: new Date()
              };
            }

            // Конвертируем данные сессии в формат Grammy
            return {
              projectId,
              currentFlowId: activeSession.flowId,
              currentNodeId: activeSession.state.currentNodeId,
              flowStack: activeSession.state.stack || [],
              variables: activeSession.variables || {},
              lastActivity: activeSession.state.lastActivity,
              retryCount: activeSession.state.retryCount || 0,
              timeoutAt: activeSession.state.timeoutAt
            };
          } catch (error) {
            logger.error('Failed to read session from DB', {
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return undefined;
          }
        },

        async write(
          key: string,
          session: BotConstructorSession
        ): Promise<void> {
          try {
            // Ключ имеет формат: session:<projectId>:<userId>
            const [, projectId, userId] = key.split(':');

            if (!userId || !session.currentFlowId) {
              // Нет активного потока, ничего не сохраняем
              return;
            }

            // Получаем или создаем сессию потока
            let flowSession = await BotFlowService.getSession(
              projectId,
              userId,
              session.currentFlowId
            );

            if (!flowSession) {
              flowSession = await BotFlowService.createSession(
                projectId,
                userId,
                session.currentFlowId,
                {
                  currentNodeId: session.currentNodeId,
                  stack: session.flowStack || [],
                  retryCount: session.retryCount || 0,
                  lastActivity: session.lastActivity || new Date(),
                  timeoutAt: session.timeoutAt
                }
              );
            } else {
              // Обновляем существующую сессию
              await BotFlowService.updateSession(flowSession.id, {
                state: {
                  currentNodeId: session.currentNodeId,
                  stack: session.flowStack || [],
                  retryCount: session.retryCount || 0,
                  lastActivity: session.lastActivity || new Date(),
                  timeoutAt: session.timeoutAt
                },
                variables: session.variables || {}
              });
            }
          } catch (error) {
            logger.error('Failed to write session to DB', {
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },

        async delete(key: string): Promise<void> {
          try {
            // Ключ имеет формат: session:<projectId>:<userId>
            const [, projectId, userId] = key.split(':');

            if (!userId) return;

            // Находим и удаляем все сессии пользователя для проекта
            // В будущем можно оптимизировать для конкретного потока
            const sessions = await this.findUserSessions(projectId, userId);
            for (const session of sessions) {
              await BotFlowService.deleteSession(session.id);
            }
          } catch (error) {
            logger.error('Failed to delete session from DB', {
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    });
  }

  /**
   * Middleware для логирования активности сессии
   */
  static createActivityMiddleware() {
    return async (ctx: BotConstructorContext, next: () => Promise<void>) => {
      // Обновляем время последней активности
      if (ctx.session) {
        ctx.session.lastActivity = new Date();
      }

      await next();
    };
  }

  /**
   * Middleware для обработки таймаутов
   */
  static createTimeoutMiddleware() {
    return async (ctx: BotConstructorContext, next: () => Promise<void>) => {
      if (ctx.session?.timeoutAt && ctx.session.timeoutAt < new Date()) {
        // Сессия истекла, очищаем состояние
        ctx.session.currentFlowId = undefined;
        ctx.session.currentNodeId = undefined;
        ctx.session.flowStack = [];
        ctx.session.timeoutAt = undefined;

        await ctx.reply('⏰ Время ожидания истекло. Начнем заново.');
        return; // Прерываем выполнение
      }

      await next();
    };
  }

  /**
   * Вспомогательные методы для работы с сессиями
   */
  static async startUserFlow(
    ctx: BotConstructorContext,
    flowId: string,
    initialNodeId?: string
  ): Promise<void> {
    if (!ctx.session || !ctx.from?.id) return;

    const userId = ctx.from.id.toString();
    const projectId = ctx.session.projectId;

    if (!projectId) {
      logger.error('No projectId in session', { userId });
      return;
    }

    try {
      // Создаем или получаем сессию потока
      let flowSession = await BotFlowService.getSession(
        projectId,
        userId,
        flowId
      );

      if (!flowSession) {
        flowSession = await BotFlowService.createSession(
          projectId,
          userId,
          flowId,
          {
            currentNodeId: initialNodeId,
            stack: [],
            retryCount: 0,
            lastActivity: new Date()
          }
        );
      }

      // Обновляем Grammy сессию
      ctx.session.currentFlowId = flowId;
      ctx.session.currentNodeId = initialNodeId;
      ctx.session.flowStack = [];
      ctx.session.variables = flowSession.variables || {};

      logger.info('User flow started', {
        projectId,
        userId,
        flowId,
        initialNodeId
      });
    } catch (error) {
      logger.error('Failed to start user flow', {
        projectId,
        userId,
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async endUserFlow(ctx: BotConstructorContext): Promise<void> {
    if (!ctx.session || !ctx.from?.id) return;

    const userId = ctx.from.id.toString();
    const projectId = ctx.session.projectId;
    const flowId = ctx.session.currentFlowId;

    if (!projectId || !flowId) return;

    try {
      // Получаем сессию и удаляем ее
      const flowSession = await BotFlowService.getSession(
        projectId,
        userId,
        flowId
      );
      if (flowSession) {
        await BotFlowService.deleteSession(flowSession.id);
      }

      // Очищаем Grammy сессию
      ctx.session.currentFlowId = undefined;
      ctx.session.currentNodeId = undefined;
      ctx.session.flowStack = [];
      ctx.session.variables = {};

      logger.info('User flow ended', {
        projectId,
        userId,
        flowId
      });
    } catch (error) {
      logger.error('Failed to end user flow', {
        projectId,
        userId,
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async setSessionVariable(
    ctx: BotConstructorContext,
    key: string,
    value: any
  ): Promise<void> {
    if (!ctx.session) return;

    ctx.session.variables = ctx.session.variables || {};
    ctx.session.variables[key] = value;
  }

  static getSessionVariable(ctx: BotConstructorContext, key: string): any {
    return ctx.session?.variables?.[key];
  }

  // Приватные вспомогательные методы
  private static async findUserSessions(projectId: string, userId: string) {
    // В будущем здесь будет логика поиска всех сессий пользователя
    // Пока возвращаем пустой массив
    return [];
  }
}
