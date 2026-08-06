/**
 * @file: partner-organization.service.ts
 * @description: B2B organizations with multi-membership and multi-referral links.
 */

import type { PartnerRole, Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PartnerNotificationService } from './partner-notification.service';
import {
  PartnerReferralGraphService,
  type ReferralLinkInput
} from './partner-referral-graph.service';
import { ReferrerAssignmentService } from './referrer-assignment.service';

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

export interface OrganizationMemberInput {
  userId: string;
  partnerRole?: PartnerRole;
  level?: number | null;
  title?: string | null;
  canManage?: boolean;
  referredBy?: string | null;
  referrerLinks?: ReferralLinkInput[];
  outboundReferralPlanId?: string | null;
}

function deriveCompatibilityRole(
  memberships: Array<{ level: number | null; canManage: boolean }>
): PartnerRole {
  if (memberships.some((membership) => membership.canManage)) return 'DIRECTOR';
  if (memberships.some((membership) => membership.level !== null))
    return 'TRAINER';
  return 'CLIENT';
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

function displayName(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone?: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    user.phone ||
    user.id.slice(0, 8)
  );
}

function normalizeLevel(level: number | null | undefined) {
  if (level === null || level === undefined) return level;
  const normalized = Math.trunc(level);
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error('Уровень участника должен быть целым числом от 1');
  }
  return normalized;
}

function normalizeTitle(title: string | null | undefined) {
  if (title === undefined) return undefined;
  return title?.trim() || null;
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
    planId: string | null | undefined
  ): Promise<void> {
    if (!planId) return;
    const plan = await db.referralCommissionPlan.findFirst({
      where: { id: planId, projectId, isActive: true },
      select: { id: true }
    });
    if (!plan) {
      throw new Error('Активный партнёрский план не найден в этом проекте');
    }
  }

  private static toReferralLinks(input: {
    referredBy?: string | null;
    referrerLinks?: ReferralLinkInput[];
  }): ReferralLinkInput[] | undefined {
    if (input.referrerLinks !== undefined) return input.referrerLinks;
    if (input.referredBy === undefined) return undefined;
    return input.referredBy
      ? [
          {
            referrerId: input.referredBy,
            sharePercent: 100,
            isPrimary: true
          }
        ]
      : [];
  }

  static async list(projectId: string) {
    const organizations = await db.partnerOrganization.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: {
        defaultReferralCommissionPlan: { select: { id: true, name: true } },
        _count: { select: { memberships: true } }
      }
    });

    return organizations.map(({ _count, ...organization }) => ({
      ...organization,
      _count: { members: _count.memberships }
    }));
  }

  static async getById(projectId: string, organizationId: string) {
    const org = await db.partnerOrganization.findFirst({
      where: { id: organizationId, projectId },
      include: {
        project: { select: { domain: true } },
        defaultReferralCommissionPlan: { select: { id: true, name: true } },
        _count: { select: { memberships: true } }
      }
    });
    if (!org) return null;

    const director = org.directorUserId
      ? await db.user.findFirst({
          where: { id: org.directorUserId, projectId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            partnerRole: true
          }
        })
      : null;

    const { _count, ...organization } = org;
    return {
      ...organization,
      _count: { members: _count.memberships },
      director
    };
  }

  static async listMembers(projectId: string, organizationId: string) {
    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');

    const memberships = await db.partnerOrganizationMembership.findMany({
      where: { projectId, organizationId },
      include: {
        user: {
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
          }
        }
      },
      orderBy: [{ level: 'desc' }, { createdAt: 'asc' }]
    });

    const userIds = memberships.map((membership) => membership.userId);
    const [links, attributions] = await Promise.all([
      PartnerReferralGraphService.listLinks(projectId, organizationId, userIds),
      userIds.length > 0
        ? db.referralAttribution.findMany({
            where: { projectId, userId: { in: userIds } },
            select: { userId: true, commissionPlanId: true }
          })
        : Promise.resolve([])
    ]);

    const linksByChild = new Map<string, typeof links>();
    for (const link of links) {
      const childLinks = linksByChild.get(link.childUserId) ?? [];
      childLinks.push(link);
      linksByChild.set(link.childUserId, childLinks);
    }

    const attributionByUserId = new Map(
      attributions.map((attribution) => [
        attribution.userId,
        attribution.commissionPlanId
      ])
    );
    const planIds = [
      ...new Set(
        memberships
          .flatMap((membership) => [
            membership.user.outboundReferralPlanId,
            attributionByUserId.get(membership.userId)
          ])
          .filter((id): id is string => Boolean(id))
      )
    ];
    const plans =
      planIds.length > 0
        ? await db.referralCommissionPlan.findMany({
            where: { id: { in: planIds }, projectId },
            select: { id: true, name: true }
          })
        : [];
    const planMap = new Map(plans.map((plan) => [plan.id, plan.name]));

    return memberships.map((membership) => {
      const user = membership.user;
      const memberLinks = linksByChild.get(user.id) ?? [];
      const primaryLink =
        memberLinks.find((link) => link.isPrimary) ?? memberLinks[0] ?? null;
      return {
        id: user.id,
        name: displayName(user),
        email: user.email,
        phone: user.phone,
        partnerRole: user.partnerRole,
        level: membership.level,
        title: membership.title,
        canManage: membership.canManage,
        referredBy: primaryLink?.referrerUserId ?? user.referredBy,
        referrerName: primaryLink ? displayName(primaryLink.referrer) : null,
        referrerLinks: memberLinks.map((link) => ({
          referrerId: link.referrerUserId,
          referrerName: displayName(link.referrer),
          sharePercent: Number(link.sharePercent),
          isPrimary: link.isPrimary
        })),
        outboundReferralPlanId: user.outboundReferralPlanId,
        outboundPlanName: user.outboundReferralPlanId
          ? (planMap.get(user.outboundReferralPlanId) ?? null)
          : null,
        attributionPlanName: attributionByUserId.get(user.id)
          ? (planMap.get(attributionByUserId.get(user.id)!) ?? null)
          : null,
        registeredAt: user.registeredAt.toISOString(),
        totalPurchases: Number(user.totalPurchases ?? 0),
        isActive: user.isActive
      };
    });
  }

  static async addMember(
    projectId: string,
    organizationId: string,
    input: OrganizationMemberInput
  ) {
    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');

    const user = await db.user.findFirst({
      where: { id: input.userId, projectId }
    });
    if (!user) throw new Error('Пользователь не найден');

    const outboundReferralPlanId =
      input.outboundReferralPlanId ??
      org.defaultReferralCommissionPlanId ??
      null;
    await this.validateOutboundPlan(projectId, outboundReferralPlanId);
    const level = normalizeLevel(input.level);

    await db.partnerOrganizationMembership.upsert({
      where: {
        organizationId_userId: { organizationId, userId: input.userId }
      },
      update: {
        level,
        title: normalizeTitle(input.title),
        canManage: input.canManage
      },
      create: {
        projectId,
        organizationId,
        userId: input.userId,
        level,
        title: normalizeTitle(input.title) ?? null,
        canManage: input.canManage ?? false
      }
    });

    const compatibilityRole = deriveCompatibilityRole(
      await db.partnerOrganizationMembership.findMany({
        where: { projectId, userId: input.userId },
        select: { level: true, canManage: true }
      })
    );
    const updated = await db.user.update({
      where: { id: input.userId },
      data: {
        ...(user.organizationId ? {} : { organizationId }),
        partnerRole: compatibilityRole,
        outboundReferralPlanId
      }
    });

    const referralLinks = this.toReferralLinks(input);
    let attributionLocked = false;
    if (referralLinks !== undefined) {
      const primary =
        referralLinks.find((link) => link.isPrimary) ??
        referralLinks.find((link) => Number(link.sharePercent ?? 0) > 0) ??
        referralLinks[0] ??
        null;
      const assignment = await ReferrerAssignmentService.setReferrer({
        projectId,
        userId: input.userId,
        referrerId: primary?.referrerId ?? null,
        organizationId
      });
      attributionLocked = assignment.attributionLocked;
      await PartnerReferralGraphService.replaceLinks({
        projectId,
        organizationId,
        childUserId: input.userId,
        links: referralLinks
      });
    }

    void PartnerNotificationService.notifyRoleOrOrgChanged({
      userId: input.userId,
      projectId,
      newRole: compatibilityRole,
      organizationName: org.name
    });

    return { user: updated, attributionLocked };
  }

  static async removeMember(
    projectId: string,
    organizationId: string,
    userId: string
  ) {
    const membership = await db.partnerOrganizationMembership.findFirst({
      where: { projectId, organizationId, userId },
      select: { id: true }
    });
    if (!membership) {
      throw new Error('Участник не найден в этой организации');
    }

    const result = await db.$transaction(async (tx) => {
      const [user, alternative, removedLinks] = await Promise.all([
        tx.user.findFirst({
          where: { id: userId, projectId },
          select: { organizationId: true }
        }),
        tx.partnerOrganizationMembership.findFirst({
          where: {
            projectId,
            userId,
            organizationId: { not: organizationId }
          },
          orderBy: [{ canManage: 'desc' }, { createdAt: 'asc' }],
          select: { organizationId: true }
        }),
        tx.partnerReferralLink.findMany({
          where: {
            projectId,
            organizationId,
            OR: [{ childUserId: userId }, { referrerUserId: userId }]
          },
          select: { childUserId: true, referrerUserId: true }
        })
      ]);

      await tx.partnerReferralLink.deleteMany({
        where: {
          projectId,
          organizationId,
          OR: [{ childUserId: userId }, { referrerUserId: userId }]
        }
      });
      await tx.partnerOrganizationMembership.delete({
        where: { id: membership.id }
      });
      await tx.partnerOrganization.updateMany({
        where: { id: organizationId, projectId, directorUserId: userId },
        data: { directorUserId: null }
      });

      const removedParentsByChild = new Map<string, Set<string>>();
      for (const link of removedLinks) {
        const parentIds =
          removedParentsByChild.get(link.childUserId) ?? new Set<string>();
        parentIds.add(link.referrerUserId);
        removedParentsByChild.set(link.childUserId, parentIds);
      }
      for (const [childUserId, removedParentIds] of removedParentsByChild) {
        const child = await tx.user.findUnique({
          where: { id: childUserId },
          select: { referredBy: true, partnerParentId: true }
        });
        if (
          !child ||
          ((!child.referredBy || !removedParentIds.has(child.referredBy)) &&
            (!child.partnerParentId ||
              !removedParentIds.has(child.partnerParentId)))
        ) {
          continue;
        }
        const fallbackLink = await tx.partnerReferralLink.findFirst({
          where: { projectId, childUserId },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { referrerUserId: true }
        });
        await tx.user.update({
          where: { id: childUserId },
          data: {
            referredBy: fallbackLink?.referrerUserId ?? null,
            partnerParentId: fallbackLink?.referrerUserId ?? null
          }
        });
      }

      if (user?.organizationId === organizationId) {
        return tx.user.update({
          where: { id: userId },
          data: { organizationId: alternative?.organizationId ?? null }
        });
      }
      return tx.user.findUniqueOrThrow({ where: { id: userId } });
    });
    const compatibilityRole = deriveCompatibilityRole(
      await db.partnerOrganizationMembership.findMany({
        where: { projectId, userId },
        select: { level: true, canManage: true }
      })
    );
    await db.user.update({
      where: { id: userId },
      data: { partnerRole: compatibilityRole }
    });
    return result;
  }

  static async updateMember(
    projectId: string,
    organizationId: string,
    userId: string,
    input: Omit<OrganizationMemberInput, 'userId'>
  ) {
    const membership = await db.partnerOrganizationMembership.findFirst({
      where: { projectId, organizationId, userId },
      include: { user: true }
    });
    if (!membership) {
      throw new Error('Участник не найден в этой организации');
    }

    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');
    const outboundReferralPlanId =
      input.outboundReferralPlanId ??
      org.defaultReferralCommissionPlanId ??
      null;
    await this.validateOutboundPlan(projectId, outboundReferralPlanId);

    await db.partnerOrganizationMembership.update({
      where: { id: membership.id },
      data: {
        ...(input.level !== undefined
          ? { level: normalizeLevel(input.level) }
          : {}),
        ...(input.title !== undefined
          ? { title: normalizeTitle(input.title) }
          : {}),
        ...(input.canManage !== undefined ? { canManage: input.canManage } : {})
      }
    });

    const compatibilityRole = deriveCompatibilityRole(
      await db.partnerOrganizationMembership.findMany({
        where: { projectId, userId },
        select: { level: true, canManage: true }
      })
    );
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        partnerRole: compatibilityRole,
        outboundReferralPlanId
      }
    });

    const referralLinks = this.toReferralLinks(input);
    let attributionLocked = false;
    if (referralLinks !== undefined) {
      const primary =
        referralLinks.find((link) => link.isPrimary) ??
        referralLinks.find((link) => Number(link.sharePercent ?? 0) > 0) ??
        referralLinks[0] ??
        null;
      const assignment = await ReferrerAssignmentService.setReferrer({
        projectId,
        userId,
        referrerId: primary?.referrerId ?? null,
        organizationId
      });
      attributionLocked = assignment.attributionLocked;
      await PartnerReferralGraphService.replaceLinks({
        projectId,
        organizationId,
        childUserId: userId,
        links: referralLinks
      });
    }

    void PartnerNotificationService.notifyRoleOrOrgChanged({
      userId,
      projectId,
      newRole: compatibilityRole,
      organizationName: org.name
    });

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

    const [sourceMembership, targetOrganization, user] = await Promise.all([
      db.partnerOrganizationMembership.findFirst({
        where: { projectId, organizationId: sourceOrganizationId, userId }
      }),
      db.partnerOrganization.findFirst({
        where: { id: targetOrganizationId, projectId },
        select: { id: true, name: true }
      }),
      db.user.findFirst({ where: { id: userId, projectId } })
    ]);
    if (!sourceMembership) {
      throw new Error('Участник не найден в исходной организации');
    }
    if (!targetOrganization) {
      throw new Error('Целевая организация не найдена');
    }
    if (!user) throw new Error('Пользователь не найден');

    await db.partnerOrganizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: targetOrganizationId,
          userId
        }
      },
      update: {
        level: sourceMembership.level,
        title: sourceMembership.title,
        canManage: sourceMembership.canManage
      },
      create: {
        projectId,
        organizationId: targetOrganizationId,
        userId,
        level: sourceMembership.level,
        title: sourceMembership.title,
        canManage: sourceMembership.canManage
      }
    });
    await this.removeMember(projectId, sourceOrganizationId, userId);

    void PartnerNotificationService.notifyRoleOrOrgChanged({
      userId,
      projectId,
      newRole: user.partnerRole,
      organizationName: targetOrganization.name
    });

    return { user, attributionLocked: false };
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
          firstPurchaseDiscountPercent: input.firstPurchaseDiscountPercent ?? 0,
          defaultReferralCommissionPlanId:
            input.defaultReferralCommissionPlanId || null,
          directorUserId: input.directorUserId || null
        }
      });

      if (input.directorUserId) {
        await tx.partnerOrganizationMembership.create({
          data: {
            projectId: input.projectId,
            organizationId: org.id,
            userId: input.directorUserId,
            canManage: true
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
        await tx.partnerOrganizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId,
              userId: data.directorUserId
            }
          },
          update: { canManage: true },
          create: {
            projectId,
            organizationId,
            userId: data.directorUserId,
            canManage: true
          }
        });
      }

      return updated;
    });
  }

  static async delete(projectId: string, organizationId: string) {
    const org = await this.getById(projectId, organizationId);
    if (!org) throw new Error('Организация не найдена');

    const memberships = await db.partnerOrganizationMembership.findMany({
      where: { projectId, organizationId },
      select: { userId: true }
    });
    for (const membership of memberships) {
      await this.removeMember(projectId, organizationId, membership.userId);
    }
    await db.partnerOrganization.delete({ where: { id: organizationId } });

    return { success: true };
  }

  static async assignUserToOrganization(
    projectId: string,
    userId: string,
    organizationId: string | null
  ) {
    const user = await db.user.findFirst({
      where: { id: userId, projectId },
      select: { id: true, organizationId: true, partnerRole: true }
    });
    if (!user) throw new Error('Пользователь не найден');

    if (organizationId) {
      const org = await this.getById(projectId, organizationId);
      if (!org) throw new Error('Организация не найдена');
      await db.partnerOrganizationMembership.upsert({
        where: { organizationId_userId: { organizationId, userId } },
        update: {},
        create: {
          projectId,
          organizationId,
          userId,
          level: null
        }
      });
      if (!user.organizationId) {
        return db.user.update({
          where: { id: userId },
          data: { organizationId }
        });
      }
      return db.user.findUniqueOrThrow({ where: { id: userId } });
    }

    if (user.organizationId) {
      await this.removeMember(projectId, user.organizationId, userId);
    }
    return db.user.findUniqueOrThrow({ where: { id: userId } });
  }

  static async getStats(
    projectId: string,
    organizationId: string,
    since?: Date | null
  ): Promise<OrganizationStats> {
    const memberships = await db.partnerOrganizationMembership.findMany({
      where: { projectId, organizationId },
      include: {
        user: {
          select: { partnerRole: true, totalPurchases: true, id: true }
        }
      }
    });
    const members = memberships.map((membership) => membership.user);
    const participants = memberships.filter(
      (membership) => membership.level !== null
    ).length;
    const managers = memberships.filter(
      (membership) => membership.canManage
    ).length;
    const clients = memberships.filter(
      (membership) => membership.level === null
    ).length;

    const userIds = members.map((member) => member.id);
    let commissionEarned = 0;
    if (userIds.length > 0) {
      const [transactions, attributions] = await Promise.all([
        db.transaction.findMany({
          where: {
            referralUserId: { in: userIds },
            type: 'EARN',
            isReferralBonus: true,
            ...(since ? { createdAt: { gte: since } } : {})
          },
          select: { amount: true, referralUserId: true, metadata: true }
        }),
        db.referralAttribution.findMany({
          where: { projectId, userId: { in: userIds } },
          select: { userId: true, organizationId: true }
        })
      ]);
      const attributionOrganization = new Map(
        attributions.map((attribution) => [
          attribution.userId,
          attribution.organizationId
        ])
      );
      commissionEarned = transactions.reduce((sum, transaction) => {
        const metadata =
          transaction.metadata &&
          typeof transaction.metadata === 'object' &&
          !Array.isArray(transaction.metadata)
            ? (transaction.metadata as Record<string, unknown>)
            : null;
        const recordedOrganizationId =
          typeof metadata?.referralOrganizationId === 'string'
            ? metadata.referralOrganizationId
            : null;
        const attributedOrganizationId = transaction.referralUserId
          ? attributionOrganization.get(transaction.referralUserId)
          : null;
        return recordedOrganizationId === organizationId ||
          (!recordedOrganizationId &&
            attributedOrganizationId === organizationId)
          ? sum + Number(transaction.amount)
          : sum;
      }, 0);
    }

    return {
      members: members.length,
      trainers: participants,
      managers,
      directors: managers,
      clients,
      totalPurchases: members.reduce(
        (sum, member) => sum + Number(member.totalPurchases ?? 0),
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
      const membership = await db.partnerOrganizationMembership.findFirst({
        where: { projectId, userId: referrerId },
        orderBy: [{ canManage: 'desc' }, { createdAt: 'asc' }],
        select: { organizationId: true }
      });
      if (membership) return membership.organizationId;

      const referrer = await db.user.findFirst({
        where: { id: referrerId, projectId },
        select: { organizationId: true }
      });
      if (referrer?.organizationId) return referrer.organizationId;
    }

    return null;
  }
}
