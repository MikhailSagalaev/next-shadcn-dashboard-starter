/**
 * @file: src/lib/services/workflow/variable-manager.ts
 * @description: Менеджер переменных с поддержкой scopes
 * @project: SaaS Bonus System
 * @dependencies: Prisma, ExecutionContext
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import type { VariableManager as IVariableManager, VariableScope } from '@/types/workflow';

/**
 * Реализация менеджера переменных
 */
export class VariableManager implements IVariableManager {
  private projectId: string;
  private workflowId?: string;
  private userId?: string;
  private sessionId?: string;

  constructor(
    projectId: string,
    workflowId?: string,
    userId?: string,
    sessionId?: string
  ) {
    this.projectId = projectId;
    this.workflowId = workflowId;
    this.userId = userId;
    this.sessionId = sessionId;
  }

  /**
   * Получить значение переменной (синхронная версия для выражений)
   */
  getSync(name: string, scope: VariableScope = 'session'): any {
    // Для синхронной версии возвращаем кэшированное значение или undefined
    // В реальной реализации здесь может быть кэш
    return undefined; // Пока возвращаем undefined для безопасности
  }

  /**
   * Получает значение переменной
   */
  async get(name: string, scope: VariableScope = 'session'): Promise<any> {
    try {
      const variable = await db.workflowVariable.findFirst({
        where: this.buildWhereClause(name, scope),
        orderBy: { createdAt: 'desc' } // Берем самую свежую
      });

      if (!variable) {
        return undefined;
      }

      // Проверяем срок действия
      if (variable.expiresAt && new Date() > variable.expiresAt) {
        // Удаляем просроченную переменную
        await this.delete(name, scope);
        return undefined;
      }

      return variable.value;

    } catch (error) {
      console.error('Failed to get variable:', { name, scope, error });
      return undefined;
    }
  }

  /**
   * Устанавливает значение переменной
   */
  async set(name: string, value: any, scope: VariableScope = 'session', ttl?: number): Promise<void> {
    try {
      const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;
      
      // Преобразуем BigInt в строки для сериализации
      const serializedValue = this.serializeValue(value);

      // Используем upsert для создания или обновления
      // Проверяем существует ли переменная
      const existing = await db.workflowVariable.findFirst({
        where: {
          projectId: this.projectId,
          workflowId: this.workflowId || undefined,
          userId: this.userId || undefined,
          sessionId: this.sessionId || undefined,
          scope,
          key: name
        }
      });

      if (existing) {
        // Обновляем существующую
        await db.workflowVariable.update({
          where: { id: existing.id },
          data: {
            value: serializedValue,
            expiresAt,
            updatedAt: new Date()
          }
        });
      } else {
        // Создаем новую
        await db.workflowVariable.create({
          data: {
            projectId: this.projectId,
            workflowId: this.workflowId || null,
            userId: this.userId || null,
            sessionId: this.sessionId || null,
            scope,
            key: name,
            value: serializedValue,
            expiresAt
          }
        });
      }

    } catch (error) {
      console.error('Failed to set variable:', { name, scope, value, error });
      throw error;
    }
  }

  /**
   * Проверяет существование переменной
   */
  async has(name: string, scope: VariableScope = 'session'): Promise<boolean> {
    try {
      const count = await db.workflowVariable.count({
        where: this.buildWhereClause(name, scope)
      });

      return count > 0;

    } catch (error) {
      console.error('Failed to check variable existence:', { name, scope, error });
      return false;
    }
  }

  /**
   * Удаляет переменную
   */
  async delete(name: string, scope: VariableScope = 'session'): Promise<void> {
    try {
      await db.workflowVariable.deleteMany({
        where: this.buildWhereClause(name, scope)
      });

    } catch (error) {
      console.error('Failed to delete variable:', { name, scope, error });
      // Не бросаем ошибку, так как удаление может быть не критичным
    }
  }

  /**
   * Получает все переменные для scope
   */
  async list(scope: VariableScope = 'session'): Promise<Record<string, any>> {
    try {
      const variables = await db.workflowVariable.findMany({
        where: {
          projectId: this.projectId,
          workflowId: scope === 'project' ? this.workflowId : undefined,
          userId: scope === 'user' ? this.userId : undefined,
          sessionId: scope === 'session' ? this.sessionId : undefined,
          scope,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      // Преобразуем в объект
      const result: Record<string, any> = {};
      for (const variable of variables) {
        result[variable.key] = variable.value;
      }

      return result;

    } catch (error) {
      console.error('Failed to list variables:', { scope, error });
      return {};
    }
  }

  /**
   * Очищает просроченные переменные
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await db.workflowVariable.deleteMany({
        where: {
          projectId: this.projectId,
          expiresAt: { lt: new Date() }
        }
      });

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} expired variables`);
      }

      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired variables:', error);
      return 0;
    }
  }

  /**
   * Сериализует значение, преобразуя BigInt в строки и фильтруя несериализуемые объекты
   */
  private serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Пропускаем функции
    if (typeof value === 'function') {
      return undefined;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Обрабатываем Date объекты
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map(item => this.serializeValue(item)).filter(item => item !== undefined);
    }

    if (typeof value === 'object') {
      // Проверяем, является ли это Prisma объектом с внутренними полями
      if (value.constructor && value.constructor.name && value.constructor.name.includes('Prisma')) {
        // Создаем чистый объект только с данными
        const serialized: any = {};
        for (const [key, val] of Object.entries(value)) {
          // Пропускаем служебные поля Prisma
          if (key.startsWith('_') || key === 'constructor' || typeof val === 'function') {
            continue;
          }
          const serializedVal = this.serializeValue(val);
          if (serializedVal !== undefined) {
            serialized[key] = serializedVal;
          }
        }
        return serialized;
      }

      // Обычные объекты
      const serialized: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Пропускаем служебные поля
        if (key === 'constructor' || typeof val === 'function') {
          continue;
        }
        const serializedVal = this.serializeValue(val);
        if (serializedVal !== undefined) {
          serialized[key] = serializedVal;
        }
      }
      return serialized;
    }

    return value;
  }

  /**
   * Строит where clause для запросов
   */
  private buildWhereClause(name: string, scope: VariableScope) {
    return {
      projectId: this.projectId,
      workflowId: scope === 'project' ? this.workflowId : undefined, // project scope связан с workflow
      userId: scope === 'user' ? this.userId : undefined,
      sessionId: scope === 'session' ? this.sessionId : undefined,
      scope,
      key: name,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };
  }
}

/**
 * Фабрика для создания VariableManager
 */
export function createVariableManager(
  projectId: string,
  workflowId?: string,
  userId?: string,
  sessionId?: string
): VariableManager {
  return new VariableManager(projectId, workflowId, userId, sessionId);
}
