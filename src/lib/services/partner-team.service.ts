/**
 * @file: partner-team.service.ts
 * @description: Управление командой партнёра — просмотр, добавление, удаление, заявки на вступление
 * @project: SaaS Bonus System
 * @created: 2026-06-07
 */

import type { PartnerRole } from '@prisma/client';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PartnerOrganizationService } from './partner-organization.service';
import { PartnerNotificationService } from './partner-notification.service';
import { AdminNotificationService } from './admin-notification.service';
import { ReferralCommissionService } from './referral-commission.service';
import { PartnerReferralGraphService } from './partner-referral-graph.service';

export type TeamListFilter = 'direct' | 'clients' | 'partners' | 'all';

const ROLE_RANK: Record<PartnerRole, number> = {
  CLIENT: 0,
  TRAINER: 1,
  MANAGER: 2,
  DIRECTOR: 3
};

export type TeamMemberRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  partnerRole: string;
  organizationLevel: number | null;
  organizationTitle: string | null;
  canManageOrganization: boolean;
  registeredAt: string;
  isDirect: boolean;
  totalPurchases: number;
  commissionEarned: number;
};

export type OrgHierarchyWarning = {
  code: string;
  message: string;
  userId?: string;
  userName?: string;
};

function displayName(u: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  id: string;
}): string {
  const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return full || u.email || u.phone || u.id.slice(0, 8);
}

export class PartnerTeamService {
  static async getProjectPartnerFlags(projectId: string) {
    return db.project.findUnique({
      where: { id: projectId },
      select: {
        enablePartnerRoles: true,
        enablePartnerTeamManagement: true,
        referralJoinRequiresApproval: true
      }
    });
  }

  static async canManageSubject(
    projectId: string,
    viewerUserId: string,
    subjectUserId: string
  ): Promise<boolean> {
    if (!projectId || !viewerUserId || !subjectUserId) return false;
    if (viewerUserId === subjectUserId) return false;

    const project = await this.getProjectPartnerFlags(projectId);
    if (!project?.enablePartnerRoles || !project.enablePartnerTeamManagement) {
      return false;
    }

    const managedMembership = await db.partnerOrganizationMembership.findFirst({
      where: {
        projectId,
        userId: viewerUserId,
        canManage: true,
        organization: {
          memberships: { some: { userId: subjectUserId } }
        }
      },
      select: { id: true }
    });
    if (managedMembership) return true;

    const [viewer, subject] = await Promise.all([
      db.user.findFirst({
        where: { id: viewerUserId, projectId },
        select: { partnerRole: true, organizationId: true }
      }),
      db.user.findFirst({
        where: { id: subjectUserId, projectId },
        select: { partnerRole: true, organizationId: true }
      })
    ]);

    if (!viewer || !subject) return false;
    if (viewer.partnerRole === 'CLIENT') return false;
    if (ROLE_RANK[viewer.partnerRole] <= ROLE_RANK[subject.partnerRole]) {
      return false;
    }

    if (
      viewer.organizationId &&
      subject.organizationId &&
      viewer.organizationId !== subject.organizationId
    ) {
      return false;
    }

    return ReferralCommissionService.canViewSubject(
      projectId,
      viewerUserId,
      subjectUserId
    );
  }

  static async canInviteUser(
    projectId: string,
    viewerUserId: string,
    targetUserId: string,
    targetRole: PartnerRole = 'TRAINER'
  ): Promise<boolean> {
    if (viewerUserId === targetUserId) return false;

    const project = await this.getProjectPartnerFlags(projectId);
    if (!project?.enablePartnerRoles || !project.enablePartnerTeamManagement) {
      return false;
    }

    const managedMembership = await db.partnerOrganizationMembership.findFirst({
      where: { projectId, userId: viewerUserId, canManage: true },
      select: { organizationId: true }
    });
    if (managedMembership) {
      const targetMembership =
        await db.partnerOrganizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: managedMembership.organizationId,
              userId: targetUserId
            }
          },
          select: { id: true }
        });
      return !targetMembership;
    }

    const [viewer, target] = await Promise.all([
      db.user.findFirst({
        where: { id: viewerUserId, projectId },
        select: { partnerRole: true, organizationId: true }
      }),
      db.user.findFirst({
        where: { id: targetUserId, projectId },
        select: { partnerRole: true, organizationId: true, referredBy: true }
      })
    ]);

    if (!viewer || !target) return false;
    if (!['MANAGER', 'DIRECTOR'].includes(viewer.partnerRole)) return false;
    if (target.referredBy) return false;

    if (viewer.partnerRole === 'MANAGER' && targetRole !== 'TRAINER') {
      return false;
    }

    if (
      viewer.organizationId &&
      target.organizationId &&
      target.organizationId !== viewer.organizationId
    ) {
      return false;
    }

    return true;
  }

  static async canReviewJoinRequest(
    projectId: string,
    reviewerUserId: string,
    referrerId: string,
    organizationId: string | null
  ): Promise<boolean> {
    const project = await this.getProjectPartnerFlags(projectId);
    if (!project?.enablePartnerRoles || !project.enablePartnerTeamManagement) {
      return false;
    }

    const [reviewer, referrer] = await Promise.all([
      db.user.findFirst({
        where: { id: reviewerUserId, projectId, isActive: true },
        select: { partnerRole: true, organizationId: true }
      }),
      db.user.findFirst({
        where: { id: referrerId, projectId, isActive: true },
        select: { partnerRole: true, organizationId: true, referredBy: true }
      })
    ]);
    if (!reviewer) return false;

    if (organizationId) {
      const managedMembership =
        await db.partnerOrganizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: reviewerUserId
            }
          },
          select: { canManage: true }
        });
      if (managedMembership?.canManage) return true;
    }

    // A referrer can review only if they are an actual B2B partner.
    if (reviewerUserId === referrerId)
      return referrer?.partnerRole !== 'CLIENT';
    if (reviewer.partnerRole === 'CLIENT') return false;

    if (
      reviewer.partnerRole === 'DIRECTOR' &&
      organizationId &&
      reviewer.organizationId === organizationId
    ) {
      return true;
    }

    if (reviewer.partnerRole === 'MANAGER') {
      if (referrer?.referredBy === reviewerUserId) return true;
    }

    return false;
  }

  static async listTeam(params: {
    projectId: string;
    viewerUserId: string;
    filter?: TeamListFilter;
    page?: number;
    pageSize?: number;
  }) {
    const {
      projectId,
      viewerUserId,
      filter = 'direct',
      page = 1,
      pageSize = 10
    } = params;

    const { directIds, allIds: allDescendantIds } =
      await PartnerReferralGraphService.getVisibleTeamIds(
        projectId,
        viewerUserId
      );
    const directRows = await db.user.findMany({
      where: { projectId, id: { in: directIds } },
      select: { id: true, partnerRole: true }
    });

    let targetIds: string[];
    switch (filter) {
      case 'clients':
        targetIds = directRows
          .filter((p) => p.partnerRole === 'CLIENT')
          .map((p) => p.id);
        break;
      case 'partners': {
        const profiles = await db.user.findMany({
          where: {
            projectId,
            id: { in: allDescendantIds },
            partnerRole: { in: ['TRAINER', 'MANAGER'] }
          },
          select: { id: true }
        });
        targetIds = profiles.map((p) => p.id);
        break;
      }
      case 'all':
        targetIds = allDescendantIds;
        break;
      case 'direct':
      default:
        targetIds = directIds;
        break;
    }

    const total = targetIds.length;
    const start = (page - 1) * pageSize;
    const pageIds = targetIds.slice(start, start + pageSize);
    const directSet = new Set(directIds);

    if (pageIds.length === 0) {
      return { items: [] as TeamMemberRow[], total, page, pageSize };
    }

    const [profiles, memberships] = await Promise.all([
      db.user.findMany({
        where: { projectId, id: { in: pageIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          partnerRole: true,
          registeredAt: true,
          totalPurchases: true
        }
      }),
      db.partnerOrganizationMembership.findMany({
        where: { projectId, userId: { in: pageIds } },
        orderBy: [{ canManage: 'desc' }, { level: 'desc' }],
        select: {
          userId: true,
          level: true,
          title: true,
          canManage: true
        }
      })
    ]);

    const commissionAgg = await db.transaction.groupBy({
      by: ['referralUserId'],
      where: {
        userId: viewerUserId,
        type: 'EARN',
        isReferralBonus: true,
        referralUserId: { in: pageIds }
      },
      _sum: { amount: true }
    });
    const commissionByReferral = new Map<string, number>();
    for (const row of commissionAgg) {
      if (row.referralUserId) {
        commissionByReferral.set(
          row.referralUserId,
          Number(row._sum.amount ?? 0)
        );
      }
    }

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const membershipByUserId = new Map<string, (typeof memberships)[number]>();
    for (const membership of memberships) {
      if (!membershipByUserId.has(membership.userId)) {
        membershipByUserId.set(membership.userId, membership);
      }
    }
    const items: TeamMemberRow[] = [];
    for (const id of pageIds) {
      const p = profileById.get(id);
      if (!p) continue;
      const membership = membershipByUserId.get(id);
      items.push({
        id: p.id,
        name: displayName(p),
        email: p.email,
        phone: p.phone,
        partnerRole: p.partnerRole,
        organizationLevel: membership?.level ?? null,
        organizationTitle: membership?.title ?? null,
        canManageOrganization: membership?.canManage ?? false,
        registeredAt: p.registeredAt.toISOString(),
        isDirect: directSet.has(p.id),
        totalPurchases: Number(p.totalPurchases ?? 0),
        commissionEarned: commissionByReferral.get(p.id) ?? 0
      });
    }

    return { items, total, page, pageSize };
  }

  static async addToTeam(params: {
    projectId: string;
    managerUserId: string;
    targetUserId: string;
    partnerRole?: PartnerRole;
  }) {
    const partnerRole = params.partnerRole ?? 'TRAINER';
    const allowed = await this.canInviteUser(
      params.projectId,
      params.managerUserId,
      params.targetUserId,
      partnerRole
    );
    if (!allowed) {
      throw new Error('Нет прав добавить этого пользователя в команду');
    }

    const [manager, managedMembership] = await Promise.all([
      db.user.findFirst({
        where: { id: params.managerUserId, projectId: params.projectId },
        select: { organizationId: true }
      }),
      db.partnerOrganizationMembership.findFirst({
        where: {
          projectId: params.projectId,
          userId: params.managerUserId,
          canManage: true
        },
        select: { organizationId: true }
      })
    ]);
    const organizationId =
      managedMembership?.organizationId ?? manager?.organizationId ?? null;

    const updated = organizationId
      ? (
          await PartnerOrganizationService.addMember(
            params.projectId,
            organizationId,
            {
              userId: params.targetUserId,
              partnerRole,
              referrerLinks: [
                {
                  referrerId: params.managerUserId,
                  sharePercent: 100,
                  isPrimary: true
                }
              ]
            }
          )
        ).user
      : await db.user.update({
          where: { id: params.targetUserId },
          data: {
            referredBy: params.managerUserId,
            partnerRole
          }
        });

    try {
      await ReferralCommissionService.syncAttributionForInvitedUser({
        invitedUserId: params.targetUserId,
        projectId: params.projectId,
        referrerId: params.managerUserId,
        organizationId
      });
    } catch (err) {
      logger.warn('addToTeam: attribution sync failed', { err });
    }

    void PartnerNotificationService.notifyAncestorsAboutNewMember(
      params.targetUserId,
      params.projectId
    );

    return updated;
  }

  static async removeFromTeam(params: {
    projectId: string;
    managerUserId: string;
    subjectUserId: string;
  }) {
    const allowed = await this.canManageSubject(
      params.projectId,
      params.managerUserId,
      params.subjectUserId
    );
    if (!allowed) {
      throw new Error('Нет прав убрать этого участника из команды');
    }

    const links = await db.partnerReferralLink.findMany({
      where: {
        projectId: params.projectId,
        childUserId: params.subjectUserId,
        referrerUserId: params.managerUserId
      },
      select: { organizationId: true }
    });

    for (const link of links) {
      const remaining = await db.partnerReferralLink.findMany({
        where: {
          projectId: params.projectId,
          organizationId: link.organizationId,
          childUserId: params.subjectUserId,
          referrerUserId: { not: params.managerUserId }
        },
        select: {
          referrerUserId: true,
          sharePercent: true,
          isPrimary: true
        }
      });
      await PartnerReferralGraphService.replaceLinks({
        projectId: params.projectId,
        organizationId: link.organizationId,
        childUserId: params.subjectUserId,
        links: remaining.map((remainingLink) => ({
          referrerId: remainingLink.referrerUserId,
          sharePercent: Number(remainingLink.sharePercent),
          isPrimary: remainingLink.isPrimary
        }))
      });
    }

    if (links.length === 0) {
      return db.user.update({
        where: { id: params.subjectUserId },
        data: { referredBy: null, partnerParentId: null }
      });
    }
    return db.user.findUniqueOrThrow({
      where: { id: params.subjectUserId }
    });
  }

  static async createJoinRequest(params: {
    projectId: string;
    userId: string;
    referrerId: string;
    organizationId?: string | null;
  }) {
    const existing = await db.partnerJoinRequest.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: params.userId
        }
      }
    });

    if (existing?.status === 'PENDING') return existing;

    const request = existing
      ? await db.partnerJoinRequest.update({
          where: { id: existing.id },
          data: {
            referrerId: params.referrerId,
            organizationId: params.organizationId ?? null,
            status: 'PENDING',
            reviewedBy: null,
            reviewedAt: null,
            rejectReason: null
          }
        })
      : await db.partnerJoinRequest.create({
          data: {
            projectId: params.projectId,
            userId: params.userId,
            referrerId: params.referrerId,
            organizationId: params.organizationId ?? null,
            status: 'PENDING'
          }
        });

    void PartnerNotificationService.notifyJoinRequestPending(
      request.id,
      params.projectId
    );

    // In-app уведомление владельцу проекта (колокольчик). Fire-and-forget:
    // сбой уведомления не должен ломать создание заявки на вступление.
    void AdminNotificationService.notifyProjectOwner(params.projectId, {
      type: 'referral_join_request',
      severity: 'warning',
      title: 'Заявка на вступление в команду',
      message: 'Пользователь хочет присоединиться к команде.',
      link: `/dashboard/projects/${params.projectId}/referral?tab=hierarchy`,
      metadata: {
        requestId: request.id,
        userId: params.userId,
        referrerId: params.referrerId
      }
    }).catch((err) =>
      logger.error(
        'Failed to create admin notification (referral_join_request)',
        {
          projectId: params.projectId,
          requestId: request.id,
          error: err instanceof Error ? err.message : String(err)
        }
      )
    );

    return request;
  }

  static async listPendingRequestsForReviewer(
    projectId: string,
    reviewerUserId: string
  ) {
    const pending = await db.partnerJoinRequest.findMany({
      where: { projectId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const filtered = [];
    for (const req of pending) {
      const ok = await this.canReviewJoinRequest(
        projectId,
        reviewerUserId,
        req.referrerId,
        req.organizationId
      );
      if (ok) filtered.push(req);
    }

    if (filtered.length === 0) return [];

    const userIds = [
      ...new Set(filtered.flatMap((r) => [r.userId, r.referrerId]))
    ];
    const users = await db.user.findMany({
      where: { id: { in: userIds }, projectId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true
      }
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return filtered.map((r) => ({
      ...r,
      user: userById.get(r.userId),
      referrer: userById.get(r.referrerId)
    }));
  }

  /**
   * Все заявки проекта для админ-дашборда — без фильтра `canReviewJoinRequest`,
   * потому что доступ уже проверен на уровне API роута (админ проекта видит
   * всё, в отличие от партнёра, который видит только "свои" заявки).
   */
  static async listJoinRequestsForAdmin(
    projectId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' = 'PENDING'
  ) {
    const requests = await db.partnerJoinRequest.findMany({
      where: { projectId, status },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    if (requests.length === 0) return [];

    const userIds = [
      ...new Set(requests.flatMap((r) => [r.userId, r.referrerId]))
    ];
    const [users, orgs] = await Promise.all([
      db.user.findMany({
        where: { id: { in: userIds }, projectId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          partnerRole: true
        }
      }),
      db.partnerOrganization.findMany({
        where: {
          projectId,
          id: {
            in: [
              ...new Set(
                requests
                  .map((r) => r.organizationId)
                  .filter((id): id is string => Boolean(id))
              )
            ]
          }
        },
        select: { id: true, name: true }
      })
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    return requests.map((r) => ({
      ...r,
      user: userById.get(r.userId) ?? null,
      referrer: userById.get(r.referrerId) ?? null,
      organization: r.organizationId
        ? (orgById.get(r.organizationId) ?? null)
        : null
    }));
  }

  static resolveRoleOnJoinApproval(referrerRole: PartnerRole): PartnerRole {
    switch (referrerRole) {
      case 'DIRECTOR':
        return 'MANAGER';
      case 'MANAGER':
        return 'TRAINER';
      case 'TRAINER':
      default:
        return 'CLIENT';
    }
  }

  /**
   * @param params.adminOverride — одобрение из дашборда админом, а не самим
   *   партнёром через бота. Админ — не `User` в этом проекте (живёт в
   *   отдельной таблице), поэтому для него `canReviewJoinRequest` не
   *   применяется — доступ уже проверен на уровне API роута
   *   (`getCurrentAdmin` + `verifyProjectAccess`).
   */
  static async approveJoinRequest(params: {
    projectId: string;
    requestId: string;
    reviewerUserId: string;
    adminOverride?: boolean;
  }) {
    const request = await db.partnerJoinRequest.findFirst({
      where: { id: params.requestId, projectId: params.projectId }
    });
    if (!request || request.status !== 'PENDING') {
      throw new Error('Заявка не найдена или уже обработана');
    }

    if (!params.adminOverride) {
      const canReview = await this.canReviewJoinRequest(
        params.projectId,
        params.reviewerUserId,
        request.referrerId,
        request.organizationId
      );
      if (!canReview) throw new Error('Нет прав одобрить эту заявку');
    }

    const [referrer, applicant, project] = await Promise.all([
      db.user.findFirst({
        where: { id: request.referrerId, projectId: params.projectId },
        select: { partnerRole: true }
      }),
      db.user.findFirst({
        where: { id: request.userId, projectId: params.projectId },
        select: { partnerRole: true, organizationId: true }
      }),
      db.project.findUnique({
        where: { id: params.projectId },
        select: {
          referralPlansEnabled: true,
          defaultReferralCommissionPlanId: true
        }
      })
    ]);

    if (!referrer || !applicant) {
      throw new Error('Участник или пригласивший пользователь не найден');
    }

    const partnerRole =
      applicant?.partnerRole && applicant.partnerRole !== 'CLIENT'
        ? applicant.partnerRole
        : this.resolveRoleOnJoinApproval(referrer?.partnerRole ?? 'TRAINER');

    const commissionPlanId = project?.referralPlansEnabled
      ? await ReferralCommissionService.resolvePlanIdForNewReferral(
          params.projectId,
          request.referrerId,
          project.defaultReferralCommissionPlanId,
          request.organizationId
        )
      : null;

    // Claim the pending request and commit the hierarchy and attribution as one
    // unit. A competing approval can no longer leave a half-applied referral.
    await db.$transaction(async (tx) => {
      const claimed = await tx.partnerJoinRequest.updateMany({
        where: {
          id: request.id,
          projectId: params.projectId,
          status: 'PENDING'
        },
        data: {
          status: 'APPROVED',
          reviewedBy: params.reviewerUserId,
          reviewedAt: new Date()
        }
      });
      if (claimed.count !== 1) {
        throw new Error('Заявка уже обработана');
      }

      await tx.user.update({
        where: { id: request.userId },
        data: {
          referredBy: request.referrerId,
          partnerParentId: request.referrerId,
          partnerRole,
          ...(request.organizationId && !applicant.organizationId
            ? { organizationId: request.organizationId }
            : {})
        }
      });

      if (request.organizationId) {
        await tx.partnerOrganizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: request.organizationId,
              userId: request.referrerId
            }
          },
          update: {},
          create: {
            projectId: params.projectId,
            organizationId: request.organizationId,
            userId: request.referrerId
          }
        });
        await tx.partnerOrganizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: request.organizationId,
              userId: request.userId
            }
          },
          update: { level: ROLE_RANK[partnerRole] || null },
          create: {
            projectId: params.projectId,
            organizationId: request.organizationId,
            userId: request.userId,
            level: ROLE_RANK[partnerRole] || null
          }
        });
        await tx.partnerReferralLink.deleteMany({
          where: {
            projectId: params.projectId,
            organizationId: request.organizationId,
            childUserId: request.userId
          }
        });
        await tx.partnerReferralLink.create({
          data: {
            projectId: params.projectId,
            organizationId: request.organizationId,
            childUserId: request.userId,
            referrerUserId: request.referrerId,
            sharePercent: 100,
            isPrimary: true
          }
        });
      }

      if (commissionPlanId) {
        await tx.referralAttribution.upsert({
          where: { userId: request.userId },
          update: {},
          create: {
            userId: request.userId,
            projectId: params.projectId,
            referrerId: request.referrerId,
            commissionPlanId,
            organizationId: request.organizationId,
            locked: true
          }
        });
      }
    });

    void PartnerNotificationService.notifyAncestorsAboutNewMember(
      request.userId,
      params.projectId
    );
    void PartnerNotificationService.notifyApplicantAboutJoinDecision({
      userId: request.userId,
      projectId: params.projectId,
      approved: true,
      newRole: partnerRole
    });

    return { request, partnerRole };
  }

  static async rejectJoinRequest(params: {
    projectId: string;
    requestId: string;
    reviewerUserId: string;
    reason?: string;
    adminOverride?: boolean;
  }) {
    const request = await db.partnerJoinRequest.findFirst({
      where: { id: params.requestId, projectId: params.projectId }
    });
    if (!request || request.status !== 'PENDING') {
      throw new Error('Заявка не найдена или уже обработана');
    }

    if (!params.adminOverride) {
      const canReview = await this.canReviewJoinRequest(
        params.projectId,
        params.reviewerUserId,
        request.referrerId,
        request.organizationId
      );
      if (!canReview) throw new Error('Нет прав отклонить эту заявку');
    }

    const updated = await db.partnerJoinRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedBy: params.reviewerUserId,
        reviewedAt: new Date(),
        rejectReason: params.reason ?? null
      }
    });

    void PartnerNotificationService.notifyApplicantAboutJoinDecision({
      userId: request.userId,
      projectId: params.projectId,
      approved: false,
      rejectReason: params.reason ?? null
    });

    return updated;
  }

  static resolveDefaultReferrerForOrgMember(params: {
    partnerRole: PartnerRole;
    members: Array<{ id: string; partnerRole: string }>;
    directorUserId: string | null;
  }): string | null {
    const { partnerRole, members, directorUserId } = params;

    if (partnerRole === 'DIRECTOR') return null;
    if (partnerRole === 'MANAGER' && directorUserId) return directorUserId;

    // TRAINER и CLIENT, добавленные напрямую в сеть, без реферера остаются
    // "ничьими" — их покупки не генерируют комиссию никому в организации.
    // Поэтому обоим применяем тот же fallback: менеджер сети, иначе директор.
    if (partnerRole === 'TRAINER' || partnerRole === 'CLIENT') {
      const manager = members.find((m) => m.partnerRole === 'MANAGER');
      if (manager) return manager.id;
      if (directorUserId) return directorUserId;
    }

    return null;
  }

  static async validateOrganizationHierarchy(
    projectId: string,
    organizationId: string
  ): Promise<OrgHierarchyWarning[]> {
    const org = await PartnerOrganizationService.getById(
      projectId,
      organizationId
    );
    if (!org) return [];

    const members = await PartnerOrganizationService.listMembers(
      projectId,
      organizationId
    );
    const warnings: OrgHierarchyWarning[] = [];
    for (const member of members) {
      const totalShare = member.referrerLinks.reduce(
        (sum, link) => sum + link.sharePercent,
        0
      );
      if (totalShare > 100.001) {
        warnings.push({
          code: 'REFERRER_SHARE_OVERFLOW',
          message: `У участника «${member.name}» сумма долей рефереров больше 100%`,
          userId: member.id,
          userName: member.name
        });
      }
    }

    return warnings;
  }

  static async resolvePayoutChain(
    startReferrerId: string | null,
    projectId: string,
    depth: number
  ) {
    const chain: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      referredBy: string | null;
    }> = [];

    if (!startReferrerId) return chain;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { enablePartnerRoles: true }
    });

    let currentId: string | null = startReferrerId;
    const visited = new Set<string>();

    for (let level = 0; level < depth && currentId; level++) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const node = await db.user.findFirst({
        where: { id: currentId, projectId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          referredBy: true,
          partnerParentId: true,
          partnerRole: true,
          organizationId: true
        }
      });
      if (!node) break;

      chain.push(node);

      // Детерминированный обход явной платёжной ссылки (план 005).
      // `partnerParentId` — authoritative; `referredBy` — graceful fallback для
      // данных, ещё не прошедших backfill. НИКАКОГО угадывания менеджера по дате
      // регистрации: тот эвристический путь отправлял деньги не тому человеку в
      // организациях с несколькими менеджерами.
      const explicitParentId = node.partnerParentId ?? node.referredBy;
      if (explicitParentId && !visited.has(explicitParentId)) {
        currentId = explicitParentId;
        continue;
      }

      // Явной ссылки наверх нет. Если это партнёр, у которого родитель ОЖИДАЕТСЯ
      // (тренер/менеджер в организации), цепочка оборвана — делаем это видимым
      // (структурный warn), а не платим угаданному человеку.
      if (
        project?.enablePartnerRoles &&
        node.organizationId &&
        (node.partnerRole === 'TRAINER' || node.partnerRole === 'MANAGER')
      ) {
        logger.warn('payout chain broken: missing parent link', {
          projectId,
          userId: node.id,
          partnerRole: node.partnerRole,
          level,
          component: 'partner-team-service'
        });
      }

      break;
    }

    return chain.slice(0, depth);
  }

  static async linkReferralWithPolicy(params: {
    userId: string;
    projectId: string;
    referrerId: string;
    organizationId?: string | null;
  }): Promise<{ linked: boolean; pending: boolean; referrerId?: string }> {
    const flags = await this.getProjectPartnerFlags(params.projectId);

    if (
      flags?.referralJoinRequiresApproval &&
      flags.enablePartnerTeamManagement
    ) {
      await this.createJoinRequest({
        projectId: params.projectId,
        userId: params.userId,
        referrerId: params.referrerId,
        organizationId: params.organizationId
      });
      return { linked: false, pending: true, referrerId: params.referrerId };
    }

    if (params.organizationId) {
      const user = await db.user.findFirst({
        where: { id: params.userId, projectId: params.projectId },
        select: { organizationId: true, partnerRole: true }
      });
      if (!user) throw new Error('Пользователь не найден');
      await db.partnerOrganizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: params.organizationId,
            userId: params.referrerId
          }
        },
        update: {},
        create: {
          projectId: params.projectId,
          organizationId: params.organizationId,
          userId: params.referrerId
        }
      });
      await db.partnerOrganizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: params.organizationId,
            userId: params.userId
          }
        },
        update: {},
        create: {
          projectId: params.projectId,
          organizationId: params.organizationId,
          userId: params.userId,
          level: ROLE_RANK[user.partnerRole] || null
        }
      });
      await PartnerReferralGraphService.replaceLinks({
        projectId: params.projectId,
        organizationId: params.organizationId,
        childUserId: params.userId,
        links: [
          {
            referrerId: params.referrerId,
            sharePercent: 100,
            isPrimary: true
          }
        ]
      });
      if (!user.organizationId) {
        await db.user.update({
          where: { id: params.userId },
          data: { organizationId: params.organizationId }
        });
      }
    } else {
      await db.user.update({
        where: { id: params.userId },
        data: {
          referredBy: params.referrerId,
          partnerParentId: params.referrerId
        }
      });
    }

    await ReferralCommissionService.syncAttributionForInvitedUser({
      invitedUserId: params.userId,
      projectId: params.projectId,
      referrerId: params.referrerId,
      organizationId: params.organizationId ?? null
    });

    void PartnerNotificationService.notifyAncestorsAboutNewMember(
      params.userId,
      params.projectId
    );

    return { linked: true, pending: false, referrerId: params.referrerId };
  }
}
