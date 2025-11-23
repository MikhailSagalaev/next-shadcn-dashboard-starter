/**
 * @file: src/lib/services/segmentation.service.ts
 * @description: Сервис для работы с сегментацией пользователей
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import type { SegmentType, Segment, SegmentMember } from '@prisma/client';

export interface SegmentRule {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'greater_than'
    | 'less_than'
    | 'in'
    | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
  conditions?: SegmentRule[];
}

export interface CreateSegmentInput {
  projectId: string;
  name: string;
  description?: string;
  rules: SegmentRule | SegmentRule[];
  type?: SegmentType;
  isActive?: boolean;
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string;
  rules?: SegmentRule | SegmentRule[];
  type?: SegmentType;
  isActive?: boolean;
}

export interface SegmentWithMembers extends Segment {
  members: (SegmentMember & {
    user: {
      id: string;
      email?: string | null;
      phone?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    };
  })[];
  _count?: {
    members: number;
  };
}

export class SegmentationService {
  /**
   * Создание нового сегмента
   */
  static async createSegment(data: CreateSegmentInput): Promise<Segment> {
    try {
      const segment = await db.segment.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          description: data.description,
          rules: this.serializeRules(data.rules),
          type: data.type || 'MANUAL',
          isActive: data.isActive ?? true,
          memberCount: 0
        }
      });

      logger.info('Создан новый сегмент', {
        segmentId: segment.id,
        projectId: data.projectId,
        type: segment.type,
        component: 'segmentation-service'
      });

      return segment;
    } catch (error) {
      logger.error('Ошибка создания сегмента', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Обновление сегмента
   */
  static async updateSegment(
    projectId: string,
    segmentId: string,
    data: UpdateSegmentInput
  ): Promise<Segment> {
    try {
      const segment = await db.segment.update({
        where: { id: segmentId },
        data: {
          ...data,
          rules: data.rules ? this.serializeRules(data.rules) : undefined
        }
      });

      // Если правила изменились, пересчитываем участников
      if (data.rules && segment.type !== 'MANUAL') {
        await this.recalculateSegment(projectId, segmentId);
      }

      logger.info('Сегмент обновлен', {
        segmentId: segment.id,
        projectId,
        component: 'segmentation-service'
      });

      return segment;
    } catch (error) {
      logger.error('Ошибка обновления сегмента', {
        segmentId,
        projectId,
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Получение сегмента с участниками
   */
  static async getSegment(
    projectId: string,
    segmentId: string
  ): Promise<SegmentWithMembers | null> {
    try {
      const segment = await db.segment.findFirst({
        where: {
          id: segmentId,
          projectId
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          _count: {
            select: {
              members: true
            }
          }
        }
      });

      return segment as SegmentWithMembers | null;
    } catch (error) {
      logger.error('Ошибка получения сегмента', {
        segmentId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Получение списка сегментов
   */
  static async getSegments(projectId: string, isActive?: boolean) {
    try {
      const segments = await db.segment.findMany({
        where: {
          projectId,
          ...(isActive !== undefined ? { isActive } : {})
        },
        include: {
          _count: {
            select: {
              members: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return segments;
    } catch (error) {
      logger.error('Ошибка получения списка сегментов', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Получение списка сегментов с пагинацией и фильтрами
   */
  static async getProjectSegments(
    projectId: string,
    filters?: {
      page?: number;
      pageSize?: number;
      type?: 'MANUAL' | 'AUTO' | 'DYNAMIC';
      isActive?: boolean;
      search?: string;
    }
  ) {
    try {
      const page = filters?.page || 1;
      const pageSize = filters?.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: any = {
        projectId
      };

      if (filters?.type) {
        where.type = filters.type;
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const [segments, total] = await Promise.all([
        db.segment.findMany({
          where,
          include: {
            _count: {
              select: {
                members: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: pageSize
        }),
        db.segment.count({ where })
      ]);

      return {
        segments,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      logger.error('Ошибка получения списка сегментов', {
        projectId,
        filters,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Проверка соответствия пользователя условиям сегмента
   */
  static async evaluateUser(
    projectId: string,
    userId: string,
    rules: SegmentRule | SegmentRule[],
    userData?: any // Опциональный параметр для передачи уже загруженных данных пользователя
  ): Promise<boolean> {
    try {
      // Если данные пользователя уже переданы, используем их (оптимизация для batch обработки)
      let user = userData;

      if (!user) {
        // Получаем данные пользователя только если они не переданы
        user = await db.user.findFirst({
          where: {
            id: userId,
            projectId
          },
          include: {
            orders: {
              select: {
                totalAmount: true,
                status: true,
                createdAt: true
              }
            },
            bonuses: {
              select: {
                amount: true,
                isUsed: true
              }
            },
            transactions: {
              select: {
                amount: true,
                type: true
              }
            }
          }
        });
      }

      if (!user) {
        return false;
      }

      // Вычисляем агрегированные данные (используем данные из userData или загруженные)
      const orders = user.orders || [];
      const bonuses = user.bonuses || [];
      const transactions = user.transactions || [];

      const totalPurchases = orders
        .filter((o) =>
          ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)
        )
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      const activeBonuses = bonuses
        .filter((b) => !b.isUsed)
        .reduce((sum, b) => sum + Number(b.amount), 0);

      const totalEarned = transactions
        .filter((t) => t.type === 'EARN')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalSpent = transactions
        .filter((t) => t.type === 'SPEND')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Создаем контекст для оценки
      const context = {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          totalPurchases: user.totalPurchases || totalPurchases,
          activeBonuses,
          totalEarned,
          totalSpent,
          registeredAt: user.registeredAt,
          currentLevel: user.currentLevel
        },
        orders: {
          count: orders.length,
          totalAmount: totalPurchases
        },
        bonuses: {
          active: activeBonuses
        }
      };

      // Оцениваем правила
      const rulesArray = Array.isArray(rules) ? rules : [rules];
      return this.evaluateRules(rulesArray, context);
    } catch (error) {
      logger.error('Ошибка оценки пользователя', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      return false;
    }
  }

  /**
   * Рекурсивная оценка правил
   */
  private static evaluateRules(
    rules: SegmentRule[],
    context: any,
    logicalOperator: 'AND' | 'OR' = 'AND'
  ): boolean {
    if (rules.length === 0) {
      return true;
    }

    const results = rules.map((rule) => {
      if (rule.conditions && rule.conditions.length > 0) {
        // Рекурсивная оценка вложенных условий
        return this.evaluateRules(
          rule.conditions,
          context,
          rule.logicalOperator || 'AND'
        );
      }

      // Оценка одного правила
      return this.evaluateRule(rule, context);
    });

    // Применяем логический оператор
    if (logicalOperator === 'OR') {
      return results.some((r) => r);
    } else {
      return results.every((r) => r);
    }
  }

  /**
   * Оценка одного правила
   */
  private static evaluateRule(rule: SegmentRule, context: any): boolean {
    const { field, operator, value } = rule;

    // Получаем значение поля из контекста
    const fieldValue = this.getFieldValue(context, field);

    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    // Применяем оператор
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue)
          .toLowerCase()
          .includes(String(value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Получение значения поля из контекста (поддержка вложенных полей)
   */
  private static getFieldValue(context: any, field: string): any {
    const parts = field.split('.');
    let value = context;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Пересчет участников сегмента
   */
  static async recalculateSegment(
    projectId: string,
    segmentId: string
  ): Promise<void> {
    try {
      const segment = await db.segment.findFirst({
        where: {
          id: segmentId,
          projectId
        }
      });

      if (!segment || segment.type === 'MANUAL') {
        return;
      }

      // Оптимизированный запрос: получаем всех пользователей с нужными данными сразу (исправление N+1)
      const users = await db.user.findMany({
        where: {
          projectId
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          registeredAt: true,
          totalPurchases: true,
          currentLevel: true,
          orders: {
            select: {
              totalAmount: true,
              status: true,
              createdAt: true
            }
          },
          bonuses: {
            select: {
              amount: true,
              isUsed: true
            }
          },
          transactions: {
            select: {
              amount: true,
              type: true
            }
          }
        }
      });

      // Оцениваем каждого пользователя (передаем уже загруженные данные для оптимизации)
      const matchingUserIds: string[] = [];

      const segmentRules = this.parseSegmentRules(segment.rules);

      for (const user of users) {
        const matches = await this.evaluateUser(
          projectId,
          user.id,
          segmentRules,
          user // Передаем уже загруженные данные для избежания N+1 проблем
        );

        if (matches) {
          matchingUserIds.push(user.id);
        }
      }

      // Удаляем старых участников
      await db.segmentMember.deleteMany({
        where: {
          segmentId
        }
      });

      // Добавляем новых участников
      if (matchingUserIds.length > 0) {
        await db.segmentMember.createMany({
          data: matchingUserIds.map((userId) => ({
            segmentId,
            userId
          })),
          skipDuplicates: true
        });
      }

      // Обновляем счетчик участников
      await db.segment.update({
        where: { id: segmentId },
        data: {
          memberCount: matchingUserIds.length
        }
      });

      logger.info('Сегмент пересчитан', {
        segmentId,
        projectId,
        memberCount: matchingUserIds.length,
        component: 'segmentation-service'
      });
    } catch (error) {
      logger.error('Ошибка пересчета сегмента', {
        segmentId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Добавление пользователя в сегмент вручную
   */
  static async addMember(
    segmentId: string,
    userId: string
  ): Promise<SegmentMember> {
    try {
      const member = await db.segmentMember.create({
        data: {
          segmentId,
          userId
        }
      });

      // Обновляем счетчик участников
      await db.segment.update({
        where: { id: segmentId },
        data: {
          memberCount: {
            increment: 1
          }
        }
      });

      return member;
    } catch (error) {
      logger.error('Ошибка добавления участника в сегмент', {
        segmentId,
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Удаление пользователя из сегмента
   */
  static async removeMember(segmentId: string, userId: string): Promise<void> {
    try {
      await db.segmentMember.deleteMany({
        where: {
          segmentId,
          userId
        }
      });

      // Обновляем счетчик участников
      await db.segment.update({
        where: { id: segmentId },
        data: {
          memberCount: {
            decrement: 1
          }
        }
      });
    } catch (error) {
      logger.error('Ошибка удаления участника из сегмента', {
        segmentId,
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Удаление сегмента
   */
  static async deleteSegment(
    projectId: string,
    segmentId: string
  ): Promise<void> {
    try {
      await db.segment.delete({
        where: {
          id: segmentId,
          projectId
        }
      });

      logger.info('Сегмент удален', {
        segmentId,
        projectId,
        component: 'segmentation-service'
      });
    } catch (error) {
      logger.error('Ошибка удаления сегмента', {
        segmentId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Получение участников сегмента
   */
  static async getSegmentMembers(projectId: string, segmentId: string) {
    try {
      // Проверяем, что сегмент принадлежит проекту
      const segment = await db.segment.findFirst({
        where: {
          id: segmentId,
          projectId
        }
      });

      if (!segment) {
        throw new Error('Сегмент не найден');
      }

      const members = await db.segmentMember.findMany({
        where: {
          segmentId
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
          }
        },
        orderBy: {
          addedAt: 'desc'
        }
      });

      return members;
    } catch (error) {
      logger.error('Ошибка получения участников сегмента', {
        segmentId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Добавление участника в сегмент (обертка для addMember с проверкой проекта)
   */
  static async addMemberToSegment(
    projectId: string,
    segmentId: string,
    userId: string
  ): Promise<void> {
    try {
      // Проверяем, что сегмент принадлежит проекту
      const segment = await db.segment.findFirst({
        where: {
          id: segmentId,
          projectId
        }
      });

      if (!segment) {
        throw new Error('Сегмент не найден');
      }

      // Проверяем, что пользователь принадлежит проекту
      const user = await db.user.findFirst({
        where: {
          id: userId,
          projectId
        }
      });

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      await this.addMember(segmentId, userId);
    } catch (error) {
      logger.error('Ошибка добавления участника в сегмент', {
        segmentId,
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Удаление участника из сегмента (обертка для removeMember с проверкой проекта)
   */
  static async removeMemberFromSegment(
    projectId: string,
    segmentId: string,
    userId: string
  ): Promise<void> {
    try {
      // Проверяем, что сегмент принадлежит проекту
      const segment = await db.segment.findFirst({
        where: {
          id: segmentId,
          projectId
        }
      });

      if (!segment) {
        throw new Error('Сегмент не найден');
      }

      await this.removeMember(segmentId, userId);
    } catch (error) {
      logger.error('Ошибка удаления участника из сегмента', {
        segmentId,
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  /**
   * Оценка сегмента (поиск всех пользователей, соответствующих условиям)
   */
  static async evaluateSegment(
    projectId: string,
    segmentId: string
  ): Promise<string[]> {
    try {
      const segment = await db.segment.findFirst({
        where: {
          id: segmentId,
          projectId
        }
      });

      if (!segment || segment.type === 'MANUAL') {
        return [];
      }

      // Оптимизированный запрос: получаем всех пользователей с нужными данными сразу (исправление N+1)
      const users = await db.user.findMany({
        where: {
          projectId
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          registeredAt: true,
          totalPurchases: true,
          currentLevel: true,
          orders: {
            select: {
              totalAmount: true,
              status: true,
              createdAt: true
            }
          },
          bonuses: {
            select: {
              amount: true,
              isUsed: true
            }
          },
          transactions: {
            select: {
              amount: true,
              type: true
            }
          }
        }
      });

      // Оцениваем каждого пользователя (передаем уже загруженные данные для оптимизации)
      const matchingUserIds: string[] = [];

      const segmentRules = this.parseSegmentRules(segment.rules);

      for (const user of users) {
        const matches = await this.evaluateUser(
          projectId,
          user.id,
          segmentRules,
          user // Передаем уже загруженные данные для избежания N+1 проблем
        );

        if (matches) {
          matchingUserIds.push(user.id);
        }
      }

      return matchingUserIds;
    } catch (error) {
      logger.error('Ошибка оценки сегмента', {
        segmentId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'segmentation-service'
      });
      throw error;
    }
  }

  private static serializeRules(
    rules: SegmentRule | SegmentRule[]
  ): Prisma.InputJsonValue {
    return (Array.isArray(rules)
      ? rules
      : [rules]) as unknown as Prisma.InputJsonValue;
  }

  private static parseSegmentRules(
    rules: Prisma.JsonValue | null
  ): SegmentRule[] {
    if (!rules) {
      return [];
    }

    if (Array.isArray(rules)) {
      return rules as unknown as SegmentRule[];
    }

    return [rules as unknown as SegmentRule];
  }
}
