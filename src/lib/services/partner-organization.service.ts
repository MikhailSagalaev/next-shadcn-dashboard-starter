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
import { OrganizationFinancialMetricsService } from './organization-financial-metrics.service';

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
  levels: Array<{ level: number; count: number }>;
  managers: number;
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
  private static async recomputeCompatibilityRole(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string
  ): Promise<PartnerRole> {
    const memberships = await tx.partnerOrganizationMembership.findMany({
      where: { projectId, userId },
      select: { level: true, canManage: true }
    });
    const partnerRole = deriveCompatibilityRole(memberships);
    await tx.user.update({ where: { id: userId }, data: { partnerRole } });
    return partnerRole;
  }

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
            registeredAt: true,
            totalPurchases: true,
            organizationId: true,
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
            select: {
              userId: true,
              referrerId: true,
              organizationId: true,
              commissionPlanId: true
            }
          })
        : Promise.resolve([])
    ]);
    const legacyOrgByUserId = new Map(
      memberships.map((membership) => [
        membership.userId,
        membership.user.organizationId
      ])
    );
    const scopedAttributions = attributions.filter(
      (attribution) =>
        (attribution.organizationId ??
          legacyOrgByUserId.get(attribution.userId) ??
          null) === organizationId
    );

    const linksByChild = new Map<string, typeof links>();
    const linksByReferrer = new Map<string, typeof links>();
    for (const link of links) {
      const childLinks = linksByChild.get(link.childUserId) ?? [];
      childLinks.push(link);
      linksByChild.set(link.childUserId, childLinks);
      const referralLinks = linksByReferrer.get(link.referrerUserId) ?? [];
      referralLinks.push(link);
      linksByReferrer.set(link.referrerUserId, referralLinks);
    }

    const attributionByUserId = new Map(
      scopedAttributions.map((attribution) => [
        attribution.userId,
        attribution.commissionPlanId
      ])
    );
    const planIds = [
      ...new Set(
        memberships
          .flatMap((membership) => [
            membership.outboundReferralPlanId,
            attributionByUserId.get(membership.userId)
          ])
          .concat(org.defaultReferralCommissionPlanId)
          .filter((id): id is string => Boolean(id))
      )
    ];
    const invitedByIds = [
      ...new Set(
        scopedAttributions.map((attribution) => attribution.referrerId)
      )
    ];
    const [plans, invitedByUsers, financialMetrics] = await Promise.all([
      planIds.length > 0
        ? db.referralCommissionPlan.findMany({
            where: { id: { in: planIds }, projectId },
            select: { id: true, name: true }
          })
        : Promise.resolve([]),
      invitedByIds.length > 0
        ? db.user.findMany({
            where: { projectId, id: { in: invitedByIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          })
        : Promise.resolve([]),
      OrganizationFinancialMetricsService.getMany({
        projectId,
        organizationId,
        subjects: memberships.map((membership) => ({
          id: membership.userId,
          totalPurchases: membership.user.totalPurchases,
          legacyOrganizationId: membership.user.organizationId
        }))
      })
    ]);
    const planMap = new Map(plans.map((plan) => [plan.id, plan.name]));
    const invitedByUserMap = new Map(
      invitedByUsers.map((user) => [user.id, user])
    );
    const attributionByUser = new Map(
      scopedAttributions.map((attribution) => [attribution.userId, attribution])
    );
    const memberById = new Map(
      memberships.map((membership) => [membership.userId, membership.user])
    );

    return memberships.map((membership) => {
      const user = membership.user;
      const memberLinks = linksByChild.get(user.id) ?? [];
      const primaryLink =
        memberLinks.find((link) => link.isPrimary) ?? memberLinks[0] ?? null;
      const attribution = attributionByUser.get(user.id);
      const invitedByUser = attribution
        ? invitedByUserMap.get(attribution.referrerId)
        : null;
      const directReferrals = (linksByReferrer.get(user.id) ?? [])
        .map((link) => memberById.get(link.childUserId))
        .filter((child): child is NonNullable<typeof child> => Boolean(child))
        .map((child) => ({ id: child.id, name: displayName(child) }));
      const metric = financialMetrics.get(user.id) ?? {
        totalPurchases: 0,
        referralBonusEarned: 0
      };
      return {
        id: user.id,
        name: displayName(user),
        email: user.email,
        phone: user.phone,
        partnerRole: user.partnerRole,
        level: membership.level,
        title: membership.title,
        canManage: membership.canManage,
        referredBy: primaryLink?.referrerUserId ?? null,
        referrerName: primaryLink ? displayName(primaryLink.referrer) : null,
        referrerLinks: memberLinks.map((link) => ({
          referrerId: link.referrerUserId,
          referrerName: displayName(link.referrer),
          sharePercent: Number(link.sharePercent),
          isPrimary: link.isPrimary
        })),
        outboundReferralPlanId: membership.outboundReferralPlanId,
        outboundPlanName:
          planMap.get(
            membership.outboundReferralPlanId ??
              org.defaultReferralCommissionPlanId ??
              ''
          ) ?? null,
        outboundPlanInherited:
          !membership.outboundReferralPlanId &&
          Boolean(org.defaultReferralCommissionPlanId),
        attributionPlanName: attributionByUserId.get(user.id)
          ? (planMap.get(attributionByUserId.get(user.id)!) ?? null)
          : null,
        invitedById: attribution?.referrerId ?? null,
        invitedByName: invitedByUser ? displayName(invitedByUser) : null,
        directReferrals,
        joinedAt: membership.createdAt.toISOString(),
        registeredAt: user.registeredAt.toISOString(),
        totalPurchases: metric.totalPurchases,
        referralBonusEarned: metric.referralBonusEarned,
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

    const outboundReferralPlanId = input.outboundReferralPlanId ?? null;
    await this.validateOutboundPlan(projectId, outboundReferralPlanId);
    const level = normalizeLevel(input.level);

    const { updated, compatibilityRole } = await db.$transaction(async (tx) => {
      const existing = await tx.partnerOrganizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: input.userId }
        },
        select: { id: true }
      });
      if (existing) {
        throw new Error('Пользователь уже состоит в этой организации');
      }

      await tx.partnerOrganizationMembership.create({
        data: {
          projectId,
          organizationId,
          userId: input.userId,
          level,
          title: normalizeTitle(input.title) ?? null,
          canManage: input.canManage ?? false,
          // null means true inheritance from the organization default.
          outboundReferralPlanId
        }
      });

      const compatibilityRole = await this.recomputeCompatibilityRole(
        tx,
        projectId,
        input.userId
      );
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: {
          ...(user.organizationId ? {} : { organizationId }),
          ...(!user.organizationId || user.organizationId === organizationId
            ? { outboundReferralPlanId }
            : {})
        }
      });
      return { updated, compatibilityRole };
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
          select: { organizationId: true, outboundReferralPlanId: true }
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

      const compatibilityRole = await this.recomputeCompatibilityRole(
        tx,
        projectId,
        userId
      );
      return tx.user.update({
        where: { id: userId },
        data: {
          partnerRole: compatibilityRole,
          ...(user?.organizationId === organizationId
            ? {
                organizationId: alternative?.organizationId ?? null,
                outboundReferralPlanId:
                  alternative?.outboundReferralPlanId ?? null
              }
            : {})
        }
      });
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
      input.outboundReferralPlanId === undefined
        ? membership.outboundReferralPlanId
        : input.outboundReferralPlanId;
    await this.validateOutboundPlan(projectId, outboundReferralPlanId);

    const { updated, compatibilityRole } = await db.$transaction(async (tx) => {
      await tx.partnerOrganizationMembership.update({
        where: { id: membership.id },
        data: {
          ...(input.level !== undefined
            ? { level: normalizeLevel(input.level) }
            : {}),
          ...(input.title !== undefined
            ? { title: normalizeTitle(input.title) }
            : {}),
          ...(input.canManage !== undefined
            ? { canManage: input.canManage }
            : {}),
          outboundReferralPlanId
        }
      });

      const compatibilityRole = await this.recomputeCompatibilityRole(
        tx,
        projectId,
        userId
      );
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(membership.user.organizationId === organizationId
            ? { outboundReferralPlanId }
            : {})
        }
      });
      return { updated, compatibilityRole };
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

    const result = await db.$transaction(async (tx) => {
      const [sourceMembership, targetOrganization, targetMembership, user] =
        await Promise.all([
          tx.partnerOrganizationMembership.findFirst({
            where: { projectId, organizationId: sourceOrganizationId, userId }
          }),
          tx.partnerOrganization.findFirst({
            where: { id: targetOrganizationId, projectId },
            select: { id: true, name: true }
          }),
          tx.partnerOrganizationMembership.findUnique({
            where: {
              organizationId_userId: {
                organizationId: targetOrganizationId,
                userId
              }
            },
            select: { id: true }
          }),
          tx.user.findFirst({
            where: { id: userId, projectId },
            select: { id: true, organizationId: true }
          })
        ]);
      if (!sourceMembership) {
        throw new Error('Участник не найден в исходной организации');
      }
      if (!targetOrganization) {
        throw new Error('Целевая организация не найдена');
      }
      if (targetMembership) {
        throw new Error('Пользователь уже состоит в целевой организации');
      }
      if (!user) throw new Error('Пользователь не найден');

      await tx.partnerOrganizationMembership.create({
        data: {
          projectId,
          organizationId: targetOrganizationId,
          userId,
          level: sourceMembership.level,
          title: sourceMembership.title,
          canManage: sourceMembership.canManage,
          // A transfer adopts the target organization's default dynamically.
          outboundReferralPlanId: null
        }
      });
      await tx.partnerReferralLink.deleteMany({
        where: {
          projectId,
          organizationId: sourceOrganizationId,
          OR: [{ childUserId: userId }, { referrerUserId: userId }]
        }
      });
      await tx.partnerOrganizationMembership.delete({
        where: { id: sourceMembership.id }
      });
      await tx.partnerOrganization.updateMany({
        where: {
          id: sourceOrganizationId,
          projectId,
          directorUserId: userId
        },
        data: { directorUserId: null }
      });

      const compatibilityRole = await this.recomputeCompatibilityRole(
        tx,
        projectId,
        userId
      );
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(user.organizationId === sourceOrganizationId
            ? {
                organizationId: targetOrganizationId,
                outboundReferralPlanId: null
              }
            : {})
        }
      });

      return {
        user: { id: userId },
        compatibilityRole,
        targetOrganizationName: targetOrganization.name,
        attributionLocked: false
      };
    });

    void PartnerNotificationService.notifyRoleOrOrgChanged({
      userId,
      projectId,
      newRole: result.compatibilityRole,
      organizationName: result.targetOrganizationName
    });

    return {
      user: result.user,
      attributionLocked: result.attributionLocked
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
            canManage: true,
            outboundReferralPlanId: null
          }
        });
        await tx.user.updateMany({
          where: { id: input.directorUserId, organizationId: null },
          data: { organizationId: org.id, outboundReferralPlanId: null }
        });
        await this.recomputeCompatibilityRole(
          tx,
          input.projectId,
          input.directorUserId
        );
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

      if (
        data.directorUserId !== undefined &&
        data.directorUserId !== org.directorUserId
      ) {
        if (org.directorUserId) {
          await tx.partnerOrganizationMembership.updateMany({
            where: {
              projectId,
              organizationId,
              userId: org.directorUserId
            },
            data: { canManage: false }
          });
          await this.recomputeCompatibilityRole(
            tx,
            projectId,
            org.directorUserId
          );
        }

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
              canManage: true,
              outboundReferralPlanId: null
            }
          });
          await tx.user.updateMany({
            where: { id: data.directorUserId, organizationId: null },
            data: { organizationId, outboundReferralPlanId: null }
          });
          await this.recomputeCompatibilityRole(
            tx,
            projectId,
            data.directorUserId
          );
        }
      }

      return updated;
    });
  }

  static async delete(projectId: string, organizationId: string) {
    await db.$transaction(async (tx) => {
      const org = await tx.partnerOrganization.findFirst({
        where: { id: organizationId, projectId },
        select: { id: true }
      });
      if (!org) throw new Error('Организация не найдена');

      const memberships = await tx.partnerOrganizationMembership.findMany({
        where: { projectId, organizationId },
        select: { userId: true }
      });
      const affectedUserIds = [
        ...new Set(memberships.map((item) => item.userId))
      ];

      await tx.partnerOrganization.delete({ where: { id: organizationId } });

      for (const userId of affectedUserIds) {
        const [user, alternative] = await Promise.all([
          tx.user.findUnique({
            where: { id: userId },
            select: { organizationId: true }
          }),
          tx.partnerOrganizationMembership.findFirst({
            where: { projectId, userId },
            orderBy: [{ canManage: 'desc' }, { createdAt: 'asc' }],
            select: { organizationId: true, outboundReferralPlanId: true }
          })
        ]);
        const partnerRole = await this.recomputeCompatibilityRole(
          tx,
          projectId,
          userId
        );
        await tx.user.update({
          where: { id: userId },
          data: {
            partnerRole,
            ...(user?.organizationId === organizationId
              ? {
                  organizationId: alternative?.organizationId ?? null,
                  outboundReferralPlanId:
                    alternative?.outboundReferralPlanId ?? null
                }
              : {})
          }
        });
      }
    });

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
          select: {
            partnerRole: true,
            totalPurchases: true,
            organizationId: true,
            id: true
          }
        }
      }
    });
    const members = memberships.map((membership) => membership.user);
    const levelCounts = new Map<number, number>();
    for (const membership of memberships) {
      if (membership.level !== null) {
        levelCounts.set(
          membership.level,
          (levelCounts.get(membership.level) ?? 0) + 1
        );
      }
    }
    const managers = memberships.filter(
      (membership) => membership.canManage
    ).length;
    const clients = memberships.filter(
      (membership) => membership.level === null && !membership.canManage
    ).length;
    const financialMetrics = await OrganizationFinancialMetricsService.getMany({
      projectId,
      organizationId,
      since,
      subjects: members.map((member) => ({
        id: member.id,
        totalPurchases: member.totalPurchases,
        legacyOrganizationId: member.organizationId
      }))
    });
    const totals = [...financialMetrics.values()].reduce(
      (result, metric) => ({
        totalPurchases: result.totalPurchases + metric.totalPurchases,
        commissionEarned: result.commissionEarned + metric.referralBonusEarned
      }),
      { totalPurchases: 0, commissionEarned: 0 }
    );

    return {
      members: members.length,
      levels: [...levelCounts.entries()]
        .sort(([left], [right]) => left - right)
        .map(([level, count]) => ({ level, count })),
      managers,
      clients,
      totalPurchases: totals.totalPurchases,
      commissionEarned: totals.commissionEarned
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
