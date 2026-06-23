/**
 * @file: admin-notification.service.ts
 * @description: Ядро in-app уведомлений для админов проекта (план 009, core).
 *   Создание/чтение/счётчик уведомлений в колокольчике. Получатель — владелец
 *   проекта (Project.ownerId → AdminAccount). Throttle повторяющихся событий
 *   через dedupeKey (окно 60 минут). Производители событий — отдельный шаг.
 * @project: SaaS Bonus System
 * @dependencies: Prisma (@/lib/db), logger
 */

import type {
  AdminNotification,
  AdminNotificationType,
  AdminNotificationSeverity,
  Prisma
} from '@prisma/client';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const COMPONENT = 'admin-notification-service';

/** Окно throttle для dedupeKey: повтор того же события глушится на 60 минут. */
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface CreateAdminNotificationInput {
  adminAccountId: string;
  projectId?: string | null;
  type: AdminNotificationType;
  severity?: AdminNotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string | null;
}

/** Те же поля, но получатель резолвится из владельца проекта. */
export type NotifyProjectOwnerInput = Omit<
  CreateAdminNotificationInput,
  'adminAccountId'
>;

export interface ListAdminNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface ListAdminNotificationsResult {
  items: AdminNotification[];
  nextCursor: string | null;
}

export class AdminNotificationService {
  /**
   * Создаёт уведомление. Если передан dedupeKey — сначала ищет НЕпрочитанную
   * запись с тем же adminAccountId + dedupeKey, созданную за последние 60 минут,
   * и при наличии возвращает её БЕЗ повторной вставки (глушим шум).
   */
  static async create(
    input: CreateAdminNotificationInput
  ): Promise<AdminNotification> {
    if (input.dedupeKey) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
      const existing = await db.adminNotification.findFirst({
        where: {
          adminAccountId: input.adminAccountId,
          dedupeKey: input.dedupeKey,
          readAt: null,
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existing) {
        logger.debug('Admin notification deduped (recent unread exists)', {
          adminAccountId: input.adminAccountId,
          dedupeKey: input.dedupeKey,
          existingId: existing.id,
          component: COMPONENT
        });
        return existing;
      }
    }

    const notification = await db.adminNotification.create({
      data: {
        adminAccountId: input.adminAccountId,
        projectId: input.projectId ?? null,
        type: input.type,
        severity: input.severity ?? 'info',
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        metadata: input.metadata ?? undefined,
        dedupeKey: input.dedupeKey ?? null
      }
    });

    logger.debug('Admin notification created', {
      id: notification.id,
      adminAccountId: notification.adminAccountId,
      projectId: notification.projectId,
      type: notification.type,
      severity: notification.severity,
      component: COMPONENT
    });

    return notification;
  }

  /**
   * Создаёт уведомление для владельца проекта. Если у проекта нет владельца —
   * логируем warn и возвращаем null (некому слать).
   */
  static async notifyProjectOwner(
    projectId: string,
    input: NotifyProjectOwnerInput
  ): Promise<AdminNotification | null> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project?.ownerId) {
      logger.warn('notifyProjectOwner: project has no owner — skipping', {
        projectId,
        type: input.type,
        component: COMPONENT
      });
      return null;
    }

    return AdminNotificationService.create({
      ...input,
      adminAccountId: project.ownerId,
      projectId
    });
  }

  /**
   * Лента уведомлений админа, сортировка createdAt desc, курсорная пагинация
   * (cursor = id последнего элемента предыдущей страницы).
   */
  static async list(
    adminAccountId: string,
    opts: ListAdminNotificationsOptions = {}
  ): Promise<ListAdminNotificationsResult> {
    const limit = Math.min(
      Math.max(1, opts.limit ?? DEFAULT_LIMIT),
      MAX_LIMIT
    );

    const items = await db.adminNotification.findMany({
      where: {
        adminAccountId,
        ...(opts.unreadOnly ? { readAt: null } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {})
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }

    return { items, nextCursor };
  }

  /** Число непрочитанных уведомлений админа. */
  static async unreadCount(adminAccountId: string): Promise<number> {
    return db.adminNotification.count({
      where: { adminAccountId, readAt: null }
    });
  }

  /**
   * Помечает прочитанными переданные id — ТОЛЬКО строки этого админа
   * (tenant guard) и только ещё непрочитанные.
   */
  static async markRead(
    adminAccountId: string,
    ids: string[]
  ): Promise<number> {
    if (!ids.length) return 0;

    const result = await db.adminNotification.updateMany({
      where: {
        id: { in: ids },
        adminAccountId,
        readAt: null
      },
      data: { readAt: new Date() }
    });

    return result.count;
  }

  /** Помечает прочитанными все непрочитанные уведомления админа. */
  static async markAllRead(adminAccountId: string): Promise<number> {
    const result = await db.adminNotification.updateMany({
      where: { adminAccountId, readAt: null },
      data: { readAt: new Date() }
    });

    return result.count;
  }
}
