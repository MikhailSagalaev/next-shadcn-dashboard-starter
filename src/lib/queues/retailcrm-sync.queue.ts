/**
 * @file: src/lib/queues/retailcrm-sync.queue.ts
 * @description: Bull очередь для синхронизации данных с RetailCRM
 * @project: SaaS Bonus System
 * @dependencies: bull, ioredis
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { Queue, Worker, Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { RetailCrmClientService } from '@/lib/services/retailcrm-client.service';
import { OrderService } from '@/lib/services/order.service';
import { UserService } from '@/lib/services/user.service';
import { db } from '@/lib/db';
import { OrderStatus } from '@prisma/client';
import { createBullMQConnectionOptions } from '@/lib/queues/bullmq-connection';

const queueConnection = createBullMQConnectionOptions('queue');
const workerConnection = createBullMQConnectionOptions('worker');

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

// Создаем очередь для синхронизации (только если Redis доступен)
export const retailCrmSyncQueue = queueConnection
  ? new Queue<RetailCrmSyncJobData>('retailcrm-sync', {
      connection: queueConnection
    })
  : null;

// Worker создается в конце файла

// Проводит внешний статус только по разрешенной цепочке. Это не позволяет
// RetailCRM перепрыгнуть PENDING → DELIVERED и обойти ручку учета экономики.
async function syncOrderStatus(
  projectId: string,
  orderId: string,
  targetStatus: OrderStatus
): Promise<void> {
  const order = await db.order.findFirst({
    where: { id: orderId, projectId },
    select: { status: true, userId: true, accountingState: true }
  });
  if (!order || order.status === targetStatus) return;
  if (
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REFUNDED
  ) {
    return;
  }

  if (targetStatus === OrderStatus.CANCELLED) {
    const terminalStatus =
      order.status === OrderStatus.DELIVERED
        ? OrderStatus.REFUNDED
        : OrderStatus.CANCELLED;
    await OrderService.changeOrderStatus(projectId, orderId, {
      status: terminalStatus,
      comment: 'Синхронизация статуса из RetailCRM',
      changedBy: 'retailcrm-sync'
    });
    return;
  }

  if (targetStatus === OrderStatus.REFUNDED) {
    // Не применяем экономику к заказу, который пришел уже возвращенным.
    const terminalStatus =
      order.status === OrderStatus.PENDING &&
      order.accountingState === 'NOT_APPLIED'
        ? OrderStatus.CANCELLED
        : OrderStatus.REFUNDED;
    await OrderService.changeOrderStatus(projectId, orderId, {
      status: terminalStatus,
      comment: 'Синхронизация возврата из RetailCRM',
      changedBy: 'retailcrm-sync'
    });
    return;
  }

  const forwardStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED
  ];
  const currentIndex = forwardStatuses.indexOf(order.status);
  const targetIndex = forwardStatuses.indexOf(targetStatus);
  if (currentIndex < 0 || targetIndex <= currentIndex) return;

  if (!order.userId && order.status === OrderStatus.PENDING) {
    logger.warn('RetailCRM order cannot be accounted without a linked user', {
      projectId,
      orderId,
      targetStatus,
      component: 'retailcrm-sync-queue'
    });
    return;
  }

  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    await OrderService.changeOrderStatus(projectId, orderId, {
      status: forwardStatuses[index],
      comment: 'Синхронизация статуса из RetailCRM',
      changedBy: 'retailcrm-sync'
    });
  }
}

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

      const nextStatus = mapRetailCrmStatusToOrderStatus(retailCrmOrder.status);
      if (existingOrder) {
        const totalChanged =
          Number(existingOrder.totalAmount) !==
          Number(retailCrmOrder.totalSumm);
        if (
          totalChanged &&
          existingOrder.status === OrderStatus.PENDING &&
          existingOrder.accountingState === 'NOT_APPLIED'
        ) {
          await OrderService.updateOrder(projectId, existingOrder.id, {
            totalAmount: retailCrmOrder.totalSumm
          });
        } else if (totalChanged) {
          logger.warn('RetailCRM total ignored for an accounted order', {
            projectId,
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            localTotal: Number(existingOrder.totalAmount),
            retailCrmTotal: Number(retailCrmOrder.totalSumm),
            accountingState: existingOrder.accountingState,
            component: 'retailcrm-sync-queue'
          });
        }
        await syncOrderStatus(projectId, existingOrder.id, nextStatus);
      } else {
        // Сначала сохраняем PENDING: дальнейшие статусы проходят через
        // централизованный accounting и не могут перепрыгнуть начисления/откат.
        const createdOrder = await OrderService.createOrder({
          projectId,
          userId,
          orderNumber: retailCrmOrder.number,
          status: OrderStatus.PENDING,
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
        await syncOrderStatus(projectId, createdOrder.id, nextStatus);
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

// Ленивая инициализация Worker
let retailCrmSyncWorker: Worker<RetailCrmSyncJobData> | null = null;

export function getRetailCrmSyncWorker(): Worker<RetailCrmSyncJobData> | null {
  if (!workerConnection) {
    logger.warn('RetailCRM sync queue disabled: Redis not available');
    return null;
  }

  if (!retailCrmSyncWorker) {
    retailCrmSyncWorker = new Worker<RetailCrmSyncJobData>(
      'retailcrm-sync',
      async (job: Job<RetailCrmSyncJobData>) => {
        const {
          type,
          projectId,
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
                await syncSingleCustomer(
                  client,
                  projectId,
                  retailCrmCustomerId
                );
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
            error:
              error instanceof Error ? error.message : 'Неизвестная ошибка',
            component: 'retailcrm-sync-queue'
          });
          throw error;
        }
      },
      {
        connection: workerConnection
      }
    );

    // Обработка ошибок
    retailCrmSyncWorker.on('failed', (job, error) => {
      logger.error('RetailCRM sync job failed', {
        jobId: job?.id,
        error: error.message,
        component: 'retailcrm-sync-queue'
      });
    });

    // Обработка завершения
    retailCrmSyncWorker.on('completed', (job) => {
      logger.info('RetailCRM sync job completed', {
        jobId: job.id,
        component: 'retailcrm-sync-queue'
      });
    });
  }

  return retailCrmSyncWorker;
}
