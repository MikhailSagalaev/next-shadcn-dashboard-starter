/**
 * @file: src/lib/services/order.service.ts
 * @description: Сервис для работы с заказами
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  CreateOrderInput,
  UpdateOrderInput,
  ChangeOrderStatusInput,
  OrderWithRelations,
  OrderFilters,
  OrderListResponse,
  OrderStatus,
  CreateProductInput,
  UpdateProductInput,
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from '@/types/orders';
import { UserService } from './user.service';

export class OrderService {
  /**
   * Создание нового заказа
   */
  static async createOrder(data: CreateOrderInput): Promise<OrderWithRelations> {
    try {
      // Генерируем номер заказа, если не указан
      let orderNumber = data.orderNumber;
      if (!orderNumber) {
        orderNumber = await this.generateOrderNumber(data.projectId);
      }

      // Проверяем, что номер заказа уникален
      const existingOrder = await db.order.findUnique({
        where: { orderNumber },
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
          status: data.status || 'PENDING',
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount || 0,
          bonusAmount: data.bonusAmount || 0,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
          deliveryMethod: data.deliveryMethod,
          metadata: data.metadata,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              metadata: item.metadata,
            })),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          history: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Создаем первую запись в истории
      await db.orderHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          comment: 'Заказ создан',
          metadata: { source: 'system' },
        },
      });

      // Обновляем статистику пользователя, если заказ связан с пользователем
      if (data.userId && data.totalAmount > 0) {
        await db.user.update({
          where: { id: data.userId },
          data: {
            totalPurchases: {
              increment: data.totalAmount,
            },
          },
        });
      }

      logger.info('Создан новый заказ', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        projectId: data.projectId,
        userId: data.userId,
        totalAmount: data.totalAmount,
        component: 'order-service',
      });

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Ошибка создания заказа', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          projectId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          history: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return order as OrderWithRelations | null;
    } catch (error) {
      logger.error('Ошибка получения заказа', {
        orderId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          projectId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          history: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return order as OrderWithRelations | null;
    } catch (error) {
      logger.error('Ошибка получения заказа по номеру', {
        orderNumber,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
        sortOrder = 'desc',
      } = filters;

      const where: any = {
        projectId,
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
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
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
                lastName: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
            history: {
              take: 1,
              orderBy: {
                createdAt: 'desc',
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.order.count({ where }),
      ]);

      return {
        orders: orders as OrderWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      logger.error('Ошибка получения списка заказов', {
        filters,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          projectId,
        },
      });

      if (!existingOrder) {
        throw new Error('Заказ не найден');
      }

      const order = await db.order.update({
        where: { id: orderId },
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          history: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      logger.info('Заказ обновлен', {
        orderId: order.id,
        projectId,
        changes: Object.keys(data),
        component: 'order-service',
      });

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Ошибка обновления заказа', {
        orderId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
      // Проверяем, что заказ существует и принадлежит проекту
      const existingOrder = await db.order.findFirst({
        where: {
          id: orderId,
          projectId,
        },
      });

      if (!existingOrder) {
        throw new Error('Заказ не найден');
      }

      // Обновляем статус заказа
      const order = await db.order.update({
        where: { id: orderId },
        data: {
          status: data.status,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          history: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Создаем запись в истории
      await db.orderHistory.create({
        data: {
          orderId: order.id,
          status: data.status,
          comment: data.comment,
          changedBy: data.changedBy,
          metadata: data.metadata,
        },
      });

      logger.info('Статус заказа изменен', {
        orderId: order.id,
        projectId,
        oldStatus: existingOrder.status,
        newStatus: data.status,
        component: 'order-service',
      });

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Ошибка изменения статуса заказа', {
        orderId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          createdAt: 'desc',
        },
      });

      return history;
    } catch (error) {
      logger.error('Ошибка получения истории заказа', {
        orderId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          projectId,
        },
      });

      if (!existingOrder) {
        throw new Error('Заказ не найден');
      }

      // Мягкое удаление через изменение статуса на CANCELLED
      await this.changeOrderStatus(projectId, orderId, {
        status: 'CANCELLED',
        comment: 'Заказ удален',
        changedBy: 'system',
      });

      logger.info('Заказ удален', {
        orderId,
        projectId,
        component: 'order-service',
      });
    } catch (error) {
      logger.error('Ошибка удаления заказа', {
        orderId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          metadata: data.metadata,
        },
        include: {
          category: true,
          project: true,
        },
      });

      logger.info('Товар создан', {
        productId: product.id,
        projectId: data.projectId,
        component: 'order-service',
      });

      return product;
    } catch (error) {
      logger.error('Ошибка создания товара', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
      const product = await db.product.update({
        where: { id: productId },
        data,
        include: {
          category: true,
          project: true,
        },
      });

      logger.info('Товар обновлен', {
        productId: product.id,
        projectId,
        component: 'order-service',
      });

      return product;
    } catch (error) {
      logger.error('Ошибка обновления товара', {
        productId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
          metadata: data.metadata,
        },
        include: {
          parent: true,
          children: true,
          project: true,
        },
      });

      logger.info('Категория товаров создана', {
        categoryId: category.id,
        projectId: data.projectId,
        component: 'order-service',
      });

      return category;
    } catch (error) {
      logger.error('Ошибка создания категории товаров', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
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
      const category = await db.productCategory.update({
        where: { id: categoryId },
        data,
        include: {
          parent: true,
          children: true,
          project: true,
        },
      });

      logger.info('Категория товаров обновлена', {
        categoryId: category.id,
        projectId,
        component: 'order-service',
      });

      return category;
    } catch (error) {
      logger.error('Ошибка обновления категории товаров', {
        categoryId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'order-service',
      });
      throw error;
    }
  }
}

