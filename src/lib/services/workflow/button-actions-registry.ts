/**
 * @file: src/lib/services/workflow/button-actions-registry.ts
 * @description: Реестр для хранения actions, привязанных к кнопкам
 * @project: SaaS Bonus System
 * @dependencies: ButtonAction
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import type { ButtonAction } from './button-actions-executor';

/**
 * Ключ для идентификации кнопки с actions
 */
interface ButtonActionsKey {
  projectId: string;
  userId: string;
  buttonText: string; // Текст кнопки для идентификации
}

/**
 * Хранимые данные о кнопке
 */
interface StoredButtonActions {
  actions: ButtonAction[];
  createdAt: number;
  expiresAt: number;
}

/**
 * Реестр для временного хранения actions из кнопок
 * 
 * Когда отправляется кнопка с actions, они сохраняются в реестр.
 * Когда приходит событие (например, contact), ищем соответствующие actions и выполняем.
 */
export class ButtonActionsRegistry {
  private static registry = new Map<string, StoredButtonActions>();
  
  // TTL для actions - 5 минут (достаточно, чтобы пользователь нажал кнопку)
  private static TTL_MS = 5 * 60 * 1000;

  /**
   * Сохраняет actions для кнопки
   */
  static register(
    key: ButtonActionsKey,
    actions: ButtonAction[]
  ): void {
    const registryKey = this.makeKey(key);
    const now = Date.now();

    this.registry.set(registryKey, {
      actions,
      createdAt: now,
      expiresAt: now + this.TTL_MS
    });

    logger.debug('📝 Button actions registered', {
      key: registryKey,
      actionsCount: actions.length,
      expiresIn: `${this.TTL_MS / 1000}s`
    });

    // Периодическая очистка устаревших записей
    this.cleanup();
  }

  /**
   * Получает actions для кнопки
   */
  static retrieve(key: ButtonActionsKey): ButtonAction[] | null {
    const registryKey = this.makeKey(key);
    const stored = this.registry.get(registryKey);

    if (!stored) {
      logger.debug('❌ Button actions not found', { key: registryKey });
      return null;
    }

    // Проверяем, не истекло ли время
    if (Date.now() > stored.expiresAt) {
      logger.debug('⏰ Button actions expired', { key: registryKey });
      this.registry.delete(registryKey);
      return null;
    }

    logger.debug('✅ Button actions retrieved', {
      key: registryKey,
      actionsCount: stored.actions.length
    });

    return stored.actions;
  }

  /**
   * Удаляет actions после выполнения
   */
  static remove(key: ButtonActionsKey): void {
    const registryKey = this.makeKey(key);
    this.registry.delete(registryKey);
    logger.debug('🗑️ Button actions removed', { key: registryKey });
  }

  /**
   * Очищает все actions для пользователя
   */
  static clearForUser(projectId: string, userId: string): void {
    let count = 0;
    for (const key of this.registry.keys()) {
      if (key.startsWith(`${projectId}:${userId}:`)) {
        this.registry.delete(key);
        count++;
      }
    }
    logger.debug('🧹 Cleared button actions for user', { projectId, userId, count });
  }

  /**
   * Удаляет устаревшие записи
   */
  private static cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, stored] of this.registry.entries()) {
      if (now > stored.expiresAt) {
        this.registry.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('🧹 Cleaned up expired button actions', { removed });
    }
  }

  /**
   * Создаёт строковый ключ из объекта
   */
  private static makeKey(key: ButtonActionsKey): string {
    return `${key.projectId}:${key.userId}:${key.buttonText}`;
  }

  /**
   * Получает статистику реестра
   */
  static getStats(): { total: number; expired: number } {
    const now = Date.now();
    let expired = 0;

    for (const stored of this.registry.values()) {
      if (now > stored.expiresAt) {
        expired++;
      }
    }

    return {
      total: this.registry.size,
      expired
    };
  }
}

export default ButtonActionsRegistry;

