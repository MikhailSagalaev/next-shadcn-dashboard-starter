/**
 * @file: partner-organization.service.ts
 * @description: CRUD и статистика B2B-организаций (сети фитнес-клубов)
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

import type { PartnerRole, Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PartnerTeamService } from './partner-team.service';
import { ReferrerAssignmentService } from './referrer-assignment.service';
import { PartnerNotificationService } from './partner-notification.service';

export interface CreateOrganizationInput {
  projectId: string;
  name: string;
  slug?: string;
  description?: string;
  firstPurchaseDiscountPercent?: number;
  defaultReferralCommissionPlanId?: string | null;
  directorUserId?: string | null;
}

export interface OrganizationStats {
  members: number;
  trainers: number;
  managers: number;
  directors: number;
  clients: number;
  totalPurchases: number;
  commissionEarned: number;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'org'
  );
}

export class PartnerOrganizationService {
  private static async validateDirector(
    tx: Prisma.TransactionClient,
    projectId: string,
    directorUserId: string | null | undefined
  ) {
    if (!directorUserId) return null;

    const director = await tx.user.findFirst({
      where: { id: directorUserId, projectId },
      select: { id: true }
    });
    if (!director) {
      throw new Error('Руководитель не найден в этом проекте');
    }
    return director;
  }

  private static async validateDefaultPlan(
    tx: Prisma.TransactionClient,
    projectId: string,
    planId: string | null | undefined
  ) {
    if (!planId) return null;

    const plan = await tx.referralCommissionPlan.findFirst({
      where: {
        id: planId,
        projectId,
        isActive: true,
        levels: { some: { isActive: true } }
      },
      select: { id: true }
    });
    if (!plan) {
      throw new Error(
        'Активный партнёрский план по умолчанию не найден в этом проекте'
      );
    }
    return plan;
  }

  private static async validateOutboundPlan(
    projectId: string,
    planId: string | null | undefined,
    partnerRole: PartnerRole
  ): Promise<void> {
    if (!planId) return;
    if (partnerRole === 'CLIENT') {
      throw new Error('Партнёрский план можно назначить только уровням 1–3');
    }
    const plan = await db.referralCommissionPlan.findFirst({
      where: { id: planId, projectId, isActive: true },
      select: { id: true }
    });
    if (!plan) {
      throw new Error('Активный партнёрский план не найден в этом проекте');
    }
  }

  static async list(projectId: string) {
    return db.partnerOrganization.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: {
        defaultReferralCommissionPlan: { select: { id: true, name: true } },
        _count: { select: { members: true } }
      }
    });
  }

  static async getById(projectId: string, organizationId: string) {
    const org = await db.partnerOrganization.findFirst({
      where: { id: organizationId, projectId },
      include: {
        project: { select: { domain: true } },
        defaultReferralCommissionPlan: { select: { id: true, name: true } },
        _count: { select: { members: true } }
      }
    });
    if (!org) return null;

    let director: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      partnerRole: PartnerRole;
    } | null = null;

    if (org.directorUserId) {
      director = await db.user.findFirst({
        where: { id: org.directorUserId, projectId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          partnerRole: true
        }
      });
    }

    return { ...org, director };
  }

  static async listMembers(projectId: string, organizationId: string) {
    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');

    const members = await db.user.findMany({
      where: { projectId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        partnerRole: true,
        referredBy: true,
        outboundReferralPlanId: true,
        registeredAt: true,
        totalPurchases: true,
        isActive: true
      },
      orderBy: [{ partnerRole: 'desc' }, { registeredAt: 'asc' }]
    });

    const referrerIds = [
      ...new Set(members.map((m) => m.referredBy).filter(Boolean))
    ] as string[];

    const referrers =
      referrerIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: referrerIds }, projectId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          })
        : [];

    const referrerMap = new Map(referrers.map((r) => [r.id, r]));

    const planIds = [
      ...new Set(members.map((m) => m.outboundReferralPlanId).filter(Boolean))
    ] as string[];

    const plans =
      planIds.length > 0
        ? await db.referralCommissionPlan.findMany({
            where: { id: { in: planIds }, projectId },
            select: { id: true, name: true }
          })
        : [];

    const planMap = new Map(plans.map((p) => [p.id, p.name]));

    return members.map((m) => {
      const ref = m.referredBy ? referrerMap.get(m.referredBy) : null;
      const refName = ref
        ? [ref.firstName, ref.lastName].filter(Boolean).join(' ').trim() ||
          ref.email ||
          ref.id.slice(0, 8)
        : null;
      return {
        id: m.id,
        name:
          [m.firstName, m.lastName].filter(Boolean).join(' ').trim() ||
          m.email ||
          m.phone ||
          m.id.slice(0, 8),
        email: m.email,
        phone: m.phone,
        partnerRole: m.partnerRole,
        referredBy: m.referredBy,
        referrerName: refName,
        outboundReferralPlanId: m.outboundReferralPlanId,
        outboundPlanName: m.outboundReferralPlanId
          ? (planMap.get(m.outboundReferralPlanId) ?? null)
          : null,
        registeredAt: m.registeredAt.toISOString(),
        totalPurchases: Number(m.totalPurchases ?? 0),
        isActive: m.isActive
      };
    });
  }

  static async addMember(
    projectId: string,
    organizationId: string,
    input: {
      userId: string;
      partnerRole?: 'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR';
      referredBy?: string | null;
      outboundReferralPlanId?: string | null;
    }
  ) {
    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');

    const user = await db.user.findFirst({
      where: { id: input.userId, projectId }
    });
    if (!user) throw new Error('Пользователь не найден');

    const effectiveRole = input.partnerRole ?? user.partnerRole;
    await this.validateOutboundPlan(
      projectId,
      input.outboundReferralPlanId,
      effectiveRole
    );

    // Пользователь уже состоит в другой сети — раньше `addMember` тихо
    // перевешивал organizationId, из-за чего человек незаметно "переезжал"
    // между организациями. Теперь это требует явного шага: сначала убрать
    // из старой сети (removeMember), потом добавить в новую.
    if (user.organizationId && user.organizationId !== organizationId) {
      const previousOrg = await this.getById(projectId, user.organizationId);
      throw new Error(
        `Пользователь уже состоит в организации «${previousOrg?.name ?? user.organizationId}» — сначала уберите его оттуда`
      );
    }

    let referredBy = input.referredBy;
    if (referredBy === undefined) {
      const members = await this.listMembers(projectId, organizationId);
      referredBy = PartnerTeamService.resolveDefaultReferrerForOrgMember({
        partnerRole: input.partnerRole ?? 'CLIENT',
        members: members.map((m) => ({
          id: m.id,
          partnerRole: m.partnerRole
        })),
        directorUserId: org.directorUserId
      });
    }

    // Привязка реферера — через общий сервис (см. ReferrerAssignmentService):
    // проверяет цикл и синхронизирует attribution комиссий, как и при ручной
    // привязке из карточки профиля.
    let attributionLocked = false;
    if (referredBy) {
      const result = await ReferrerAssignmentService.setReferrer({
        projectId,
        userId: input.userId,
        referrerId: referredBy,
        organizationId
      });
      attributionLocked = result.attributionLocked;
    }

    const updated = await db.user.update({
      where: { id: input.userId },
      data: {
        organizationId,
        ...(input.partnerRole ? { partnerRole: input.partnerRole } : {}),
        ...(input.outboundReferralPlanId !== undefined
          ? { outboundReferralPlanId: input.outboundReferralPlanId }
          : {})
      }
    });

    if (
      input.partnerRole === 'DIRECTOR' ||
      (org.directorUserId === input.userId && input.partnerRole !== 'CLIENT')
    ) {
      await db.partnerOrganization.update({
        where: { id: organizationId },
        data: { directorUserId: input.userId }
      });
    }

    // Пользователь молча остаётся с устаревшим меню бота, пока не увидит
    // подсказку — уведомляем так же, как approveJoinRequest делает для
    // заявок на вступление (см. PartnerNotificationService.notifyRoleOrOrgChanged).
    void PartnerNotificationService.notifyRoleOrOrgChanged({
      userId: input.userId,
      projectId,
      newRole: input.partnerRole ?? updated.partnerRole,
      organizationName: org.name
    });

    return { user: updated, attributionLocked };
  }

  static async removeMember(
    projectId: string,
    organizationId: string,
    userId: string
  ) {
    const user = await db.user.findFirst({
      where: { id: userId, projectId, organizationId }
    });
    if (!user) throw new Error('Участник не найден в этой организации');

    const org = await this.getById(projectId, organizationId);
    if (org?.directorUserId === userId) {
      await db.partnerOrganization.update({
        where: { id: organizationId },
        data: { directorUserId: null }
      });
    }

    return db.user.update({
      where: { id: userId },
      data: { organizationId: null }
    });
  }

  static async updateMember(
    projectId: string,
    organizationId: string,
    userId: string,
    input: {
      partnerRole?: 'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR';
      referredBy?: string | null;
      outboundReferralPlanId?: string | null;
    }
  ) {
    const user = await db.user.findFirst({
      where: { id: userId, projectId, organizationId }
    });
    if (!user) throw new Error('Участник не найден в этой организации');

    const effectiveRole = input.partnerRole ?? user.partnerRole;
    await this.validateOutboundPlan(
      projectId,
      input.outboundReferralPlanId,
      effectiveRole
    );

    // Привязка/снятие реферера — через общий сервис (см.
    // ReferrerAssignmentService), тот же путь, что и в карточке профиля:
    // проверяет цикл и синхронизирует attribution комиссий.
    let attributionLocked = false;
    if (input.referredBy !== undefined) {
      const result = await ReferrerAssignmentService.setReferrer({
        projectId,
        userId,
        referrerId: input.referredBy,
        organizationId
      });
      attributionLocked = result.attributionLocked;
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        ...(input.partnerRole !== undefined
          ? { partnerRole: input.partnerRole }
          : {}),
        ...(input.outboundReferralPlanId !== undefined
          ? { outboundReferralPlanId: input.outboundReferralPlanId }
          : input.partnerRole === 'CLIENT'
            ? { outboundReferralPlanId: null }
            : {})
      }
    });

    // Один запрос организации переиспользуется и для director-переключения,
    // и для имени в уведомлении — раньше это были два отдельных getById().
    let orgForBookkeeping =
      input.partnerRole !== 'DIRECTOR'
        ? await this.getById(projectId, organizationId)
        : null;

    if (input.partnerRole === 'DIRECTOR') {
      await db.partnerOrganization.update({
        where: { id: organizationId },
        data: { directorUserId: userId }
      });
    } else if (orgForBookkeeping?.directorUserId === userId) {
      await db.partnerOrganization.update({
        where: { id: organizationId },
        data: { directorUserId: null }
      });
    }

    // Уведомляем только если роль реально изменилась — не спамить на каждое
    // редактирование (referredBy/outboundReferralPlanId тоже идут через этот
    // метод и не требуют "откройте /start заново").
    if (
      input.partnerRole !== undefined &&
      input.partnerRole !== user.partnerRole
    ) {
      if (!orgForBookkeeping) {
        orgForBookkeeping = await this.getById(projectId, organizationId);
      }
      void PartnerNotificationService.notifyRoleOrOrgChanged({
        userId,
        projectId,
        newRole: input.partnerRole,
        organizationName: orgForBookkeeping?.name
      });
    }

    return { user: updated, attributionLocked };
  }

  static async transferMember(
    projectId: string,
    sourceOrganizationId: string,
    userId: string,
    targetOrganizationId: string
  ) {
    if (sourceOrganizationId === targetOrganizationId) {
      throw new Error('Выберите другую организацию');
    }

    const transfer = await db.$transaction(async (tx) => {
      const organizations = await tx.partnerOrganization.findMany({
        where: {
          projectId,
          id: { in: [sourceOrganizationId, targetOrganizationId] }
        },
        select: { id: true, name: true, directorUserId: true }
      });
      const sourceOrganization = organizations.find(
        (organization) => organization.id === sourceOrganizationId
      );
      const targetOrganization = organizations.find(
        (organization) => organization.id === targetOrganizationId
      );
      if (!sourceOrganization)
        throw new Error('Исходная организация не найдена');
      if (!targetOrganization)
        throw new Error('Целевая организация не найдена');

      const user = await tx.user.findFirst({
        where: { id: userId, projectId, organizationId: sourceOrganizationId },
        select: {
          id: true,
          partnerRole: true,
          outboundReferralPlanId: true
        }
      });
      if (!user) throw new Error('Участник не найден в исходной организации');

      const targetMembers = await tx.user.findMany({
        where: { projectId, organizationId: targetOrganizationId },
        select: { id: true, partnerRole: true }
      });
      const defaultReferrerId =
        PartnerTeamService.resolveDefaultReferrerForOrgMember({
          partnerRole: user.partnerRole,
          members: targetMembers,
          directorUserId: targetOrganization.directorUserId
        });

      if (sourceOrganization.directorUserId === userId) {
        await tx.partnerOrganization.update({
          where: { id: sourceOrganizationId },
          data: { directorUserId: null }
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { organizationId: targetOrganizationId }
      });

      if (user.partnerRole === 'DIRECTOR') {
        await tx.partnerOrganization.update({
          where: { id: targetOrganizationId },
          data: { directorUserId: userId }
        });
      }

      return {
        user: updatedUser,
        defaultReferrerId,
        targetOrganizationName: targetOrganization.name
      };
    });

    const referrer = await ReferrerAssignmentService.setReferrer({
      projectId,
      userId,
      referrerId: transfer.defaultReferrerId,
      organizationId: targetOrganizationId
    });

    void PartnerNotificationService.notifyRoleOrOrgChanged({
      userId,
      projectId,
      newRole: transfer.user.partnerRole,
      organizationName: transfer.targetOrganizationName
    });

    return {
      user: { ...transfer.user, referredBy: referrer.referrerId },
      attributionLocked: referrer.attributionLocked
    };
  }

  static async resolveBySlug(
    projectId: string,
    slug: string | null | undefined
  ) {
    if (!slug?.trim()) return null;
    return db.partnerOrganization.findFirst({
      where: {
        projectId,
        slug: slug.trim().toLowerCase(),
        isActive: true
      }
    });
  }

  static async create(input: CreateOrganizationInput) {
    const slug = (input.slug?.trim() || slugify(input.name)).toLowerCase();

    return db.$transaction(async (tx) => {
      const existing = await tx.partnerOrganization.findFirst({
        where: { projectId: input.projectId, slug },
        select: { id: true }
      });
      if (existing) {
        throw new Error(`Организация со slug «${slug}» уже существует`);
      }

      await Promise.all([
        this.validateDirector(tx, input.projectId, input.directorUserId),
        this.validateDefaultPlan(
          tx,
          input.projectId,
          input.defaultReferralCommissionPlanId
        )
      ]);

      const org = await tx.partnerOrganization.create({
        data: {
          projectId: input.projectId,
          name: input.name.trim(),
          slug,
          description: input.description?.trim() || null,
          firstPurchaseDiscountPercent:
            input.firstPurchaseDiscountPercent ?? 0,
          defaultReferralCommissionPlanId:
            input.defaultReferralCommissionPlanId || null,
          directorUserId: input.directorUserId || null
        }
      });

      if (input.directorUserId) {
        await tx.user.update({
          where: { id: input.directorUserId },
          data: {
            organizationId: org.id,
            partnerRole: 'DIRECTOR'
          }
        });
      }

      return org;
    });
  }

  static async update(
    projectId: string,
    organizationId: string,
    data: Partial<CreateOrganizationInput> & { isActive?: boolean }
  ) {
    return db.$transaction(async (tx) => {
      const org = await tx.partnerOrganization.findFirst({
        where: { id: organizationId, projectId }
      });
      if (!org) throw new Error('Организация не найдена');

      const slug = data.slug?.trim().toLowerCase();
      if (slug && slug !== org.slug) {
        const clash = await tx.partnerOrganization.findFirst({
          where: { projectId, slug, NOT: { id: organizationId } },
          select: { id: true }
        });
        if (clash) throw new Error(`Slug «${slug}» уже занят`);
      }

      await Promise.all([
        data.directorUserId !== undefined
          ? this.validateDirector(tx, projectId, data.directorUserId)
          : Promise.resolve(null),
        data.defaultReferralCommissionPlanId !== undefined
          ? this.validateDefaultPlan(
              tx,
              projectId,
              data.defaultReferralCommissionPlanId
            )
          : Promise.resolve(null)
      ]);

      const updated = await tx.partnerOrganization.update({
        where: { id: organizationId },
        data: {
          name: data.name?.trim() ?? undefined,
          slug: slug ?? undefined,
          description:
            data.description !== undefined
              ? data.description?.trim() || null
              : undefined,
          isActive: data.isActive,
          firstPurchaseDiscountPercent:
            data.firstPurchaseDiscountPercent !== undefined
              ? data.firstPurchaseDiscountPercent
              : undefined,
          defaultReferralCommissionPlanId:
            data.defaultReferralCommissionPlanId !== undefined
              ? data.defaultReferralCommissionPlanId
              : undefined,
          directorUserId:
            data.directorUserId !== undefined ? data.directorUserId : undefined
        }
      });

      if (data.directorUserId) {
        await tx.user.update({
          where: { id: data.directorUserId },
          data: { organizationId, partnerRole: 'DIRECTOR' }
        });
      }

      return updated;
    });
  }

  static async delete(projectId: string, organizationId: string) {
    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');

    await db.user.updateMany({
      where: { organizationId, projectId },
      data: { organizationId: null }
    });

    await db.partnerOrganization.delete({ where: { id: organizationId } });
    return { success: true };
  }

  static async assignUserToOrganization(
    projectId: string,
    userId: string,
    organizationId: string | null
  ) {
    if (organizationId) {
      const org = await this.getById(projectId, organizationId);
      if (!org) throw new Error('Организация не найдена');
    }

    return db.user.update({
      where: { id: userId },
      data: { organizationId }
    });
  }

  static async getStats(
    projectId: string,
    organizationId: string,
    since?: Date | null
  ): Promise<OrganizationStats> {
    const members = await db.user.findMany({
      where: { projectId, organizationId },
      select: {
        partnerRole: true,
        totalPurchases: true,
        id: true
      }
    });

    const roleCount = (role: string) =>
      members.filter((m) => m.partnerRole === role).length;

    const userIds = members.map((m) => m.id);
    let commissionEarned = 0;

    if (userIds.length > 0) {
      const agg = await db.transaction.aggregate({
        where: {
          userId: { in: userIds },
          type: 'EARN',
          isReferralBonus: true,
          ...(since ? { createdAt: { gte: since } } : {})
        },
        _sum: { amount: true }
      });
      commissionEarned = Number(agg._sum.amount ?? 0);
    }

    return {
      members: members.length,
      trainers: roleCount('TRAINER'),
      managers: roleCount('MANAGER'),
      directors: roleCount('DIRECTOR'),
      clients: roleCount('CLIENT'),
      totalPurchases: members.reduce(
        (sum, m) => sum + Number(m.totalPurchases ?? 0),
        0
      ),
      commissionEarned
    };
  }

  static async resolveOrganizationIdForRegistration(params: {
    projectId: string;
    utmOrgSlug?: string | null;
    referrerId?: string | null;
  }): Promise<string | null> {
    const { projectId, utmOrgSlug, referrerId } = params;

    if (utmOrgSlug) {
      const bySlug = await this.resolveBySlug(projectId, utmOrgSlug);
      if (bySlug) return bySlug.id;
      logger.warn('utm_org slug not found', { projectId, utmOrgSlug });
    }

    if (referrerId) {
      const referrer = await db.user.findFirst({
        where: { id: referrerId, projectId },
        select: { organizationId: true }
      });
      if (referrer?.organizationId) return referrer.organizationId;
    }

    return null;
  }
}
