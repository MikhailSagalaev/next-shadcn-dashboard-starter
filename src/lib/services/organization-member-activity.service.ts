import { db } from '@/lib/db';
import { nonCashOrderWhere } from './orders/payment-method';

export type OrganizationActivityPeriod = 'today' | '7d' | '30d' | 'all';

export type OrganizationActivityKind =
  | 'REFERRAL_REWARD'
  | 'REFERRAL_REVERSAL'
  | 'PURCHASE_CASHBACK'
  | 'CASHBACK_REVERSAL'
  | 'BONUS_SPEND'
  | 'BONUS_SPEND_RETURN'
  | 'BONUS_EXPIRE'
  | 'OTHER';

export type OrganizationActivityAttribution =
  | 'EXPLICIT'
  | 'ORDER'
  | 'LEGACY_REFERRAL';

export interface OrganizationActivityOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  accountedPurchaseAmount: number;
  status: string;
  accountingState: string;
  createdAt: string;
}

export interface OrganizationActivityEntry {
  id: string;
  occurredAt: string;
  kind: OrganizationActivityKind;
  label: string;
  description: string | null;
  amount: number;
  signedAmount: number;
  referralLevel: number | null;
  attribution: OrganizationActivityAttribution;
  relatedUser: { id: string; name: string } | null;
  order: OrganizationActivityOrder | null;
}

export interface OrganizationMemberActivityResult {
  member: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  summary: {
    purchaseTotal: number;
    referralRewardTotal: number;
    cashbackTotal: number;
    bonusSpentTotal: number;
  };
  activities: OrganizationActivityEntry[];
  orders: OrganizationActivityOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    scanTruncated: boolean;
    unscopedTransactions: number;
  };
}

type JsonRecord = Record<string, unknown>;

function jsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function metadataString(metadata: JsonRecord, key: string): string | null {
  const value = metadata[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function displayName(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    user.phone ||
    user.id.slice(0, 8)
  );
}

export function organizationActivitySince(
  period: OrganizationActivityPeriod,
  now = new Date()
): Date | null {
  if (period === 'all') return null;
  if (period === 'today') {
    const result = new Date(now);
    result.setHours(0, 0, 0, 0);
    return result;
  }
  const days = period === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function classifyOrganizationActivity(input: {
  type: string;
  isReferralBonus: boolean;
  bonusType?: string | null;
  metadata?: unknown;
}): {
  kind: OrganizationActivityKind;
  label: string;
  sign: 1 | -1;
} {
  const metadata = jsonRecord(input.metadata);
  const source = metadataString(metadata, 'source');
  const reversalOf = metadataString(metadata, 'reversalOf');

  if (input.isReferralBonus) {
    if (input.type === 'REFUND' || input.type === 'RETURN') {
      return {
        kind: 'REFERRAL_REVERSAL',
        label: 'Откат реферального начисления',
        sign: -1
      };
    }
    return {
      kind: 'REFERRAL_REWARD',
      label: 'Реферальное начисление',
      sign: 1
    };
  }

  if (input.type === 'SPEND') {
    return { kind: 'BONUS_SPEND', label: 'Оплата бонусами', sign: -1 };
  }
  if (input.type === 'EXPIRE') {
    return { kind: 'BONUS_EXPIRE', label: 'Сгорание бонусов', sign: -1 };
  }
  if (input.type === 'REFUND' || input.type === 'RETURN') {
    if (reversalOf?.startsWith('order-spend:')) {
      return {
        kind: 'BONUS_SPEND_RETURN',
        label: 'Возврат списанных бонусов',
        sign: 1
      };
    }
    return {
      kind: 'CASHBACK_REVERSAL',
      label: 'Откат кэшбэка',
      sign: -1
    };
  }
  if (
    input.bonusType === 'PURCHASE' ||
    source === 'tilda_order' ||
    source === 'tilda' ||
    source === 'webhook' ||
    source === 'insales'
  ) {
    return {
      kind: 'PURCHASE_CASHBACK',
      label: 'Кэшбэк за покупку',
      sign: 1
    };
  }
  return { kind: 'OTHER', label: 'Бонусная операция', sign: 1 };
}

function toActivityOrder(order: {
  id: string;
  orderNumber: string;
  totalAmount: unknown;
  accountedPurchaseAmount: unknown;
  status: string;
  accountingState: string;
  createdAt: Date;
}): OrganizationActivityOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: Number(order.totalAmount ?? 0),
    accountedPurchaseAmount: Number(order.accountedPurchaseAmount ?? 0),
    status: order.status,
    accountingState: order.accountingState,
    createdAt: order.createdAt.toISOString()
  };
}

export class OrganizationMemberActivityService {
  static async get(params: {
    projectId: string;
    organizationId: string;
    userId: string;
    period?: OrganizationActivityPeriod;
    page?: number;
    limit?: number;
  }): Promise<OrganizationMemberActivityResult> {
    const period = params.period ?? '30d';
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 30));
    const since = organizationActivitySince(period);
    const scanLimit = 2000;

    const membership = await db.partnerOrganizationMembership.findFirst({
      where: {
        projectId: params.projectId,
        organizationId: params.organizationId,
        userId: params.userId
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            organizationId: true,
            referralAttribution: { select: { organizationId: true } }
          }
        }
      }
    });
    if (!membership) {
      throw new Error('Участник не найден в этой организации');
    }

    const memberOrganizationId =
      membership.user.referralAttribution?.organizationId ??
      membership.user.organizationId ??
      null;
    const [transactions, memberOrders] = await Promise.all([
      db.transaction.findMany({
        where: {
          userId: params.userId,
          ...(since ? { createdAt: { gte: since } } : {})
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: scanLimit,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          metadata: true,
          createdAt: true,
          isReferralBonus: true,
          referralUserId: true,
          referralLevel: true,
          bonus: { select: { type: true } }
        }
      }),
      memberOrganizationId === params.organizationId
        ? db.order.findMany({
            where: {
              projectId: params.projectId,
              userId: params.userId,
              AND: [
                nonCashOrderWhere(),
                {
                  OR: [
                    { organizationId: params.organizationId },
                    { organizationId: null }
                  ]
                }
              ],
              ...(since ? { createdAt: { gte: since } } : {})
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 200,
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              accountedPurchaseAmount: true,
              status: true,
              accountingState: true,
              createdAt: true
            }
          })
        : db.order.findMany({
            where: {
              projectId: params.projectId,
              ...nonCashOrderWhere(),
              userId: params.userId,
              organizationId: params.organizationId,
              ...(since ? { createdAt: { gte: since } } : {})
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 200,
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              accountedPurchaseAmount: true,
              status: true,
              accountingState: true,
              createdAt: true
            }
          })
    ]);

    const referralUserIds = [
      ...new Set(
        transactions
          .map((transaction) => transaction.referralUserId)
          .filter((id): id is string => Boolean(id))
      )
    ];
    const orderReferences = [
      ...new Set(
        transactions
          .map((transaction) =>
            metadataString(jsonRecord(transaction.metadata), 'orderId')
          )
          .filter((reference): reference is string => Boolean(reference))
      )
    ];

    const [relatedUsers, referencedOrders] = await Promise.all([
      referralUserIds.length > 0
        ? db.user.findMany({
            where: { projectId: params.projectId, id: { in: referralUserIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              organizationId: true,
              referralAttribution: { select: { organizationId: true } }
            }
          })
        : Promise.resolve([]),
      orderReferences.length > 0
        ? db.order.findMany({
            where: {
              projectId: params.projectId,
              AND: [
                nonCashOrderWhere(),
                {
                  OR: [
                    { id: { in: orderReferences } },
                    { orderNumber: { in: orderReferences } }
                  ]
                }
              ]
            },
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              accountedPurchaseAmount: true,
              status: true,
              accountingState: true,
              createdAt: true,
              organizationId: true,
              user: {
                select: {
                  organizationId: true,
                  referralAttribution: { select: { organizationId: true } }
                }
              }
            }
          })
        : Promise.resolve([])
    ]);

    const relatedUserById = new Map(
      relatedUsers.map((user) => [
        user.id,
        {
          id: user.id,
          name: displayName(user),
          organizationId:
            user.referralAttribution?.organizationId ??
            user.organizationId ??
            null
        }
      ])
    );
    const referencedOrderByReference = new Map<
      string,
      (typeof referencedOrders)[number]
    >();
    for (const order of referencedOrders) {
      referencedOrderByReference.set(order.id, order);
      referencedOrderByReference.set(order.orderNumber, order);
    }

    let unscopedTransactions = 0;
    const scopedActivities = transactions.flatMap((transaction) => {
      const metadata = jsonRecord(transaction.metadata);
      const explicitOrganizationId =
        metadataString(metadata, 'referralOrganizationId') ??
        metadataString(metadata, 'organizationId');
      const orderReference = metadataString(metadata, 'orderId');
      const order = orderReference
        ? (referencedOrderByReference.get(orderReference) ?? null)
        : null;
      const relatedUser = transaction.referralUserId
        ? (relatedUserById.get(transaction.referralUserId) ?? null)
        : null;

      let attribution: OrganizationActivityAttribution | null = null;
      if (explicitOrganizationId) {
        if (explicitOrganizationId === params.organizationId) {
          attribution = 'EXPLICIT';
        }
      } else if (order) {
        const orderOrganizationId =
          order.organizationId ??
          order.user?.referralAttribution?.organizationId ??
          order.user?.organizationId ??
          null;
        if (orderOrganizationId === params.organizationId) {
          attribution = 'ORDER';
        }
      } else if (
        transaction.isReferralBonus &&
        relatedUser?.organizationId === params.organizationId
      ) {
        attribution = 'LEGACY_REFERRAL';
      }

      if (!attribution) {
        unscopedTransactions += 1;
        return [];
      }

      const classification = classifyOrganizationActivity({
        type: transaction.type,
        isReferralBonus: transaction.isReferralBonus,
        bonusType: transaction.bonus?.type ?? null,
        metadata
      });
      const amount = Number(transaction.amount ?? 0);
      return [
        {
          id: transaction.id,
          occurredAt: transaction.createdAt.toISOString(),
          kind: classification.kind,
          label: classification.label,
          description: transaction.description,
          amount,
          signedAmount: classification.sign * amount,
          referralLevel: transaction.referralLevel,
          attribution,
          relatedUser: relatedUser
            ? { id: relatedUser.id, name: relatedUser.name }
            : null,
          order: order ? toActivityOrder(order) : null
        } satisfies OrganizationActivityEntry
      ];
    });

    const offset = (page - 1) * limit;
    const activities = scopedActivities.slice(offset, offset + limit);
    const orders = memberOrders.map(toActivityOrder);
    const summary = scopedActivities.reduce(
      (result, activity) => {
        if (
          activity.kind === 'REFERRAL_REWARD' ||
          activity.kind === 'REFERRAL_REVERSAL'
        ) {
          result.referralRewardTotal += activity.signedAmount;
        }
        if (
          activity.kind === 'PURCHASE_CASHBACK' ||
          activity.kind === 'CASHBACK_REVERSAL'
        ) {
          result.cashbackTotal += activity.signedAmount;
        }
        if (
          activity.kind === 'BONUS_SPEND' ||
          activity.kind === 'BONUS_SPEND_RETURN'
        ) {
          result.bonusSpentTotal += -activity.signedAmount;
        }
        return result;
      },
      {
        purchaseTotal: orders
          .filter((order) => order.accountingState === 'APPLIED')
          .reduce((sum, order) => sum + order.accountedPurchaseAmount, 0),
        referralRewardTotal: 0,
        cashbackTotal: 0,
        bonusSpentTotal: 0
      }
    );

    return {
      member: {
        id: membership.user.id,
        name: displayName(membership.user),
        email: membership.user.email,
        phone: membership.user.phone
      },
      summary,
      activities,
      orders,
      pagination: {
        page,
        limit,
        total: scopedActivities.length,
        hasMore: offset + limit < scopedActivities.length,
        scanTruncated: transactions.length === scanLimit,
        unscopedTransactions
      }
    };
  }
}
