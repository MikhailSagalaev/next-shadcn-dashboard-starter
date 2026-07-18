/**
 * @file: src/lib/services/workflow/scheduled/audience-resolver.ts
 * @description: Резолвит декларативный AudienceConfig в список userId проекта.
 *               Используется как cron-эндпоинтом, так и preview API в редакторе workflow.
 *               Все запросы изолированы по projectId (multitenancy).
 * @project: SaaS Bonus System
 * @created: 2026-05-27
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import type { AudienceConfig } from '@/types/workflow';

export interface AudienceResolution {
  /** ID пользователей, попадающих под условие. */
  userIds: string[];
  /** Общее количество пользователей во всех загруженных страницах. */
  total: number;
  /** Тип аудитории, который был резолвлен (для логов). */
  type: AudienceConfig['type'];
}

export interface AudiencePage {
  userIds: string[];
  type: AudienceConfig['type'];
}

/** Ограничивает размер каждого DB-запроса, но не общий размер аудитории. */
const AUDIENCE_PAGE_SIZE = 1000;

export class AudienceResolver {
  /**
   * Совместимый с preview API метод: собирает все страницы в прежний результат.
   * Scheduled runner использует resolvePages напрямую и не держит всю аудиторию в памяти.
   */
  static async resolve(
    projectId: string,
    audience: AudienceConfig
  ): Promise<AudienceResolution> {
    const userIds: string[] = [];

    for await (const page of this.resolvePages(projectId, audience)) {
      userIds.push(...page.userIds);
    }

    return {
      userIds,
      total: userIds.length,
      type: audience.type
    };
  }
  /**
   * Постранично возвращает всю аудиторию. Каждый запрос ограничен AUDIENCE_PAGE_SIZE,
   * а keyset pagination исключает пропуски на аудиториях больше 5000 пользователей.
   */
  static async *resolvePages(
    projectId: string,
    audience: AudienceConfig
  ): AsyncGenerator<AudiencePage> {
    switch (audience.type) {
      case 'birthday_today':
        yield* this.byBirthdayOffsetPages(projectId, 0, audience.type);
        return;
      case 'birthday_in_days': {
        const days = Number(audience.params?.daysBefore);
        if (!Number.isFinite(days) || days < 1 || days > 365) {
          throw new Error(
            `Audience "birthday_in_days" requires params.daysBefore (1-365), got ${audience.params?.daysBefore}`
          );
        }
        yield* this.byBirthdayOffsetPages(projectId, days, audience.type);
        return;
      }
      case 'birthday_after_days': {
        const days = Number(audience.params?.daysAfter);
        if (!Number.isFinite(days) || days < 1 || days > 365) {
          throw new Error(
            `Audience "birthday_after_days" requires params.daysAfter (1-365), got ${audience.params?.daysAfter}`
          );
        }
        yield* this.byBirthdayOffsetPages(projectId, -days, audience.type);
        return;
      }
      case 'all_active_users':
        yield* this.allActiveUserPages(projectId);
        return;
      default: {
        const exhaustive: never = audience.type;
        throw new Error(`Unknown audience type: ${exhaustive}`);
      }
    }
  }

  private static async *allActiveUserPages(
    projectId: string
  ): AsyncGenerator<AudiencePage> {
    let cursor = '';

    while (true) {
      const users = await db.user.findMany({
        where: {
          projectId,
          isActive: true,
          ...(cursor ? { id: { gt: cursor } } : {})
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: AUDIENCE_PAGE_SIZE
      });

      if (users.length === 0) return;

      yield {
        userIds: users.map((user) => user.id),
        type: 'all_active_users'
      };

      if (users.length < AUDIENCE_PAGE_SIZE) return;
      cursor = users[users.length - 1].id;
    }
  }

  /**
   * Матчит день и месяц в UTC. Keyset pagination по id обеспечивает bounded queries
   * и продолжает выборку до полного исчерпания аудитории.
   */
  private static async *byBirthdayOffsetPages(
    projectId: string,
    daysOffset: number,
    audienceType: AudienceConfig['type']
  ): AsyncGenerator<AudiencePage> {
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + daysOffset);
    const targetMonth = target.getUTCMonth() + 1;
    const targetDay = target.getUTCDate();
    let cursor = '';

    while (true) {
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM users
        WHERE project_id = ${projectId}
          AND is_active = true
          AND birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM birth_date) = ${targetMonth}
          AND EXTRACT(DAY FROM birth_date) = ${targetDay}
          AND id > ${cursor}
        ORDER BY id ASC
        LIMIT ${AUDIENCE_PAGE_SIZE}
      `;

      if (rows.length === 0) return;

      yield {
        userIds: rows.map((row) => row.id),
        type: audienceType
      };

      if (rows.length < AUDIENCE_PAGE_SIZE) return;
      cursor = rows[rows.length - 1].id;
    }
  }
}
