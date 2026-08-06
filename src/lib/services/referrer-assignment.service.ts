/**
 * @file: src/lib/services/referrer-assignment.service.ts
 * @description: Единственная точка записи `User.referredBy` ("кто привёл").
 *   Раньше профиль пользователя ("Приведён" → PATCH /users/[userId]/referrer)
 *   и карточка b2b-организации ("Реферер" в диалогах участника) писали в это
 *   поле напрямую двумя разными путями: один проверял циклы, фиксировал
 *   ReferralAttribution и уведомлял вышестоящих, другой — нет. Из-за этого
 *   привязка через организацию могла создать петлю рефереров и оставить
 *   пользователя без attribution (без начислений по комиссии). Теперь оба
 *   места вызывают `setReferrer` отсюда.
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ReferralCommissionService } from './referral-commission.service';
import { PartnerNotificationService } from './partner-notification.service';

export class ReferrerAssignmentService {
  /**
   * Устанавливает или снимает реферера пользователя. `referrerId: null` только
   * снимает привязку (история ReferralAttribution не трогается — она
   * зафиксирована на момент первого начисления и намеренно не следует за
   * сменой referredBy, см. комментарий к модели ReferralAttribution).
   *
   * `attributionLocked: true` в ответе означает, что у пользователя уже была
   * зафиксирована выплата ДО этого вызова — поле `referredBy` обновится (это
   * просто отображаемая связь "кто привёл"), но реальный получатель комиссии
   * (`ReferralAttribution.referrerId`) не изменится. Вызывающая сторона обязана
   * показать это администратору, иначе смена реферера выглядит так, будто она
   * меняет и выплаты тоже.
   */
  static async setReferrer(params: {
    projectId: string;
    userId: string;
    referrerId: string | null;
    organizationId?: string | null;
  }): Promise<{
    referrerId: string | null;
    referrerName: string | null;
    attributionLocked: boolean;
  }> {
    const { projectId, userId, referrerId, organizationId } = params;

    if (referrerId === null) {
      const user = await db.user.findFirst({
        where: { id: userId, projectId },
        select: { id: true }
      });
      if (!user) throw new Error('Пользователь не найден');

      const existingAttribution = await db.referralAttribution.findUnique({
        where: { userId },
        select: { id: true }
      });

      await db.user.update({
        where: { id: userId },
        data: { referredBy: null }
      });
      return {
        referrerId: null,
        referrerName: null,
        attributionLocked: Boolean(existingAttribution)
      };
    }

    if (referrerId === userId) {
      throw new Error('Пользователь не может быть реферером сам себе');
    }

    const [user, referrer] = await Promise.all([
      db.user.findFirst({
        where: { id: userId, projectId },
        select: { id: true, organizationId: true }
      }),
      db.user.findFirst({
        where: { id: referrerId, projectId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          organizationId: true
        }
      })
    ]);

    if (!user) throw new Error('Пользователь не найден');
    if (!referrer) throw new Error('Реферер не найден');

    // Была ли уже зафиксирована выплата ДО этого изменения — важно проверить
    // здесь, а не после syncAttributionForInvitedUser (та идемпотентна и
    // создаст запись, если её ещё не было — тогда attributionLocked должен
    // остаться false, ведь для ЭТОГО назначения attribution ещё не "старая").
    const existingAttribution = await db.referralAttribution.findUnique({
      where: { userId },
      select: { id: true, referrerId: true }
    });
    const attributionLocked = Boolean(
      existingAttribution && existingAttribution.referrerId !== referrerId
    );

    // Защита от цикла: поднимаемся по цепочке referredBy реферера — если
    // встретим userId, назначение замкнёт петлю.
    let cursor: string | null = referrerId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === userId) {
        throw new Error(
          'Нельзя назначить реферером того, кто уже приглашён этим пользователем'
        );
      }
      if (visited.has(cursor)) break; // страховка от уже существующей петли
      visited.add(cursor);
      const parent: { referredBy: string | null } | null =
        await db.user.findFirst({
          where: { id: cursor, projectId },
          select: { referredBy: true }
        });
      cursor = parent?.referredBy ?? null;
    }

    const resolvedOrganizationId =
      organizationId ?? user.organizationId ?? referrer.organizationId;

    await db.user.update({
      where: { id: userId },
      data: {
        referredBy: referrerId,
        ...(user.organizationId
          ? {}
          : resolvedOrganizationId
            ? { organizationId: resolvedOrganizationId }
            : {})
      }
    });

    // Синхронизация комиссионной attribution (идемпотентна — если уже была,
    // не перезапишется, чтобы не ломать историю начислений).
    try {
      await ReferralCommissionService.syncAttributionForInvitedUser({
        invitedUserId: userId,
        projectId,
        referrerId,
        organizationId: resolvedOrganizationId ?? null
      });
    } catch (attrError) {
      logger.error('Ошибка синхронизации attribution при привязке реферера', {
        userId,
        projectId,
        referrerId,
        error:
          attrError instanceof Error ? attrError.message : 'Неизвестная ошибка',
        component: 'referrer-assignment-service'
      });
      throw attrError;
    }

    void PartnerNotificationService.notifyAncestorsAboutNewMember(
      userId,
      projectId
    );

    const referrerName =
      `${referrer.firstName ?? ''} ${referrer.lastName ?? ''}`.trim() ||
      referrer.phone ||
      referrer.email ||
      null;

    return { referrerId, referrerName, attributionLocked };
  }
}
