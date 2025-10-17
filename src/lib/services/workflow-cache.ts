/**
 * @file: workflow-cache.ts
 * @description: Кэш для workflow данных
 * @project: SaaS Bonus System
 * @dependencies: None
 * @created: 2025-01-17
 * @author: AI Assistant
 */

/**
 * Простой кэш для workflow данных
 */
class WorkflowCache {
  private cache = new Map<string, any>();
  private ttl = new Map<string, number>();

  /**
   * Сохранить данные в кэш
   */
  set(key: string, value: any, ttlMs: number = 300000): void {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttlMs);
  }

  /**
   * Получить данные из кэша
   */
  get(key: string): any | null {
    const expiry = this.ttl.get(key);
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  /**
   * Удалить данные из кэша
   */
  delete(key: string): boolean {
    this.ttl.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Очистить весь кэш
   */
  clearAll(): void {
    this.cache.clear();
    this.ttl.clear();
  }

  /**
   * Получить размер кэша
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Проверить наличие ключа в кэше
   */
  has(key: string): boolean {
    const expiry = this.ttl.get(key);
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return false;
    }
    return this.cache.has(key);
  }
}

// Экспортируем singleton instance
export const workflowCache = new WorkflowCache();
