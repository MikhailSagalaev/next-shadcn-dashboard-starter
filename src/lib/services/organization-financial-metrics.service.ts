import { db } from '@/lib/db';
import { nonCashOrderWhere } from './orders/payment-method';

type FinancialSubject = {
  id: string;
  totalPurchases: unknown;
  legacyOrganizationId?: string | null;
};

type FinancialMetric = {
  totalPurchases: number;
  referralBonusEarned: number;
};

type MetricsParams = {
  projectId: string;
  organizationId?: string | null;
  subjects: FinancialSubject[];
  since?: Date | null;
};

function metadataOrganizationId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).referralOrganizationId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Единый источник финансовых показателей для B2B-организации.
 *
 * `User.totalPurchases` остаётся legacy-счётчиком и не используется как
 * источник статистики. Покупки считаются по применённым безналичным заказам.
 * Наличные (`cash` / `наличные`) не входят в B2B-статистику.
 * Реферальное вознаграждение считается как EARN минус REFUND и обязательно
 * привязывается к организации события (metadata, затем legacy fallback).
 */
export class OrganizationFinancialMetricsService {
  static async getMany({
    projectId,
    organizationId = null,
    subjects,
    since = null
  }: MetricsParams): Promise<Map<string, FinancialMetric>> {
    const metrics = new Map<string, FinancialMetric>(
      subjects.map((subject) => [
        subject.id,
        { totalPurchases: 0, referralBonusEarned: 0 }
      ])
    );
    if (subjects.length === 0) return metrics;

    const subjectIds = subjects.map((subject) => subject.id);
    const [attributions, transactions] = await Promise.all([
      db.referralAttribution.findMany({
        where: { projectId, userId: { in: subjectIds } },
        select: { userId: true, organizationId: true }
      }),
      db.transaction.findMany({
        where: {
          userId: { in: subjectIds },
          type: { in: ['EARN', 'REFUND'] },
          isReferralBonus: true,
          referralUserId: { not: null },
          ...(since ? { createdAt: { gte: since } } : {})
        },
        select: {
          userId: true,
          referralUserId: true,
          amount: true,
          type: true,
          metadata: true
        }
      })
    ]);

    const attributionOrgByUserId = new Map(
      attributions.map((attribution) => [
        attribution.userId,
        attribution.organizationId
      ])
    );
    const subjectOrgByUserId = new Map(
      subjects.map((subject) => [
        subject.id,
        attributionOrgByUserId.get(subject.id) ??
          subject.legacyOrganizationId ??
          null
      ])
    );
    if (organizationId) {
      const legacyPurchaseSubjectIds = subjectIds.filter(
        (subjectId) => subjectOrgByUserId.get(subjectId) === organizationId
      );
      const purchases = await db.order.groupBy({
        by: ['userId'],
        where: {
          projectId,
          userId: { in: subjectIds },
          accountingState: 'APPLIED',
          AND: [
            nonCashOrderWhere(),
            {
              OR: [
                { organizationId },
                ...(legacyPurchaseSubjectIds.length > 0
                  ? [
                      {
                        organizationId: null,
                        userId: { in: legacyPurchaseSubjectIds }
                      }
                    ]
                  : [])
              ]
            }
          ],
          ...(since ? { accountedAt: { gte: since } } : {})
        },
        _sum: { accountedPurchaseAmount: true }
      });
      for (const row of purchases) {
        if (!row.userId) continue;
        const metric = metrics.get(row.userId);
        if (metric) {
          metric.totalPurchases = Number(row._sum.accountedPurchaseAmount ?? 0);
        }
      }
    } else {
      const purchases = await db.order.groupBy({
        by: ['userId'],
        where: {
          projectId,
          ...nonCashOrderWhere(),
          userId: { in: subjectIds },
          accountingState: 'APPLIED',
          ...(since ? { accountedAt: { gte: since } } : {})
        },
        _sum: { accountedPurchaseAmount: true }
      });
      for (const row of purchases) {
        if (!row.userId) continue;
        const metric = metrics.get(row.userId);
        if (metric) {
          metric.totalPurchases = Number(row._sum.accountedPurchaseAmount ?? 0);
        }
      }
    }

    const unresolvedBuyerIds = [
      ...new Set(
        transactions
          .filter(
            (transaction) =>
              !metadataOrganizationId(transaction.metadata) &&
              transaction.referralUserId &&
              !subjectOrgByUserId.has(transaction.referralUserId)
          )
          .map((transaction) => transaction.referralUserId as string)
      )
    ];
    const buyerProfiles =
      unresolvedBuyerIds.length > 0
        ? await db.user.findMany({
            where: { projectId, id: { in: unresolvedBuyerIds } },
            select: {
              id: true,
              organizationId: true,
              referralAttribution: { select: { organizationId: true } }
            }
          })
        : [];
    const buyerOrgByUserId = new Map(subjectOrgByUserId);
    for (const buyer of buyerProfiles) {
      buyerOrgByUserId.set(
        buyer.id,
        buyer.referralAttribution?.organizationId ??
          buyer.organizationId ??
          null
      );
    }

    for (const transaction of transactions) {
      const eventOrganizationId =
        metadataOrganizationId(transaction.metadata) ??
        (transaction.referralUserId
          ? (buyerOrgByUserId.get(transaction.referralUserId) ?? null)
          : null);
      if (organizationId && eventOrganizationId !== organizationId) continue;

      const metric = metrics.get(transaction.userId);
      if (!metric) continue;
      const amount = Number(transaction.amount ?? 0);
      metric.referralBonusEarned +=
        transaction.type === 'REFUND' ? -amount : amount;
    }

    return metrics;
  }
}
