/**
 * @file: src/lib/services/analytics.service.ts
 * @description: Базовый сервис аналитики с вычислением KPI
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { CacheService } from '@/lib/redis';

export interface KPIMetrics {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  totalUsers: number;
  activeUsers: number;
  conversionRate: number;
}

export interface PeriodFilter {
  startDate: Date;
  endDate: Date;
}

export interface AnalyticsFilters {
  projectId: string;
  startDate?: Date;
  endDate?: Date;
}

export class AnalyticsService {
  /**
   * Вычисление KPI для проекта
   */
  static async calculateKPI(filters: AnalyticsFilters): Promise<KPIMetrics> {
    try {
      const { projectId, startDate, endDate } = filters;

      // Кэш ключ
      const cacheKey = `analytics:kpi:${projectId}:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'all'}`;

      // Пытаемся получить из кэша
      const cached = await CacheService.get<KPIMetrics>(cacheKey);
      if (cached) {
        return cached;
      }

      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.lte = endDate;
        }
      }

      // Выручка (сумма всех оплаченных заказов)
      const revenueResult = await db.order.aggregate({
        where: {
          projectId,
          status: {
            in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
          },
          ...dateFilter,
        },
        _sum: {
          totalAmount: true,
        },
      });

      const revenue = Number(revenueResult._sum.totalAmount || 0);

      // Количество заказов
      const orderCount = await db.order.count({
        where: {
          projectId,
          ...dateFilter,
        },
      });

      // Средний чек
      const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      // Общее количество пользователей
      const totalUsers = await db.user.count({
        where: {
          projectId,
          ...(startDate || endDate
            ? {
                registeredAt: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
      });

      // Активные пользователи (с заказами)
      const activeUsers = await db.user.count({
        where: {
          projectId,
          orders: {
            some: {
              ...dateFilter,
            },
          },
        },
      });

      // Конверсия (пользователи с заказами / общее количество пользователей)
      const conversionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      const result = {
        revenue,
        orderCount,
        averageOrderValue,
        totalUsers,
        activeUsers,
        conversionRate,
      };

      // Кэшируем результат на 5 минут
      await CacheService.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      logger.error('Ошибка вычисления KPI', {
        filters,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Регистрация события аналитики
   */
  static async trackEvent(
    projectId: string,
    eventType: string,
    data?: Record<string, any>,
    userId?: string,
    orderId?: string
  ): Promise<void> {
    try {
      await db.analyticsEvent.create({
        data: {
          projectId,
          eventType,
          userId,
          orderId,
          data,
        },
      });
    } catch (error) {
      logger.error('Ошибка регистрации события аналитики', {
        projectId,
        eventType,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      // Не бросаем ошибку, чтобы не прерывать основной процесс
    }
  }

  /**
   * Сохранение метрики
   */
  static async saveMetric(
    projectId: string,
    metricType: string,
    period: 'day' | 'week' | 'month' | 'year',
    value: number,
    date: Date,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await db.analyticsMetric.upsert({
        where: {
          projectId_metricType_period_date: {
            projectId,
            metricType,
            period,
            date,
          },
        },
        create: {
          projectId,
          metricType,
          period,
          value,
          date,
          metadata,
        },
        update: {
          value,
          metadata,
        },
      });
    } catch (error) {
      logger.error('Ошибка сохранения метрики', {
        projectId,
        metricType,
        period,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Получение метрик за период
   */
  static async getMetrics(
    projectId: string,
    metricType: string,
    period: 'day' | 'week' | 'month' | 'year',
    startDate: Date,
    endDate: Date
  ) {
    try {
      const metrics = await db.analyticsMetric.findMany({
        where: {
          projectId,
          metricType,
          period,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      return metrics;
    } catch (error) {
      logger.error('Ошибка получения метрик', {
        projectId,
        metricType,
        period,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Вычисление выручки за период
   */
  static async getRevenue(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      // Кэш ключ
      const cacheKey = `analytics:revenue:${projectId}:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'all'}`;

      // Пытаемся получить из кэша
      const cached = await CacheService.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.lte = endDate;
        }
      }

      const result = await db.order.aggregate({
        where: {
          projectId,
          status: {
            in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
          },
          ...dateFilter,
        },
        _sum: {
          totalAmount: true,
        },
      });

      const revenue = Number(result._sum.totalAmount || 0);

      // Кэшируем результат на 5 минут
      await CacheService.set(cacheKey, revenue, 300);

      return revenue;
    } catch (error) {
      logger.error('Ошибка вычисления выручки', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Вычисление количества заказов за период
   */
  static async getOrderCount(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.lte = endDate;
        }
      }

      return await db.order.count({
        where: {
          projectId,
          ...dateFilter,
        },
      });
    } catch (error) {
      logger.error('Ошибка вычисления количества заказов', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Вычисление среднего чека
   */
  static async getAverageOrderValue(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      const revenue = await this.getRevenue(projectId, startDate, endDate);
      const orderCount = await this.getOrderCount(projectId, startDate, endDate);

      return orderCount > 0 ? revenue / orderCount : 0;
    } catch (error) {
      logger.error('Ошибка вычисления среднего чека', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Воронка продаж
   */
  static async getSalesFunnel(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    views: number;
    carts: number;
    checkouts: number;
    purchases: number;
    conversionRates: {
      viewToCart: number;
      cartToCheckout: number;
      checkoutToPurchase: number;
      viewToPurchase: number;
    };
  }> {
    try {
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.lte = endDate;
        }
      }

      // Получаем данные о событиях аналитики
      const events = await db.analyticsEvent.findMany({
        where: {
          projectId,
          eventType: {
            in: ['page_view', 'add_to_cart', 'checkout_started', 'purchase'],
          },
          ...dateFilter,
        },
      });

      const views = events.filter((e) => e.eventType === 'page_view').length;
      const carts = events.filter((e) => e.eventType === 'add_to_cart').length;
      const checkouts = events.filter((e) => e.eventType === 'checkout_started').length;
      const purchases = events.filter((e) => e.eventType === 'purchase').length;

      return {
        views,
        carts,
        checkouts,
        purchases,
        conversionRates: {
          viewToCart: views > 0 ? (carts / views) * 100 : 0,
          cartToCheckout: carts > 0 ? (checkouts / carts) * 100 : 0,
          checkoutToPurchase: checkouts > 0 ? (purchases / checkouts) * 100 : 0,
          viewToPurchase: views > 0 ? (purchases / views) * 100 : 0,
        },
      };
    } catch (error) {
      logger.error('Ошибка вычисления воронки продаж', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * RFM-анализ (Recency, Frequency, Monetary)
   */
  static async getRFMAnalysis(
    projectId: string,
    endDate: Date = new Date()
  ): Promise<{
    segments: Array<{
      segment: string;
      users: number;
      avgRecency: number;
      avgFrequency: number;
      avgMonetary: number;
    }>;
  }> {
    try {
      // Кэш ключ
      const cacheKey = `analytics:rfm:${projectId}:${endDate.toISOString()}`;

      // Пытаемся получить из кэша
      const cached = await CacheService.get<{
        segments: Array<{
          segment: string;
          users: number;
          avgRecency: number;
          avgFrequency: number;
          avgMonetary: number;
        }>;
      }>(cacheKey);
      if (cached) {
        return cached;
      }

      // Оптимизированный запрос: получаем только нужные поля
      const users = await db.user.findMany({
        where: {
          projectId,
          orders: {
            some: {
              status: {
                in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
              },
            },
          },
        },
        select: {
          id: true,
          registeredAt: true,
          orders: {
            where: {
              status: {
                in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
              },
            },
            select: {
              totalAmount: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      const rfmData = users.map((user) => {
        const orders = user.orders || [];
        const lastOrderDate = orders[0]?.createdAt || user.registeredAt;
        const recency = Math.floor(
          (endDate.getTime() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
        ); // Дни
        const frequency = orders.length;
        const monetary = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

        return {
          userId: user.id,
          recency,
          frequency,
          monetary,
        };
      });

      // Сегментация RFM
      const segments = [
        { name: 'Champions', r: [4, 5], f: [4, 5], m: [4, 5] },
        { name: 'Loyal Customers', r: [3, 4, 5], f: [4, 5], m: [3, 4, 5] },
        { name: 'Potential Loyalists', r: [4, 5], f: [2, 3], m: [3, 4, 5] },
        { name: 'New Customers', r: [5], f: [1], m: [1, 2, 3, 4, 5] },
        { name: 'At Risk', r: [2, 3], f: [3, 4, 5], m: [3, 4, 5] },
        { name: 'Cannot Lose Them', r: [1, 2], f: [4, 5], m: [4, 5] },
        { name: 'Hibernating', r: [1, 2, 3], f: [1, 2], m: [1, 2, 3] },
      ];

      // Вычисляем R, F, M квантили
      const recencies = rfmData.map((d) => d.recency).sort((a, b) => a - b);
      const frequencies = rfmData.map((d) => d.frequency).sort((a, b) => a - b);
      const monetaries = rfmData.map((d) => d.monetary).sort((a, b) => a - b);

      const getQuantile = (arr: number[], q: number): number => {
        const index = Math.floor(arr.length * q);
        return arr[index] || 0;
      };

      const rQuartiles = [
        getQuantile(recencies, 0.2),
        getQuantile(recencies, 0.4),
        getQuantile(recencies, 0.6),
        getQuantile(recencies, 0.8),
      ];

      const fQuartiles = [
        getQuantile(frequencies, 0.2),
        getQuantile(frequencies, 0.4),
        getQuantile(frequencies, 0.6),
        getQuantile(frequencies, 0.8),
      ];

      const mQuartiles = [
        getQuantile(monetaries, 0.2),
        getQuantile(monetaries, 0.4),
        getQuantile(monetaries, 0.6),
        getQuantile(monetaries, 0.8),
      ];

      const getScore = (value: number, quartiles: number[], reverse: boolean = false): number => {
        if (reverse) {
          if (value <= quartiles[0]) return 5;
          if (value <= quartiles[1]) return 4;
          if (value <= quartiles[2]) return 3;
          if (value <= quartiles[3]) return 2;
          return 1;
        } else {
          if (value >= quartiles[3]) return 5;
          if (value >= quartiles[2]) return 4;
          if (value >= quartiles[1]) return 3;
          if (value >= quartiles[0]) return 2;
          return 1;
        }
      };

      // Классифицируем пользователей
      const segmentCounts: Record<string, { users: number; recency: number; frequency: number; monetary: number }> = {};

      for (const data of rfmData) {
        const r = getScore(data.recency, rQuartiles, true); // Чем меньше recency, тем лучше
        const f = getScore(data.frequency, fQuartiles);
        const m = getScore(data.monetary, mQuartiles);

        // Находим подходящий сегмент
        for (const segment of segments) {
          if (
            segment.r.includes(r) &&
            segment.f.includes(f) &&
            segment.m.includes(m)
          ) {
            if (!segmentCounts[segment.name]) {
              segmentCounts[segment.name] = {
                users: 0,
                recency: 0,
                frequency: 0,
                monetary: 0,
              };
            }
            segmentCounts[segment.name].users++;
            segmentCounts[segment.name].recency += data.recency;
            segmentCounts[segment.name].frequency += data.frequency;
            segmentCounts[segment.name].monetary += data.monetary;
            break;
          }
        }
      }

      // Вычисляем средние значения
      const result = Object.entries(segmentCounts).map(([name, data]) => ({
        segment: name,
        users: data.users,
        avgRecency: data.users > 0 ? data.recency / data.users : 0,
        avgFrequency: data.users > 0 ? data.frequency / data.users : 0,
        avgMonetary: data.users > 0 ? data.monetary / data.users : 0,
      }));

      const response = { segments: result };

      // Кэшируем результат на 10 минут
      await CacheService.set(cacheKey, response, 600);

      return response;
    } catch (error) {
      logger.error('Ошибка RFM-анализа', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * ABC/XYZ-анализ товаров
   */
  static async getABCXYZAnalysis(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    products: Array<{
      productId: string;
      productName: string;
      revenue: number;
      quantity: number;
      abcClass: 'A' | 'B' | 'C';
      xyzClass: 'X' | 'Y' | 'Z';
      category: string;
    }>;
  }> {
    try {
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.lte = endDate;
        }
      }

      // Получаем заказы с товарами
      const orders = await db.order.findMany({
        where: {
          projectId,
          status: {
            in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
          },
          ...dateFilter,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Агрегируем данные по товарам
      const productData: Record<
        string,
        { name: string; revenue: number; quantities: number[]; productId?: string }
      > = {};

      for (const order of orders) {
        for (const item of order.items) {
          const key = item.productId || item.name;
          if (!productData[key]) {
            productData[key] = {
              name: item.name,
              revenue: 0,
              quantities: [],
              productId: item.productId || undefined,
            };
          }
          productData[key].revenue += Number(item.total);
          productData[key].quantities.push(item.quantity);
        }
      }

      // Вычисляем общую выручку
      const totalRevenue = Object.values(productData).reduce(
        (sum, p) => sum + p.revenue,
        0
      );

      // Сортируем по выручке
      const sortedProducts = Object.entries(productData)
        .map(([key, data]) => ({
          key,
          ...data,
          quantity: data.quantities.reduce((sum, q) => sum + q, 0),
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // ABC-анализ (по выручке)
      let cumulativeRevenue = 0;
      const abcProducts = sortedProducts.map((product) => {
        cumulativeRevenue += product.revenue;
        const share = (cumulativeRevenue / totalRevenue) * 100;

        let abcClass: 'A' | 'B' | 'C' = 'C';
        if (share <= 80) {
          abcClass = 'A';
        } else if (share <= 95) {
          abcClass = 'B';
        }

        return {
          ...product,
          abcClass,
          revenueShare: (product.revenue / totalRevenue) * 100,
          cumulativeShare: share,
        };
      });

      // XYZ-анализ (по стабильности продаж)
      // Вычисляем коэффициент вариации для каждого товара
      const xyzProducts = abcProducts.map((product) => {
        const quantities = productData[product.key].quantities;
        const avgQuantity = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
        const variance =
          quantities.reduce((sum, q) => sum + Math.pow(q - avgQuantity, 2), 0) /
          quantities.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = avgQuantity > 0 ? (stdDev / avgQuantity) * 100 : 0;

        let xyzClass: 'X' | 'Y' | 'Z' = 'Z';
        if (coefficientOfVariation <= 10) {
          xyzClass = 'X'; // Стабильный
        } else if (coefficientOfVariation <= 25) {
          xyzClass = 'Y'; // Средняя стабильность
        }

        return {
          productId: product.productId || product.key,
          productName: product.name,
          revenue: product.revenue,
          quantity: product.quantity,
          abcClass: product.abcClass,
          xyzClass,
          category: `${product.abcClass}${xyzClass}`,
        };
      });

      return { products: xyzProducts };
    } catch (error) {
      logger.error('Ошибка ABC/XYZ-анализа', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }

  /**
   * Анализ динамики продаж по периодам
   */
  static async getSalesTrends(
    projectId: string,
    period: 'day' | 'week' | 'month' = 'day',
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    period: string;
    revenue: number;
    orderCount: number;
    averageOrderValue: number;
  }>> {
    try {
      const orders = await db.order.findMany({
        where: {
          projectId,
          status: {
            in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
          },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Группируем по периодам
      const periodData: Record<string, { revenue: number; count: number }> = {};

      for (const order of orders) {
        const orderDate = new Date(order.createdAt);
        let periodKey: string;

        switch (period) {
          case 'day':
            periodKey = orderDate.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(orderDate);
            weekStart.setDate(orderDate.getDate() - orderDate.getDay());
            periodKey = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            periodKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            periodKey = orderDate.toISOString().split('T')[0];
        }

        if (!periodData[periodKey]) {
          periodData[periodKey] = { revenue: 0, count: 0 };
        }

        periodData[periodKey].revenue += Number(order.totalAmount);
        periodData[periodKey].count++;
      }

      // Преобразуем в массив и сортируем
      const trends = Object.entries(periodData)
        .map(([period, data]) => ({
          period,
          revenue: data.revenue,
          orderCount: data.count,
          averageOrderValue: data.count > 0 ? data.revenue / data.count : 0,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      return trends;
    } catch (error) {
      logger.error('Ошибка анализа динамики продаж', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'analytics-service',
      });
      throw error;
    }
  }
}

