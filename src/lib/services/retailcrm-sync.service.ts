/**
 * @file: src/lib/services/retailcrm-sync.service.ts
 * @description: Сервис синхронизации данных с RetailCRM через очереди Bull
 * @project: SaaS Bonus System
 * @dependencies: Bull Queue, RetailCrmClientService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { retailCrmSyncQueue, type RetailCrmSyncJobData } from '@/lib/queues/retailcrm-sync.queue';
import { db } from '@/lib/db';

export class RetailCrmSyncService {
  /**
   * Запуск синхронизации заказов
   */
  static async syncOrders(projectId: string, sinceId?: number): Promise<void> {
    try {
      // Проверяем, что интеграция активна
      const integration = await db.retailCrmIntegration.findUnique({
        where: { projectId },
      });

      if (!integration || !integration.isActive || !integration.syncOrders) {
        throw new Error('Синхронизация заказов отключена');
      }

      // Добавляем задачу в очередь (если Redis доступен)
      if (retailCrmSyncQueue) {
        await retailCrmSyncQueue.add('sync_orders', {
          type: 'sync_orders',
          projectId,
          sinceId,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });
      } else {
        logger.warn('RetailCRM sync queue not available, skipping sync', {
          projectId,
          component: 'retailcrm-sync-service',
        });
        throw new Error('Очередь синхронизации недоступна (Redis не подключен)');
      }

      logger.info('Запущена синхронизация заказов с RetailCRM', {
        projectId,
        sinceId,
        component: 'retailcrm-sync-service',
      });
    } catch (error) {
      logger.error('Ошибка запуска синхронизации заказов', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-sync-service',
      });
      throw error;
    }
  }

  /**
   * Запуск синхронизации клиентов
   */
  static async syncCustomers(projectId: string, sinceId?: number): Promise<void> {
    try {
      // Проверяем, что интеграция активна
      const integration = await db.retailCrmIntegration.findUnique({
        where: { projectId },
      });

      if (!integration || !integration.isActive || !integration.syncCustomers) {
        throw new Error('Синхронизация клиентов отключена');
      }

      // Добавляем задачу в очередь (если Redis доступен)
      if (retailCrmSyncQueue) {
        await retailCrmSyncQueue.add('sync_customers', {
          type: 'sync_customers',
          projectId,
          sinceId,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });
      } else {
        logger.warn('RetailCRM sync queue not available, skipping sync', {
          projectId,
          component: 'retailcrm-sync-service',
        });
        throw new Error('Очередь синхронизации недоступна (Redis не подключен)');
      }

      logger.info('Запущена синхронизация клиентов с RetailCRM', {
        projectId,
        sinceId,
        component: 'retailcrm-sync-service',
      });
    } catch (error) {
      logger.error('Ошибка запуска синхронизации клиентов', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-sync-service',
      });
      throw error;
    }
  }

  /**
   * Полная синхронизация (заказы + клиенты)
   */
  static async syncAll(projectId: string): Promise<void> {
    try {
      await Promise.all([
        this.syncOrders(projectId),
        this.syncCustomers(projectId),
      ]);
    } catch (error) {
      logger.error('Ошибка полной синхронизации с RetailCRM', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-sync-service',
      });
      throw error;
    }
  }

  /**
   * Периодическая синхронизация (вызывается по расписанию)
   */
  static async schedulePeriodicSync(projectId: string, intervalMinutes: number = 60): Promise<void> {
    try {
      // Добавляем повторяющуюся задачу (если Redis доступен)
      if (retailCrmSyncQueue) {
        await retailCrmSyncQueue.add('sync_orders', {
          type: 'sync_orders',
          projectId,
        }, {
          repeat: {
            every: intervalMinutes * 60 * 1000, // Интервал в миллисекундах
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });

        await retailCrmSyncQueue.add('sync_customers', {
          type: 'sync_customers',
          projectId,
        }, {
          repeat: {
            every: intervalMinutes * 60 * 1000,
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });
      } else {
        logger.warn('RetailCRM sync queue not available, cannot schedule periodic sync', {
          projectId,
          component: 'retailcrm-sync-service',
        });
        throw new Error('Очередь синхронизации недоступна (Redis не подключен)');
      }

      logger.info('Настроена периодическая синхронизация с RetailCRM', {
        projectId,
        intervalMinutes,
        component: 'retailcrm-sync-service',
      });
    } catch (error) {
      logger.error('Ошибка настройки периодической синхронизации', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-sync-service',
      });
      throw error;
    }
  }
}

