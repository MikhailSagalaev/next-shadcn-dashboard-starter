/**
 * @file: src/lib/services/order.service.ts
 * @description: Сервис для работы с заказами
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  CreateOrderInput,
  UpdateOrderInput,
  ChangeOrderStatusInput,
  OrderWithRelations,
  OrderFilters,
  OrderListResponse,
  CreateProductInput,
  UpdateProductInput,
  CreateProductCategoryInput,
  UpdateProductCategoryInput
} from '@/types/orders';
import {
  OrderAccountingConflictError,
  OrderAccountingService
} from './orders/order-accounting.service';

function toInputJson(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonObject | undefined;
}

export class OrderService {
  /**
   * Создание нового заказа
   */
  static async createOrder(
    data: CreateOrderInput
  ): Promise<OrderWithRelations> {
    try {
      if (data.userId) {
        const user = await db.user.findFirst({
          where: { id: data.userId, projectId: data.projectId },
          select: { id: true }
        });
        if (!user)
          throw new Error('Пользователь не принадлежит проекту заказа');
      }

      const productIds = data.items
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id));
      if (productIds.length > 0) {
        const products = await db.product.findMany({
          where: { id: { in: productIds }, projectId: data.projectId },
          select: { id: true }
        });
        if (products.length !== new Set(productIds).size) {
          throw new Error('Товар не принадлежит проекту заказа');
        }
      }

      const calculatedItemsTotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );
      const declaredItemsTotal = data.items.reduce(
        (sum, item) => sum + item.total,
        0
      );
      if (
        Math.abs(calculatedItemsTotal - declaredItemsTotal) > 0.01 ||
        Math.abs(data.totalAmount - declaredItemsTotal) > 0.01
      ) {
        throw new Error('Сумма заказа не соответствует составу товаров');
      }

      // Генерируем номер заказа, если не указан
      let orderNumber = data.orderNumber;
      if (!orderNumber) {
        orderNumber = await this.generateOrderNumber(data.projectId);
      }

      // Проверяем, что номер заказа уникален
      const existingOrder = await db.order.findUnique({
        where: { orderNumber }
      });

      if (existingOrder) {
        throw new Error(`Заказ с номером ${orderNumber} уже существует`);
      }

      // Создаем заказ с товарами
      const order = await db.order.create({
        data: {
          projectId: data.projectId,
          userId: data.userId,
          orderNumber,
          status: 'PENDING',
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount || 0,
          bonusAmount: data.bonusAmount || 0,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
          deliveryMethod: data.deliveryMethod,
          metadata: toInputJson(data.metadata),
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              metadata: toInputJson(item.metadata)
            }))
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true
            }
          },
          items: {
            include: {
              product: true,
              markedUnits: {
                select: {
                  id: true,
                  gtin: true,
                  serial: true,
                  status: true,
                  scannedBy: true,
                  scannedAt: true
                },
                orderBy: { scannedAt: 'desc' }
              }
            }
          },
          fiscalReceipts: {
            select: {
              id: true,
              type: true,
              status: true,
              providerReceiptId: true,
              lastError: true,
              createdAt: true,
              succeededAt: true
            },
            orderBy: { createdAt: 'desc' }
          },
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Создаем первую запись в истории
      await db.orderHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          comment: 'Заказ создан',
          metadata: { source: 'system' }
        }
      });

      if (data.status && data.status !== 'PENDING') {
        return this.changeOrderStatus(data.projectId, order.id, {
          status: data.status,
          comment: 'Статус указан при создании заказа',
          changedBy: 'system'
        });
      }

      logger.info('Создан новый заказ', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        projectId: data.projectId,
        userId: data.userId,
        totalAmount: data.totalAmount,
        component: 'order-service'
      });

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Ошибка создания заказа', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Генерация уникального номера заказа
   */
  static async generateOrderNumber(projectId: string): Promise<string> {
    const prefix = `ORD-${projectId.slice(0, 8).toUpperCase()}-`;
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}-${random}`;
  }

  /**
   * Получение заказа по ID
   */
  static async getOrderById(
    projectId: string,
    orderId: string
  ): Promise<OrderWithRelations | null> {
    try {
      const order = await db.order.findFirst({
        where: {
          id: orderId,
          projectId
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true
            }
          },
          items: {
            include: {
              product: true
            }
          },
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return order as OrderWithRelations | null;
    } catch (error) {
      logger.error('Ошибка получения заказа', {
        orderId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Получение заказа по номеру
   */
  static async getOrderByNumber(
    projectId: string,
    orderNumber: string
  ): Promise<OrderWithRelations | null> {
    try {
      const order = await db.order.findFirst({
        where: {
          orderNumber,
          projectId
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true
            }
          },
          items: {
            include: {
              product: true
            }
          },
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return order as OrderWithRelations | null;
    } catch (error) {
      logger.error('Ошибка получения заказа по номеру', {
        orderNumber,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Получение списка заказов с фильтрацией
   */
  static async getOrders(filters: OrderFilters): Promise<OrderListResponse> {
    try {
      const {
        projectId,
        userId,
        status,
        startDate,
        endDate,
        search,
        page = 1,
        pageSize = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const where: any = {
        projectId
      };

      if (userId) {
        where.userId = userId;
      }

      if (status) {
        if (Array.isArray(status)) {
          where.status = { in: status };
        } else {
          where.status = status;
        }
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { deliveryAddress: { contains: search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        ];
      }

      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true
              }
            },
            items: {
              include: {
                product: true
              }
            },
            history: {
              take: 1,
              orderBy: {
                createdAt: 'desc'
              }
            },
            project: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            [sortBy]: sortOrder
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        db.order.count({ where })
      ]);

      return {
        orders: orders as OrderWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('Ошибка получения списка заказов', {
        filters,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Обновление заказа
   */
  static async updateOrder(
    projectId: string,
    orderId: string,
    data: UpdateOrderInput
  ): Promise<OrderWithRelations> {
    try {
      // Проверяем, что заказ существует и принадлежит проекту
      const existingOrder = await db.order.findFirst({
        where: {
          id: orderId,
          projectId
        }
      });

      if (!existingOrder) {
        throw new Error('Заказ не найден');
      }

      if ('status' in data) {
        throw new OrderAccountingConflictError(
          'Статус можно изменить только через status endpoint'
        );
      }

      const changesEconomicFields =
        data.totalAmount !== undefined ||
        data.paidAmount !== undefined ||
        data.bonusAmount !== undefined;
      const accountingLockedStates = new Set([
        'APPLIED',
        'REVERSING',
        'REVERSED',
        'PARTIALLY_REVERSED'
      ]);
      if (
        changesEconomicFields &&
        accountingLockedStates.has(existingOrder.accountingState)
      ) {
        throw new OrderAccountingConflictError(
          'Экономические поля учтенного заказа изменять нельзя'
        );
      }

      const updateData: Prisma.OrderUncheckedUpdateInput = {
        ...data,
        metadata: toInputJson(data.metadata)
      };
      const order = await db.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true
            }
          },
          items: {
            include: {
              product: true
            }
          },
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logger.info('Заказ обновлен', {
        orderId: order.id,
        projectId,
        changes: Object.keys(data),
        component: 'order-service'
      });

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Ошибка обновления заказа', {
        orderId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Изменение статуса заказа
   */
  static async changeOrderStatus(
    projectId: string,
    orderId: string,
    data: ChangeOrderStatusInput
  ): Promise<OrderWithRelations> {
    try {
      if (data.status === 'SHIPPED' || data.status === 'DELIVERED') {
        const readiness = await db.order.findFirst({
          where: { id: orderId, projectId },
          select: {
            markingState: true,
            fiscalState: true,
            paymentStatus: true
          }
        });
        if (!readiness) throw new Error('Заказ не найден');
        if (readiness.paymentStatus !== 'PAID') {
          throw new OrderAccountingConflictError(
            'Нельзя отправить неоплаченный заказ'
          );
        }
        if (!['COMPLETE', 'NOT_REQUIRED'].includes(readiness.markingState)) {
          throw new OrderAccountingConflictError(
            'Не завершена маркировка заказа'
          );
        }
        if (readiness.fiscalState !== 'SETTLED') {
          throw new OrderAccountingConflictError(
            'Закрывающий чек ещё не зарегистрирован'
          );
        }
      }
      const order = await OrderAccountingService.transition(
        projectId,
        orderId,
        {
          status: data.status,
          comment: data.comment,
          changedBy: data.changedBy
        }
      );
      const fulfillmentByStatus = {
        PROCESSING: 'PICKING',
        SHIPPED: 'SHIPPED',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
        REFUNDED: 'RETURNED'
      } as const;
      const fulfillmentState =
        fulfillmentByStatus[data.status as keyof typeof fulfillmentByStatus];
      if (fulfillmentState) {
        await db.order.update({
          where: { id: order.id },
          data: { fulfillmentState }
        });
        order.fulfillmentState = fulfillmentState;
      }

      logger.info('Статус заказа изменен', {
        orderId: order.id,
        projectId,
        newStatus: data.status,
        accountingState: order.accountingState,
        component: 'order-service'
      });
      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Ошибка изменения статуса заказа', {
        orderId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Получение истории заказа
   */
  static async getOrderHistory(orderId: string) {
    try {
      const history = await db.orderHistory.findMany({
        where: { orderId },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return history;
    } catch (error) {
      logger.error('Ошибка получения истории заказа', {
        orderId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Удаление заказа (мягкое удаление через статус)
   */
  static async deleteOrder(projectId: string, orderId: string): Promise<void> {
    try {
      // Проверяем, что заказ существует и принадлежит проекту
      const existingOrder = await db.order.findFirst({
        where: {
          id: orderId,
          projectId
        }
      });

      if (!existingOrder) {
        throw new Error('Заказ не найден');
      }

      // Мягкое удаление через изменение статуса на CANCELLED
      await this.changeOrderStatus(projectId, orderId, {
        status: 'CANCELLED',
        comment: 'Заказ удален',
        changedBy: 'system'
      });

      logger.info('Заказ удален', {
        orderId,
        projectId,
        component: 'order-service'
      });
    } catch (error) {
      logger.error('Ошибка удаления заказа', {
        orderId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Создание товара
   */
  static async createProduct(data: CreateProductInput) {
    try {
      const product = await db.product.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          sku: data.sku,
          price: data.price,
          categoryId: data.categoryId,
          description: data.description,
          isActive: data.isActive ?? true,
          metadata: toInputJson(data.metadata)
        },
        include: {
          category: true,
          project: true
        }
      });

      logger.info('Товар создан', {
        productId: product.id,
        projectId: data.projectId,
        component: 'order-service'
      });

      return product;
    } catch (error) {
      logger.error('Ошибка создания товара', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Обновление товара
   */
  static async updateProduct(
    projectId: string,
    productId: string,
    data: UpdateProductInput
  ) {
    try {
      const updateData: Prisma.ProductUncheckedUpdateInput = {
        ...data,
        metadata: toInputJson(data.metadata)
      };
      const product = await db.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          category: true,
          project: true
        }
      });

      logger.info('Товар обновлен', {
        productId: product.id,
        projectId,
        component: 'order-service'
      });

      return product;
    } catch (error) {
      logger.error('Ошибка обновления товара', {
        productId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Создание категории товаров
   */
  static async createProductCategory(data: CreateProductCategoryInput) {
    try {
      const category = await db.productCategory.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          description: data.description,
          parentId: data.parentId,
          sortOrder: data.sortOrder ?? 0,
          isActive: data.isActive ?? true,
          metadata: toInputJson(data.metadata)
        },
        include: {
          parent: true,
          children: true,
          project: true
        }
      });

      logger.info('Категория товаров создана', {
        categoryId: category.id,
        projectId: data.projectId,
        component: 'order-service'
      });

      return category;
    } catch (error) {
      logger.error('Ошибка создания категории товаров', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }

  /**
   * Обновление категории товаров
   */
  static async updateProductCategory(
    projectId: string,
    categoryId: string,
    data: UpdateProductCategoryInput
  ) {
    try {
      const updateData: Prisma.ProductCategoryUncheckedUpdateInput = {
        ...data,
        metadata: toInputJson(data.metadata)
      };
      const category = await db.productCategory.update({
        where: { id: categoryId },
        data: updateData,
        include: {
          parent: true,
          children: true,
          project: true
        }
      });

      logger.info('Категория товаров обновлена', {
        categoryId: category.id,
        projectId,
        component: 'order-service'
      });

      return category;
    } catch (error) {
      logger.error('Ошибка обновления категории товаров', {
        categoryId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service'
      });
      throw error;
    }
  }
}
