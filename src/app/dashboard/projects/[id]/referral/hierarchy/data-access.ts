/**
 * @file: data-access.ts
 * @description: Server-side data-access для страницы иерархии партнёров.
 *               (b2b-referral-hierarchy Phase 6.7–6.8)
 *
 *               Возвращает плоский массив `HierarchyNode` (id + parentId +
 *               role + агрегаты). Клиентский компонент `HierarchyTree`
 *               собирает дерево из этого массива с сохранением порядка
 *               вставки.
 *
 *               Для обхода используется `cachedGetDescendantTree` из Phase 3
 *               (рекурсивный CTE с fallback на итеративный обход) — НЕ
 *               переписываем CTE здесь.
 *
 * @project: SaaS Bonus System
 * @dependencies: Prisma, ReferralCommissionService
 * @created: 2026-05-24
 * @author: AI Assistant + User
 */

import 'server-only';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cachedGetDescendantTree } from '@/lib/services/referral-commission.service';
import { OrganizationFinancialMetricsService } from '@/lib/services/organization-financial-metrics.service';

export type HierarchyPeriod = 'today' | '7d' | '30d' | 'all';

export interface HierarchyNode {
  id: string;
  parentId: string | null;
  /** firstName + lastName или email/phone fallback. */
  name: string;
  email: string | null;
  phone: string | null;
  partnerRole: string;
  organizationLevel: number | null;
  organizationTitle: string | null;
  canManageOrganization: boolean;
  referrerLinks: Array<{
    referrerId: string;
    referrerName: string;
    sharePercent: number;
    isPrimary: boolean;
  }>;
  registeredAt: string; // ISO
  /** Сколько прямых рефералов у этого узла (depth=1). */
  directCount: number;
  /** Размер дерева ниже этого узла (без него самого). */
  subtreeSize: number;
  /** Личная сумма покупок участника в выбранном периоде и организации. */
  totalPurchasesPeriod: number;
  /** Чистые реферальные бонусы (EARN минус REFUND) за период и организацию. */
  commissionEarned: number;
}

export interface HierarchyTreeResult {
  enablePartnerRoles: boolean;
  rootIds: string[];
  nodes: HierarchyNode[];
  totals: {
    members: number;
    trainers: number;
    managers: number;
    directors: number;
    levels: Array<{ level: number; count: number }>;
    totalPurchases: number;
    commissionTotal: number;
  };
}

/**
 * Преобразует период из URL в дату-границу. `all` → null (без фильтра).
 */
export function periodToSince(period: HierarchyPeriod): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = period === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

interface BuildOptions {
  period?: HierarchyPeriod;
  /** Поиск (Phase 6.11) — фронт получает все узлы и подсвечивает сам. */
  search?: string;
  /** Фильтр по B2B-организации (сеть фитнес-клубов). */
  organizationId?: string | null;
}

/**
 * Получить дерево всех партнёров проекта в виде плоского массива.
 * Корни дерева — пользователи с `referredBy = null` И `partnerRole != CLIENT`,
 * либо все DIRECTORs если b2b-роли включены.
 *
 * Если `enablePartnerRoles = false` — поведение fallback'нутое: возвращаем
 * всех пользователей с `referredBy = null` как корни (пустые поддеревья
 * клиентов отбрасываются).
 */
export async function getHierarchyTree(
  projectId: string,
  options: BuildOptions = {}
): Promise<HierarchyTreeResult> {
  const period: HierarchyPeriod = options.period ?? '30d';
  const since = periodToSince(period);
  const organizationId = options.organizationId ?? null;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { enablePartnerRoles: true }
  });
  const enablePartnerRoles = Boolean(project?.enablePartnerRoles);

  type PartnerRow = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    partnerRole: string;
    referredBy: string | null;
    registeredAt: Date;
    totalPurchases: unknown;
    legacyOrganizationId: string | null;
    organizationLevel: number | null;
    organizationTitle: string | null;
    canManageOrganization: boolean;
  };

  let partners: PartnerRow[];
  let organizationLinks: Array<{
    childUserId: string;
    referrerUserId: string;
    sharePercent: unknown;
    isPrimary: boolean;
    referrer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    };
  }> = [];

  if (organizationId) {
    const [memberships, links] = await Promise.all([
      db.partnerOrganizationMembership.findMany({
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
              organizationId: true
            }
          }
        },
        orderBy: [{ level: 'desc' }, { createdAt: 'asc' }]
      }),
      db.partnerReferralLink.findMany({
        where: { projectId, organizationId },
        include: {
          referrer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          }
        }
      })
    ]);
    organizationLinks = links;
    const primaryByChild = new Map(
      links
        .filter((link) => link.isPrimary)
        .map((link) => [link.childUserId, link.referrerUserId])
    );
    partners = memberships.map((membership) => ({
      ...membership.user,
      referredBy: primaryByChild.get(membership.userId) ?? null,
      organizationLevel: membership.level,
      organizationTitle: membership.title,
      canManageOrganization: membership.canManage,
      legacyOrganizationId: membership.user.organizationId
    }));
  } else {
    const users = await db.user.findMany({
      where: {
        projectId,
        ...(enablePartnerRoles
          ? { partnerRole: { in: ['TRAINER', 'MANAGER', 'DIRECTOR'] } }
          : {})
      },
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
        organizationId: true
      },
      orderBy: [{ partnerRole: 'desc' }, { registeredAt: 'asc' }]
    });
    partners = users.map((user) => ({
      ...user,
      organizationLevel: null,
      organizationTitle: null,
      canManageOrganization: false,
      legacyOrganizationId: user.organizationId
    }));
  }

  if (partners.length === 0) {
    return {
      enablePartnerRoles,
      rootIds: [],
      nodes: [],
      totals: {
        members: 0,
        trainers: 0,
        managers: 0,
        directors: 0,
        levels: [],
        totalPurchases: 0,
        commissionTotal: 0
      }
    };
  }

  const partnerIdSet = new Set(partners.map((p) => p.id));

  const directCountByParent = new Map<string, number>();
  if (organizationId) {
    const childrenByParent = new Map<string, Set<string>>();
    for (const link of organizationLinks) {
      const children =
        childrenByParent.get(link.referrerUserId) ?? new Set<string>();
      children.add(link.childUserId);
      childrenByParent.set(link.referrerUserId, children);
    }
    for (const [parentId, children] of childrenByParent) {
      directCountByParent.set(parentId, children.size);
    }
  } else {
    const directCounts = await db.user.groupBy({
      by: ['referredBy'],
      where: {
        projectId,
        referredBy: { in: partners.map((partner) => partner.id) }
      },
      _count: { _all: true }
    });
    for (const row of directCounts) {
      if (row.referredBy) {
        directCountByParent.set(row.referredBy, row._count._all);
      }
    }
  }

  const subtreeSizeById = new Map<string, number>();
  if (organizationId) {
    const childrenByParent = new Map<string, string[]>();
    for (const link of organizationLinks) {
      const children = childrenByParent.get(link.referrerUserId) ?? [];
      children.push(link.childUserId);
      childrenByParent.set(link.referrerUserId, children);
    }
    for (const partner of partners) {
      const visited = new Set<string>([partner.id]);
      const frontier = [...(childrenByParent.get(partner.id) ?? [])];
      while (frontier.length > 0) {
        const childId = frontier.shift()!;
        if (visited.has(childId)) continue;
        visited.add(childId);
        frontier.push(...(childrenByParent.get(childId) ?? []));
      }
      subtreeSizeById.set(partner.id, visited.size - 1);
    }
  } else {
    await Promise.all(
      partners.map(async (partner) => {
        const descendants = await cachedGetDescendantTree(
          partner.id,
          projectId
        );
        subtreeSizeById.set(partner.id, descendants.length);
      })
    );
  }

  const financialMetrics = await OrganizationFinancialMetricsService.getMany({
    projectId,
    organizationId,
    since,
    subjects: partners.map((partner) => ({
      id: partner.id,
      totalPurchases: partner.totalPurchases,
      legacyOrganizationId: partner.legacyOrganizationId
    }))
  });

  // Превращаем в HierarchyNode. parentId привязываем только если родитель —
  // тоже партнёр в этом списке (иначе считаем корнем).
  const linksByChild = new Map<string, typeof organizationLinks>();
  for (const link of organizationLinks) {
    const childLinks = linksByChild.get(link.childUserId) ?? [];
    childLinks.push(link);
    linksByChild.set(link.childUserId, childLinks);
  }

  const nodes: HierarchyNode[] = partners.map((p) => {
    const parentInTree = p.referredBy && partnerIdSet.has(p.referredBy);
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return {
      id: p.id,
      parentId: parentInTree ? (p.referredBy as string) : null,
      name: fullName || p.email || p.phone || p.id.slice(0, 8),
      email: p.email,
      phone: p.phone,
      partnerRole: p.partnerRole,
      organizationLevel: p.organizationLevel,
      organizationTitle: p.organizationTitle,
      canManageOrganization: p.canManageOrganization,
      referrerLinks: (linksByChild.get(p.id) ?? []).map((link) => {
        const referrerName =
          [link.referrer.firstName, link.referrer.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          link.referrer.email ||
          link.referrer.phone ||
          link.referrer.id.slice(0, 8);
        return {
          referrerId: link.referrerUserId,
          referrerName,
          sharePercent: Number(link.sharePercent),
          isPrimary: link.isPrimary
        };
      }),
      registeredAt: p.registeredAt.toISOString(),
      directCount: directCountByParent.get(p.id) ?? 0,
      subtreeSize: subtreeSizeById.get(p.id) ?? 0,
      totalPurchasesPeriod: financialMetrics.get(p.id)?.totalPurchases ?? 0,
      commissionEarned: financialMetrics.get(p.id)?.referralBonusEarned ?? 0
    };
  });

  const rootIds = nodes.filter((n) => !n.parentId).map((n) => n.id);

  // Тоталы по проекту.
  const totalsByRole = nodes.reduce<{
    trainers: number;
    managers: number;
    directors: number;
  }>(
    (acc, n) => {
      if (n.partnerRole === 'TRAINER') acc.trainers += 1;
      else if (n.partnerRole === 'MANAGER') acc.managers += 1;
      else if (n.partnerRole === 'DIRECTOR') acc.directors += 1;
      return acc;
    },
    { trainers: 0, managers: 0, directors: 0 }
  );

  const financialTotals = [...financialMetrics.values()].reduce(
    (result, metric) => ({
      totalPurchases: result.totalPurchases + metric.totalPurchases,
      commissionTotal: result.commissionTotal + metric.referralBonusEarned
    }),
    { totalPurchases: 0, commissionTotal: 0 }
  );
  const levelCounts = new Map<number, number>();
  for (const node of nodes) {
    if (!node.organizationLevel) continue;
    levelCounts.set(
      node.organizationLevel,
      (levelCounts.get(node.organizationLevel) ?? 0) + 1
    );
  }
  const levels = [...levelCounts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, count]) => ({ level, count }));

  return {
    enablePartnerRoles,
    rootIds,
    nodes,
    totals: {
      members: nodes.length,
      ...totalsByRole,
      levels,
      totalPurchases: financialTotals.totalPurchases,
      commissionTotal: financialTotals.commissionTotal
    }
  };
}

/**
 * Тонкая обёртка с логированием — на странице мы хотим понимать ошибки,
 * но не падать с белым экраном. На ошибку отдаём пустую структуру.
 */
export async function getHierarchyTreeSafe(
  projectId: string,
  options: BuildOptions = {}
): Promise<HierarchyTreeResult> {
  try {
    return await getHierarchyTree(projectId, options);
  } catch (error) {
    logger.error('getHierarchyTree failed', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
      component: 'hierarchy-page-data'
    });
    return {
      enablePartnerRoles: false,
      rootIds: [],
      nodes: [],
      totals: {
        members: 0,
        trainers: 0,
        managers: 0,
        directors: 0,
        levels: [],
        totalPurchases: 0,
        commissionTotal: 0
      }
    };
  }
}
