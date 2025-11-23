/**
 * @file: src/lib/queues/retailcrm-sync.queue.ts
 * @description: Bull очередь для синхронизации данных с RetailCRM
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import Bull from 'bull';
import { logger } from '@/lib/logger';
import { RetailCrmClientService } from '@/lib/services/retailcrm-client.service';
import { OrderService } from '@/lib/services/order.service';
import { UserService } from '@/lib/services/user.service';
import { db } from '@/lib/db';
import { OrderStatus } from '@prisma/client';

// Конфигурация Redis для очереди синхронизации
const getRedisConfig = () => {
  if (process.env.REDIS_HOST) {
    return {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };
  }

  return {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  };
};

// Типы задач в очереди синхронизации
export interface RetailCrmSyncJobData {
  type: 'sync_orders' | 'sync_customers' | 'sync_order' | 'sync_customer';
  projectId: string;
  orderId?: string;
  customerId?: string;
  retailCrmOrderId?: number;
  retailCrmCustomerId?: number;
  sinceId?: number;
}

// Создаем очередь для синхронизации
export const retailCrmSyncQueue = new Bull<RetailCrmSyncJobData>(
  'retailcrm-sync',
  getRedisConfig()
);

// Обработчик задач синхронизации
retailCrmSyncQueue.process(async (job: Bull.Job<RetailCrmSyncJobData>) => {
  const {
    type,
    projectId,
    orderId,
    customerId,
    retailCrmOrderId,
    retailCrmCustomerId,
    sinceId
  } = job.data;

  try {
    logger.info('Processing RetailCRM sync job', {
      jobId: job.id,
      type,
      projectId,
      component: 'retailcrm-sync-queue'
    });

    const client = await RetailCrmClientService.create(projectId);

    switch (type) {
      case 'sync_orders':
        await syncOrders(client, projectId, sinceId);
        break;

      case 'sync_customers':
        await syncCustomers(client, projectId, sinceId);
        break;

      case 'sync_order':
        if (retailCrmOrderId) {
          await syncSingleOrder(client, projectId, retailCrmOrderId);
        }
        break;

      case 'sync_customer':
        if (retailCrmCustomerId) {
          await syncSingleCustomer(client, projectId, retailCrmCustomerId);
        }
        break;

      default:
        throw new Error(`Неизвестный тип синхронизации: ${type}`);
    }

    // Обновляем время последней синхронизации
    await db.retailCrmIntegration.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date()
      }
    });

    logger.info('RetailCRM sync job completed', {
      jobId: job.id,
      type,
      projectId,
      component: 'retailcrm-sync-queue'
    });
  } catch (error) {
    logger.error('Error processing RetailCRM sync job', {
      jobId: job.id,
      type,
      projectId,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'retailcrm-sync-queue'
    });
    throw error;
  }
});

// Синхронизация заказов
async function syncOrders(
  client: RetailCrmClientService,
  projectId: string,
  sinceId?: number
) {
  const orders = await client.getOrders({ sinceId, limit: 100 });

  for (const retailCrmOrder of orders) {
    try {
      // Ищем пользователя по email или телефону
      let userId: string | undefined;
      if (retailCrmOrder.customer) {
        const user = await UserService.findUserByContact(
          projectId,
          retailCrmOrder.customer.email,
          retailCrmOrder.customer.phone
        );
        if (user) {
          userId = user.id;
        }
      }

      // Проверяем, существует ли заказ
      const existingOrder = await db.order.findFirst({
        where: {
          projectId,
          orderNumber: retailCrmOrder.number
        }
      });

      if (existingOrder) {
        // Обновляем существующий заказ
        await OrderService.updateOrder(projectId, existingOrder.id, {
          status: mapRetailCrmStatusToOrderStatus(retailCrmOrder.status),
          totalAmount: retailCrmOrder.totalSumm
        });
      } else {
        // Создаем новый заказ
        await OrderService.createOrder({
          projectId,
          userId,
          orderNumber: retailCrmOrder.number,
          status: mapRetailCrmStatusToOrderStatus(retailCrmOrder.status),
          totalAmount: retailCrmOrder.totalSumm,
          items: retailCrmOrder.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
          })),
          metadata: {
            retailCrmOrderId: retailCrmOrder.id,
            retailCrmData: retailCrmOrder
          }
        });
      }
    } catch (error) {
      logger.error('Error syncing order from RetailCRM', {
        projectId,
        retailCrmOrderId: retailCrmOrder.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-sync-queue'
      });
    }
  }
}

// Синхронизация клиентов
async function syncCustomers(
  client: RetailCrmClientService,
  projectId: string,
  sinceId?: number
) {
  const customers = await client.getCustomers({ sinceId, limit: 100 });

  for (const retailCrmCustomer of customers) {
    try {
      // Ищем пользователя по email или телефону
      const existingUser = await UserService.findUserByContact(
        projectId,
        retailCrmCustomer.email,
        retailCrmCustomer.phone
      );

      if (!existingUser) {
        // Создаем нового пользователя
        await UserService.createUser({
          projectId,
          email: retailCrmCustomer.email,
          phone: retailCrmCustomer.phone,
          firstName: retailCrmCustomer.firstName,
          lastName: retailCrmCustomer.lastName
        });
      } else {
        // Обновляем существующего пользователя
        await db.user.update({
          where: { id: existingUser.id },
          data: {
            email: retailCrmCustomer.email || existingUser.email,
            phone: retailCrmCustomer.phone || existingUser.phone,
            firstName: retailCrmCustomer.firstName || existingUser.firstName,
            lastName: retailCrmCustomer.lastName || existingUser.lastName
          }
        });
      }
    } catch (error) {
      logger.error('Error syncing customer from RetailCRM', {
        projectId,
        retailCrmCustomerId: retailCrmCustomer.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-sync-queue'
      });
    }
  }
}

// Синхронизация одного заказа
async function syncSingleOrder(
  client: RetailCrmClientService,
  projectId: string,
  retailCrmOrderId: number
) {
  const orders = await client.getOrders({ limit: 1 });
  const order = orders.find((o) => o.id === retailCrmOrderId);

  if (order) {
    await syncOrders(client, projectId);
  }
}

// Синхронизация одного клиента
async function syncSingleCustomer(
  client: RetailCrmClientService,
  projectId: string,
  retailCrmCustomerId: number
) {
  const customers = await client.getCustomers({ limit: 1 });
  const customer = customers.find((c) => c.id === retailCrmCustomerId);

  if (customer) {
    await syncCustomers(client, projectId);
  }
}

// Маппинг статусов RetailCRM в статусы заказов системы
function mapRetailCrmStatusToOrderStatus(retailCrmStatus: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    new: OrderStatus.PENDING,
    acceptance: OrderStatus.CONFIRMED,
    assembling: OrderStatus.PROCESSING,
    delivery: OrderStatus.SHIPPED,
    complete: OrderStatus.DELIVERED,
    cancel: OrderStatus.CANCELLED,
    refund: OrderStatus.REFUNDED
  };

  const normalized = retailCrmStatus?.toLowerCase();
  return statusMap[normalized] ?? OrderStatus.PENDING;
}

// Обработка ошибок
retailCrmSyncQueue.on('failed', (job, error) => {
  logger.error('RetailCRM sync job failed', {
    jobId: job?.id,
    error: error.message,
    component: 'retailcrm-sync-queue'
  });
});

// Обработка завершения
retailCrmSyncQueue.on('completed', (job) => {
  logger.info('RetailCRM sync job completed', {
    jobId: job.id,
    component: 'retailcrm-sync-queue'
  });
});
