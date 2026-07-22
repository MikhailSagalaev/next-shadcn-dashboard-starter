import type { Order } from '@prisma/client';
import { db } from '@/lib/db';
import { NormalizedOrder } from '../integration/tilda-parser.service';
import { UserService } from '@/lib/services/user.service';
import { OrderAccountingService } from './order-accounting.service';
import { splitFullName } from '@/lib/user-display';
import { logger } from '@/lib/logger';
import { AdminNotificationService } from '@/lib/services/admin-notification.service';

export interface OrderProcessingResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export class OrderProcessingService {
  private static isCashPayment(order: NormalizedOrder): boolean {
    const paymentSystem = String(order.raw?.payment?.sys ?? '')
      .trim()
      .toLocaleLowerCase('ru-RU');
    return paymentSystem === 'наличные';
  }

  static async processOrder(
    projectId: string,
    order: NormalizedOrder
  ): Promise<OrderProcessingResult> {
    logger.info('Processing Order', { projectId, orderId: order.orderId });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    });
    if (!project) throw new Error('Project not found');

    const isCashPayment = this.isCashPayment(order);
    let savedOrder = order.orderId
      ? await db.order.findFirst({
          where: { projectId, orderNumber: order.orderId }
        })
      : null;

    if (savedOrder?.accountingState === 'APPLIED') {
      logger.info('Order already accounted, skipping', {
        projectId,
        orderId: order.orderId,
        existingOrderId: savedOrder.id,
        component: 'order-processing'
      });
      return {
        success: true,
        message: 'Order already processed',
        data: {
          spent: Number(savedOrder.accountedSpentBonusAmount),
          earned: 0,
          userId: savedOrder.userId,
          orderId: savedOrder.id,
          userCreated: false,
          signupForm: false
        }
      };
    }

    if (!savedOrder) {
      savedOrder = await this.saveOrder(projectId, order, isCashPayment);
    }

    // Find or create the user before any accounting effects are applied.
    let user = await UserService.findUserByContact(
      projectId,
      order.email,
      order.phone
    );
    const userAlreadyExisted = Boolean(user);
    const isSignupForm =
      order.isSignupForm ??
      (order.amount <= 0 && (!order.products || order.products.length === 0));

    // Handle Email/Phone Conflict
    // If we found a user by phone, but they provided a DIFFERENT email:
    if (
      user &&
      order.email &&
      user.email &&
      user.email.toLowerCase() !== order.email.toLowerCase()
    ) {
      // Check if the NEW email is taken
      const emailOwner = await db.user.findFirst({
        where: {
          projectId,
          email: { equals: order.email, mode: 'insensitive' }
        }
      });

      if (emailOwner && emailOwner.id !== user.id) {
        logger.warn('Email conflict detected', {
          existingUserId: user.id,
          emailOwnerId: emailOwner.id,
          conflictEmail: order.email
        });
        // We DO NOT update user email to avoid account takeover/merging confusion
        // We proceed with the user found by phone (assuming phone is primary identifier)
      } else {
        // Safe to update email
        user = (await db.user.update({
          where: { id: user.id },
          data: { email: order.email },
          include: { project: true, bonuses: true, transactions: true }
        })) as unknown as typeof user;
      }
    }

    if (!user) {
      const { firstName, lastName } = splitFullName(order.name);
      user = await UserService.createUser({
        projectId,
        email: order.email || '',
        phone: order.phone || '',
        firstName,
        lastName,
        utmSource: order.utmSource || '',
        utmOrg: order.utmOrg
      });
    } else if (isSignupForm) {
      if (order.name?.trim() && !user.firstName?.trim()) {
        const { firstName, lastName } = splitFullName(order.name);
        user = (await db.user.update({
          where: { id: user.id },
          data: { firstName, lastName },
          include: { project: true, bonuses: true, transactions: true }
        })) as unknown as typeof user;
      }

      if (order.utmSource) {
        const linkResult = await UserService.linkReferralFromAttribution({
          userId: user.id,
          projectId,
          utmRef: order.utmSource,
          utmOrg: order.utmOrg
        });
        if (linkResult.linked) {
          user = (await db.user.findFirst({
            where: { id: user.id, projectId },
            include: { project: true, bonuses: true, transactions: true }
          })) as unknown as typeof user;
        }
      }
    }

    // Link first; accounting refuses unlinked orders.
    await db.order.update({
      where: { id: savedOrder.id },
      data: { userId: user.id }
    });

    let accountedOrder = await db.order.findUniqueOrThrow({
      where: { id: savedOrder.id }
    });
    if (!isCashPayment) {
      accountedOrder = await OrderAccountingService.transition(
        projectId,
        savedOrder.id,
        {
          status: 'CONFIRMED',
          comment: 'Автоматическое подтверждение оплаченного заказа',
          changedBy: 'system'
        }
      );
    }

    const purchaseBonus = !isCashPayment
      ? await db.bonus.findUnique({
          where: { externalId: `tilda_order_${order.orderId}` },
          select: { amount: true }
        })
      : null;
    const spentAmount = Number(accountedOrder.accountedSpentBonusAmount);
    const earnedBonusAmount = Number(purchaseBonus?.amount ?? 0);

    return {
      success: true,
      message: userAlreadyExisted
        ? isSignupForm
          ? order.utmSource
            ? 'Пользователь уже существует — проверена привязка по реферальной ссылке'
            : 'Пользователь с таким email или телефоном уже зарегистрирован — новая запись не создана'
          : 'Order processed'
        : isSignupForm
          ? 'Пользователь зарегистрирован'
          : 'Order processed',
      data: {
        spent: spentAmount,
        earned: earnedBonusAmount,
        userId: user.id,
        orderId: savedOrder?.id,
        userCreated: !userAlreadyExisted,
        signupForm: isSignupForm
      }
    };
  }

  /**
   * Save order and products to database for analytics
   */
  private static async saveOrder(
    projectId: string,
    order: NormalizedOrder,
    isCashPayment: boolean
  ): Promise<Order> {
    try {
      // Create Order with full metadata
      const savedOrder = await db.order.create({
        data: {
          projectId,
          orderNumber: order.orderId,
          externalOrderId: order.externalOrderId,
          paymentProvider: order.paymentSystem || null,
          providerPaymentId: order.providerTransactionId || null,
          paymentStatus: isCashPayment ? 'UNPAID' : 'PAID',
          paidAt: isCashPayment ? null : new Date(),
          status: 'PENDING',
          totalAmount: order.amount,
          paidAmount: isCashPayment ? 0 : order.amount,
          bonusAmount: 0,
          paymentMethod: order.raw?.payment?.sys || 'unknown',
          deliveryMethod: order.raw?.payment?.delivery || null,
          deliveryAddress: order.raw?.payment?.delivery_address || null,
          metadata: {
            // Основные данные
            promocode: order.promocode,
            utmSource: order.utmSource,
            requestedBonusAmount: order.appliedBonuses,
            cashPending: isCashPayment,

            // Данные клиента
            customerName: order.name,
            customerEmail: order.email,
            customerPhone: order.phone,

            // Данные доставки
            deliveryFio: order.raw?.payment?.delivery_fio,
            deliveryZip: order.raw?.payment?.delivery_zip,
            deliveryCity: order.raw?.payment?.delivery_city,
            deliveryComment: order.raw?.payment?.delivery_comment,
            deliveryPrice: order.raw?.payment?.delivery_price,

            // Данные оплаты
            paymentSystem: order.raw?.payment?.sys,
            paymentTransactionId: order.raw?.payment?.systranid,
            subtotal: order.raw?.payment?.subtotal,

            // UTM метки
            utmCampaign: order.raw?.utm_campaign,
            utmMedium: order.raw?.utm_medium,
            utmContent: order.raw?.utm_content,
            utmTerm: order.raw?.utm_term,
            utmRef: order.raw?.utm_ref,

            // Cookies и дополнительные данные
            cookies: order.raw?.COOKIES,
            formId: order.raw?.formid,
            formName: order.raw?.formname,
            maId: order.raw?.ma_id,

            // Полные raw данные для полной истории
            raw: order.raw
          }
        }
      });

      // Create Order Items and Products
      if (order.products && order.products.length > 0) {
        for (const product of order.products) {
          // Tilda payloads are not uniform: some delivery/form variants send
          // `title` or SKU but omit `name`. Prisma requires a non-null name.
          const productName =
            String(
              product.name ??
                product.title ??
                product.product_name ??
                product.sku ??
                'Товар из заказа'
            ).trim() || 'Товар из заказа';

          // Find or create product
          let dbProduct = null;
          const externalId = String(
            product.externalid ?? product.externalId ?? ''
          ).trim();
          const sku = String(product.sku ?? '').trim();
          if (externalId || sku) {
            dbProduct = externalId
              ? await db.product.findFirst({
                  where: { projectId, externalId }
                })
              : null;
            if (!dbProduct && sku) {
              dbProduct = await db.product.findFirst({
                where: { projectId, sku }
              });
            }

            if (!dbProduct) {
              // Создаем товар со всеми данными включая изображения
              dbProduct = await db.product.create({
                data: {
                  projectId,
                  name: productName,
                  sku: sku || null,
                  externalId: externalId || null,
                  price: product.price,
                  metadata: {
                    // Изображение товара
                    image: product.img,

                    // Опции товара (вес, размер и т.д.)
                    options: product.options,

                    // External ID из Tilda
                    externalId: externalId || undefined,

                    // Все остальные данные
                    ...product
                  }
                }
              });
            } else {
              // Tilda remains the source for commercial catalog fields. Fiscal
              // attributes (GTIN, VAT, marking status) stay managed in Gupil.
              dbProduct = await db.product.update({
                where: { id: dbProduct.id },
                data: {
                  name: productName,
                  price: product.price,
                  externalId: dbProduct.externalId || externalId || null,
                  metadata: {
                    ...(dbProduct.metadata as unknown as Record<
                      string,
                      unknown
                    >),
                    image: product.img ?? dbProduct.metadata?.image,
                    options: product.options,
                    externalId: externalId || undefined
                  }
                }
              });
            }
          }

          // Create order item with full product data
          await db.orderItem.create({
            data: {
              orderId: savedOrder.id,
              productId: dbProduct?.id,
              name: productName,
              sku: sku || null,
              externalProductId: externalId || null,
              gtin: dbProduct?.gtin ?? null,
              markingStatus: dbProduct?.markingStatus ?? 'UNKNOWN',
              vatCode: dbProduct?.vatCode ?? null,
              paymentSubject: dbProduct?.paymentSubject ?? null,
              measure: dbProduct?.measure ?? 'piece',
              quantity: product.quantity || 1,
              price: product.price,
              total: product.amount || product.price * (product.quantity || 1),
              metadata: {
                // Изображение товара
                image: product.img,

                // SKU
                sku: product.sku,

                // Опции (вес, размер и т.д.)
                options: product.options,

                // External ID
                externalId: product.externalid,

                // Все данные товара
                ...product
              }
            }
          });
        }
      }

      const itemStates = await db.orderItem.findMany({
        where: { orderId: savedOrder.id },
        select: { markingStatus: true }
      });
      const markingState = itemStates.some(
        (item) => item.markingStatus === 'UNKNOWN'
      )
        ? 'UNCONFIGURED'
        : itemStates.some((item) => item.markingStatus === 'MARKED_REQUIRED')
          ? 'PENDING'
          : 'NOT_REQUIRED';
      await db.order.update({
        where: { id: savedOrder.id },
        data: { markingState }
      });

      // Create analytics event
      await db.analyticsEvent.create({
        data: {
          projectId,
          orderId: savedOrder.id,
          eventType: 'order_created',
          data: {
            amount: order.amount,
            productsCount: order.products.length,
            appliedBonuses: order.appliedBonuses,
            paymentMethod: order.raw?.payment?.sys,
            deliveryMethod: order.raw?.payment?.delivery
          }
        }
      });

      await AdminNotificationService.notifyNewOrder({
        projectId,
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        totalAmount: Number(savedOrder.totalAmount),
        itemsCount: order.products.reduce(
          (sum, product) => sum + (product.quantity || 1),
          0
        ),
        source: 'tilda'
      });

      return savedOrder;
    } catch (error) {
      logger.error('Failed to save order', { error, orderId: order.orderId });
      throw error;
    }
  }
}
