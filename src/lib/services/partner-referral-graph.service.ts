import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';

export type ReferralLinkInput = {
  referrerId: string;
  sharePercent?: number;
  isPrimary?: boolean;
};

export type NormalizedReferralLink = {
  referrerId: string;
  sharePercent: number;
  isPrimary: boolean;
};

export type PayoutGraphRecipient = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  weight: number;
};

const roundShare = (value: number) => Math.round(value * 100) / 100;

export function normalizeReferralLinks(
  childUserId: string,
  links: ReferralLinkInput[]
): NormalizedReferralLink[] {
  const seen = new Set<string>();
  const normalized = links.map((link) => {
    const referrerId = link.referrerId.trim();
    if (!referrerId) throw new Error('Выберите реферера');
    if (referrerId === childUserId) {
      throw new Error('Участник не может быть реферером сам себе');
    }
    if (seen.has(referrerId)) {
      throw new Error('Один реферер не может быть добавлен дважды');
    }
    seen.add(referrerId);

    const sharePercent = roundShare(Number(link.sharePercent ?? 0));
    if (
      !Number.isFinite(sharePercent) ||
      sharePercent < 0 ||
      sharePercent > 100
    ) {
      throw new Error('Доля реферера должна быть от 0 до 100%');
    }

    return {
      referrerId,
      sharePercent,
      isPrimary: Boolean(link.isPrimary)
    };
  });

  if (normalized.filter((link) => link.isPrimary).length > 1) {
    throw new Error('Основным может быть только один реферер');
  }

  const totalShare = roundShare(
    normalized.reduce((sum, link) => sum + link.sharePercent, 0)
  );
  if (totalShare > 100) {
    throw new Error('Сумма долей рефереров не может превышать 100%');
  }

  if (normalized.length > 0 && !normalized.some((link) => link.isPrimary)) {
    const primaryIndex = normalized.findIndex((link) => link.sharePercent > 0);
    normalized[primaryIndex >= 0 ? primaryIndex : 0].isPrimary = true;
  }

  return normalized;
}

function assertAcyclic(
  childUserId: string,
  proposedLinks: NormalizedReferralLink[],
  existingLinks: Array<{ childUserId: string; referrerUserId: string }>
) {
  const parentsByChild = new Map<string, string[]>();
  for (const link of existingLinks) {
    const parents = parentsByChild.get(link.childUserId) ?? [];
    parents.push(link.referrerUserId);
    parentsByChild.set(link.childUserId, parents);
  }
  parentsByChild.set(
    childUserId,
    proposedLinks.map((link) => link.referrerId)
  );

  for (const proposed of proposedLinks) {
    const stack = [proposed.referrerId];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === childUserId) {
        throw new Error('Реферальная связь создаёт цикл');
      }
      if (visited.has(current)) continue;
      visited.add(current);
      stack.push(...(parentsByChild.get(current) ?? []));
    }
  }
}

export class PartnerReferralGraphService {
  static async replaceLinks(params: {
    projectId: string;
    organizationId: string;
    childUserId: string;
    links: ReferralLinkInput[];
  }): Promise<NormalizedReferralLink[]> {
    const normalized = normalizeReferralLinks(params.childUserId, params.links);
    const participantIds = [
      params.childUserId,
      ...normalized.map((link) => link.referrerId)
    ];

    const [organization, memberships, existingLinks] = await Promise.all([
      db.partnerOrganization.findFirst({
        where: {
          id: params.organizationId,
          projectId: params.projectId
        },
        select: { id: true }
      }),
      db.partnerOrganizationMembership.findMany({
        where: {
          projectId: params.projectId,
          organizationId: params.organizationId,
          userId: { in: participantIds }
        },
        select: { userId: true }
      }),
      db.partnerReferralLink.findMany({
        where: {
          projectId: params.projectId,
          organizationId: params.organizationId,
          childUserId: { not: params.childUserId }
        },
        select: { childUserId: true, referrerUserId: true }
      })
    ]);

    if (!organization) throw new Error('Организация не найдена');

    const memberIds = new Set(
      memberships.map((membership) => membership.userId)
    );
    const missingId = participantIds.find((id) => !memberIds.has(id));
    if (missingId) {
      throw new Error(
        'Все участники реферальной связи должны состоять в этой организации'
      );
    }

    assertAcyclic(params.childUserId, normalized, existingLinks);

    const primary =
      normalized.find((link) => link.isPrimary) ?? normalized[0] ?? null;

    await db.$transaction(async (tx) => {
      await tx.partnerReferralLink.deleteMany({
        where: {
          projectId: params.projectId,
          organizationId: params.organizationId,
          childUserId: params.childUserId
        }
      });
      if (normalized.length > 0) {
        await tx.partnerReferralLink.createMany({
          data: normalized.map((link) => ({
            projectId: params.projectId,
            organizationId: params.organizationId,
            childUserId: params.childUserId,
            referrerUserId: link.referrerId,
            sharePercent: new Prisma.Decimal(link.sharePercent),
            isPrimary: link.isPrimary
          }))
        });
      }
      await tx.user.update({
        where: { id: params.childUserId },
        data: {
          referredBy: primary?.referrerId ?? null,
          partnerParentId: primary?.referrerId ?? null
        }
      });
    });

    return normalized;
  }

  static async listLinks(
    projectId: string,
    organizationId: string,
    childUserIds?: string[]
  ) {
    return db.partnerReferralLink.findMany({
      where: {
        projectId,
        organizationId,
        ...(childUserIds ? { childUserId: { in: childUserIds } } : {})
      },
      include: {
        referrer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            partnerRole: true,
            outboundReferralPlanId: true
          }
        }
      },
      orderBy: [
        { childUserId: 'asc' },
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  static async getVisibleTeamIds(
    projectId: string,
    viewerUserId: string
  ): Promise<{ directIds: string[]; allIds: string[] }> {
    const managedMemberships = await db.partnerOrganizationMembership.findMany({
      where: { projectId, userId: viewerUserId, canManage: true },
      select: { organizationId: true }
    });
    const managedOrganizationIds = managedMemberships.map(
      (membership) => membership.organizationId
    );
    const managedMembers =
      managedOrganizationIds.length > 0
        ? await db.partnerOrganizationMembership.findMany({
            where: {
              projectId,
              organizationId: { in: managedOrganizationIds },
              userId: { not: viewerUserId }
            },
            select: { userId: true }
          })
        : [];

    const directLinks = await db.partnerReferralLink.findMany({
      where: { projectId, referrerUserId: viewerUserId },
      select: { childUserId: true }
    });
    const legacyDirect = await db.user.findMany({
      where: {
        projectId,
        referredBy: viewerUserId,
        referralParents: { none: {} }
      },
      select: { id: true }
    });
    const directIds = [
      ...new Set([
        ...directLinks.map((link) => link.childUserId),
        ...legacyDirect.map((user) => user.id)
      ])
    ];

    const visited = new Set<string>([
      viewerUserId,
      ...managedMembers.map((membership) => membership.userId)
    ]);
    const allIds = managedMembers.map((membership) => membership.userId);
    let frontier = [...directIds];
    for (const id of frontier) {
      if (!visited.has(id)) {
        visited.add(id);
        allIds.push(id);
      }
    }

    while (frontier.length > 0) {
      const [links, legacy] = await Promise.all([
        db.partnerReferralLink.findMany({
          where: { projectId, referrerUserId: { in: frontier } },
          select: { childUserId: true }
        }),
        db.user.findMany({
          where: {
            projectId,
            referredBy: { in: frontier },
            referralParents: { none: {} }
          },
          select: { id: true }
        })
      ]);
      const next = [
        ...new Set([
          ...links.map((link) => link.childUserId),
          ...legacy.map((user) => user.id)
        ])
      ].filter((id) => !visited.has(id));
      for (const id of next) {
        visited.add(id);
        allIds.push(id);
      }
      frontier = next;
    }

    return { directIds, allIds };
  }

  static async resolvePayoutLevels(params: {
    projectId: string;
    organizationId: string | null;
    childUserId: string;
    depth: number;
  }): Promise<PayoutGraphRecipient[][]> {
    const requestedDepth = Math.max(1, Math.trunc(params.depth));
    let frontier = new Map<string, number>([[params.childUserId, 1]]);
    const alreadyPaid = new Set<string>([params.childUserId]);
    const levels: PayoutGraphRecipient[][] = [];

    for (let level = 1; level <= requestedDepth && frontier.size > 0; level++) {
      const childIds = [...frontier.keys()];
      const [links, users] = await Promise.all([
        params.organizationId
          ? db.partnerReferralLink.findMany({
              where: {
                projectId: params.projectId,
                organizationId: params.organizationId,
                childUserId: { in: childIds }
              },
              select: {
                childUserId: true,
                referrerUserId: true,
                sharePercent: true
              }
            })
          : Promise.resolve([]),
        db.user.findMany({
          where: { projectId: params.projectId, id: { in: childIds } },
          select: { id: true, partnerParentId: true, referredBy: true }
        })
      ]);

      const linksByChild = new Map<
        string,
        Array<{ referrerUserId: string; sharePercent: number }>
      >();
      for (const link of links) {
        const current = linksByChild.get(link.childUserId) ?? [];
        current.push({
          referrerUserId: link.referrerUserId,
          sharePercent: Number(link.sharePercent)
        });
        linksByChild.set(link.childUserId, current);
      }
      const legacyParentByChild = new Map(
        users.map((user) => [
          user.id,
          user.partnerParentId ?? user.referredBy ?? null
        ])
      );

      const nextWeights = new Map<string, number>();
      for (const [childId, childWeight] of frontier) {
        const childLinks = linksByChild.get(childId) ?? [];
        if (childLinks.length > 0) {
          for (const link of childLinks) {
            const weight = childWeight * (link.sharePercent / 100);
            if (weight <= 0) continue;
            nextWeights.set(
              link.referrerUserId,
              (nextWeights.get(link.referrerUserId) ?? 0) + weight
            );
          }
          continue;
        }

        const legacyParentId = legacyParentByChild.get(childId);
        if (legacyParentId) {
          nextWeights.set(
            legacyParentId,
            (nextWeights.get(legacyParentId) ?? 0) + childWeight
          );
        }
      }

      for (const paidId of alreadyPaid) nextWeights.delete(paidId);
      for (const [recipientId, weight] of nextWeights) {
        if (weight <= 0) nextWeights.delete(recipientId);
      }
      if (nextWeights.size === 0) break;

      const recipients = await db.user.findMany({
        where: {
          projectId: params.projectId,
          id: { in: [...nextWeights.keys()] }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true
        }
      });
      const payoutLevel = recipients
        .map((recipient) => ({
          ...recipient,
          weight: nextWeights.get(recipient.id) ?? 0
        }))
        .filter((recipient) => recipient.weight > 0);
      if (payoutLevel.length === 0) break;

      levels.push(payoutLevel);
      frontier = new Map(
        payoutLevel.map((recipient) => [recipient.id, recipient.weight])
      );
      for (const recipient of payoutLevel) alreadyPaid.add(recipient.id);
    }

    return levels;
  }
}
