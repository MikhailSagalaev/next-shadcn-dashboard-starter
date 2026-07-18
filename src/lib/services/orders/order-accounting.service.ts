/**
 * @file: src/lib/services/orders/order-accounting.service.ts
 * @description: Централизованный идемпотентный учет экономических эффектов заказов
 * @project: SaaS Bonus System
 * @dependencies: Prisma, BonusService, ReferralService, Logger
 * @created: 2026-07-18
 * @author: AI Assistant + User
 */

import { OrderAccountingState, OrderStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { BonusService, UserService } from '@/lib/services/user.service';
import { ReferralService } from '@/lib/services/referral.service';

export class OrderAccountingConflictError extends Error {
  readonly code = 'ORDER_ACCOUNTING_CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'OrderAccountingConflictError';
  }
}

export interface OrderStatusTransitionInput {
  status: OrderStatus;
  comment?: string;
  changedBy?: string;
}

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
};

const orderInclude = {
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true
    }
  },
  items: { include: { product: true } },
  history: { orderBy: { createdAt: 'desc' as const } },
  project: { select: { id: true, name: true } }
};
function jsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numericMetadata(
  metadata: Record<string, unknown>,
  key: string
): number {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const ACCOUNTING_CLAIM_STALE_MS = 5 * 60 * 1000;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Object && (error as { code?: string }).code === 'P2002'
  );
}

async function resolveLevelName(
  tx: Prisma.TransactionClient,
  projectId: string,
  totalPurchases: number
): Promise<string> {
  const levels = await tx.bonusLevel.findMany({
    where: { projectId, isActive: true },
    select: {
      name: true,
      minAmount: true,
      maxAmount: true,
      order: true
    }
  });
  const matching = [...levels]
    .sort((left, right) => Number(right.minAmount) - Number(left.minAmount))
    .find(
      (level) =>
        totalPurchases >= Number(level.minAmount) &&
        (level.maxAmount === null || totalPurchases <= Number(level.maxAmount))
    );
  if (matching) return matching.name;
  return (
    [...levels].sort((left, right) => left.order - right.order)[0]?.name ??
    'Базовый'
  );
}

export class OrderAccountingService {
  static async transition(
    projectId: string,
    orderId: string,
    input: OrderStatusTransitionInput
  ) {
    const order = await db.order.findFirst({
      where: { id: orderId, projectId }
    });
    if (!order) throw new Error('Заказ не найден');

    const isReversalTarget =
      input.status === 'CANCELLED' || input.status === 'REFUNDED';

    // Повтор запроса должен уметь завершить зависший accounting claim, даже
    // если статус уже успел измениться отдельной legacy-операцией.
    if (order.accountingState === 'APPLYING' && input.status === 'CONFIRMED') {
      await this.apply(order.id, projectId, input);
    } else if (order.accountingState === 'REVERSING' && isReversalTarget) {
      await this.reverse(order.id, projectId, input);
    } else if (order.status === input.status) {
      return db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude
      });
    } else {
      if (!allowedTransitions[order.status].includes(input.status)) {
        throw new OrderAccountingConflictError(
          `Переход ${order.status} → ${input.status} недопустим`
        );
      }

      if (
        order.status === 'PENDING' &&
        input.status === 'CONFIRMED' &&
        order.accountingState !== 'LEGACY'
      ) {
        await this.apply(order.id, projectId, input);
      } else if (
        isReversalTarget &&
        (order.accountingState === 'APPLIED' ||
          order.accountingState === 'LEGACY')
      ) {
        await this.reverse(order.id, projectId, input);
      } else {
        if (
          order.accountingState === 'APPLYING' ||
          order.accountingState === 'REVERSING'
        ) {
          throw new OrderAccountingConflictError(
            'Заказ уже обрабатывается. Повторите запрос после завершения текущей операции'
          );
        }
        await db.$transaction([
          db.order.update({
            where: { id: order.id },
            data: { status: input.status }
          }),
          db.orderHistory.create({
            data: {
              orderId: order.id,
              status: input.status,
              comment: input.comment,
              changedBy: input.changedBy
            }
          })
        ]);
      }
    }

    return db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude
    });
  }

  private static async apply(
    orderId: string,
    projectId: string,
    input: OrderStatusTransitionInput
  ): Promise<void> {
    const claimStartedAt = new Date();
    const staleBefore = new Date(
      claimStartedAt.getTime() - ACCOUNTING_CLAIM_STALE_MS
    );
    let claimed = await db.order.updateMany({
      where: { id: orderId, projectId, accountingState: 'NOT_APPLIED' },
      data: { accountingState: 'APPLYING', accountedAt: claimStartedAt }
    });
    if (claimed.count === 0) {
      claimed = await db.order.updateMany({
        where: {
          id: orderId,
          projectId,
          accountingState: 'APPLYING',
          OR: [{ accountedAt: null }, { accountedAt: { lte: staleBefore } }]
        },
        data: { accountedAt: claimStartedAt }
      });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { project: true, user: true }
    });
    if (!order) throw new Error('Заказ не найден');
    if (order.accountingState === 'APPLIED') return;
    if (
      claimed.count === 0 ||
      order.accountingState !== 'APPLYING' ||
      order.accountedAt?.getTime() !== claimStartedAt.getTime()
    ) {
      throw new OrderAccountingConflictError(
        'Учет заказа уже выполняется другим процессом'
      );
    }
    if (!order.userId || !order.user) {
      throw new OrderAccountingConflictError(
        'Перед учетом заказ должен быть связан с пользователем'
      );
    }

    const totalAmount = Number(order.totalAmount);
    const metadata = jsonRecord(order.metadata);
    const requestedBonusAmount = Math.max(
      0,
      Math.min(totalAmount, numericMetadata(metadata, 'requestedBonusAmount'))
    );
    const behavior = order.project.bonusBehavior || 'SPEND_AND_EARN';

    await db.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: {
          id: orderId,
          projectId,
          accountingState: 'APPLYING',
          accountedAt: claimStartedAt
        },
        select: { accountedPurchaseAmount: true }
      });
      if (!current) {
        throw new OrderAccountingConflictError('Право учета заказа потеряно');
      }
      if (Number(current.accountedPurchaseAmount) !== 0 || totalAmount <= 0) {
        return;
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${order.userId} FOR UPDATE`
      );
      const currentUser = await tx.user.findUniqueOrThrow({
        where: { id: order.userId },
        select: { totalPurchases: true }
      });
      const nextTotalPurchases =
        Number(currentUser.totalPurchases) + totalAmount;
      const currentLevel = await resolveLevelName(
        tx,
        projectId,
        nextTotalPurchases
      );
      await tx.user.update({
        where: { id: order.userId },
        data: { totalPurchases: nextTotalPurchases, currentLevel }
      });
      await tx.order.update({
        where: { id: orderId },
        data: { accountedPurchaseAmount: totalAmount }
      });
    });

    let spentAmount = Number(order.accountedSpentBonusAmount);
    const shouldSpend =
      requestedBonusAmount > 0 &&
      (behavior === 'SPEND_AND_EARN' || behavior === 'SPEND_ONLY');
    if (shouldSpend && spentAmount === 0) {
      const balance = await UserService.getUserBalance(order.userId);
      const spendable = Math.min(
        requestedBonusAmount,
        Number(balance.currentBalance),
        totalAmount
      );
      if (spendable > 0) {
        const transactions = await BonusService.spendBonuses(
          order.userId,
          spendable,
          `Order ${order.orderNumber}`,
          {
            orderId: order.orderNumber,
            source: 'tilda',
            accountingManaged: true
          },
          `order-spend:${order.orderNumber}`
        );
        spentAmount = transactions.reduce(
          (sum, transaction) => sum + Number(transaction.amount),
          0
        );
        await db.order.updateMany({
          where: {
            id: orderId,
            accountingState: 'APPLYING',
            accountedAt: claimStartedAt
          },
          data: { accountedSpentBonusAmount: spentAmount }
        });
      }
    }

    const shouldEarn = !(behavior === 'SPEND_ONLY' && spentAmount > 0);
    const earnBase = shouldEarn
      ? behavior === 'SPEND_AND_EARN'
        ? Math.max(0, totalAmount - spentAmount)
        : totalAmount
      : 0;
    const refreshed = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { accountedEarnBase: true }
    });
    if (earnBase > 0 && Number(refreshed.accountedEarnBase) === 0) {
      await BonusService.awardPurchaseBonus(
        order.userId,
        earnBase,
        order.orderNumber,
        `Order #${order.orderNumber}`,
        'PURCHASE',
        {
          accountingManaged: true,
          purchaseTotalAmount: totalAmount,
          source: 'tilda_order'
        }
      );
    }

    await db.$transaction(async (tx) => {
      const finalized = await tx.order.updateMany({
        where: {
          id: orderId,
          projectId,
          accountingState: 'APPLYING',
          accountedAt: claimStartedAt
        },
        data: {
          status: input.status,
          accountingState: 'APPLIED',
          accountedEarnBase: earnBase,
          accountedSpentBonusAmount: spentAmount,
          paidAmount: Math.max(0, totalAmount - spentAmount),
          bonusAmount: spentAmount,
          accountedAt: new Date(),
          reversalShortfall: 0
        }
      });
      if (finalized.count === 0) {
        throw new OrderAccountingConflictError('Право учета заказа потеряно');
      }
      await tx.orderHistory.create({
        data: {
          orderId,
          status: input.status,
          comment: input.comment,
          changedBy: input.changedBy,
          metadata: { accountingState: 'APPLIED' }
        }
      });
    });
  }

  private static async restoreSpentBonuses(
    orderNumber: string,
    userId: string
  ): Promise<void> {
    const spends = await db.transaction.findMany({
      where: {
        userId,
        type: 'SPEND',
        externalId: { startsWith: `order-spend:${orderNumber}:` }
      }
    });

    for (const spend of spends) {
      if (!spend.externalId || !spend.bonusId) continue;
      const reversalExternalId = `reversal_${spend.externalId}`;
      try {
        await db.$transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "bonuses" WHERE "id" = ${spend.bonusId} FOR UPDATE`
          );
          const existing = await tx.transaction.findUnique({
            where: { externalId: reversalExternalId }
          });
          if (existing) return;

          await tx.transaction.create({
            data: {
              userId,
              bonusId: spend.bonusId,
              amount: spend.amount,
              type: 'REFUND',
              description: `Возврат списанных бонусов (заказ ${orderNumber})`,
              externalId: reversalExternalId,
              metadata: {
                source: 'order_reversal',
                reversalOf: spend.externalId,
                orderId: orderNumber
              }
            }
          });

          const [bonus, bonusSpends] = await Promise.all([
            tx.bonus.findUniqueOrThrow({ where: { id: spend.bonusId! } }),
            tx.transaction.findMany({
              where: { bonusId: spend.bonusId, type: 'SPEND' },
              select: { amount: true, externalId: true, metadata: true }
            })
          ]);
          const reversalIds = bonusSpends
            .map((entry) => entry.externalId)
            .filter((externalId): externalId is string => Boolean(externalId))
            .map((externalId) => `reversal_${externalId}`);
          const reversals = reversalIds.length
            ? await tx.transaction.findMany({
                where: { externalId: { in: reversalIds } },
                select: { externalId: true }
              })
            : [];
          const reversedIds = new Set(
            reversals.map((entry) => entry.externalId).filter(Boolean)
          );
          const activeSpent = bonusSpends.reduce((sum, entry) => {
            if (
              entry.externalId &&
              reversedIds.has(`reversal_${entry.externalId}`)
            ) {
              return sum;
            }
            return sum + Number(entry.amount);
          }, 0);
          const originalAmount = Math.max(
            Number(bonus.amount),
            activeSpent,
            ...bonusSpends.map((entry) =>
              numericMetadata(jsonRecord(entry.metadata), 'originalBonusAmount')
            )
          );
          const availableAmount = Math.max(0, originalAmount - activeSpent);
          await tx.bonus.update({
            where: { id: spend.bonusId },
            data: {
              // Полностью использованный lot хранит старый amount при isUsed=true.
              // Пересчет по активным SPEND не допускает двойного восстановления.
              amount: availableAmount > 0 ? availableAmount : originalAmount,
              isUsed: availableAmount <= 0
            }
          });
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
      }
    }
  }

  private static async reverse(
    orderId: string,
    projectId: string,
    input: OrderStatusTransitionInput
  ): Promise<void> {
    const claimStartedAt = new Date();
    const staleBefore = new Date(
      claimStartedAt.getTime() - ACCOUNTING_CLAIM_STALE_MS
    );
    let claimedFromLegacy = false;
    let claimed = await db.order.updateMany({
      where: { id: orderId, projectId, accountingState: 'APPLIED' },
      data: { accountingState: 'REVERSING', reversedAt: claimStartedAt }
    });
    if (claimed.count === 0) {
      const legacyClaim = await db.order.updateMany({
        where: { id: orderId, projectId, accountingState: 'LEGACY' },
        data: { accountingState: 'REVERSING', reversedAt: claimStartedAt }
      });
      claimed = legacyClaim;
      claimedFromLegacy = legacyClaim.count > 0;
    }
    if (claimed.count === 0) {
      claimed = await db.order.updateMany({
        where: {
          id: orderId,
          projectId,
          accountingState: 'REVERSING',
          OR: [{ reversedAt: null }, { reversedAt: { lte: staleBefore } }]
        },
        data: { reversedAt: claimStartedAt }
      });
    }

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Заказ не найден');
    if (
      claimed.count === 0 ||
      order.accountingState !== 'REVERSING' ||
      order.reversedAt?.getTime() !== claimStartedAt.getTime()
    ) {
      throw new OrderAccountingConflictError(
        'Откат заказа уже выполняется другим процессом'
      );
    }

    const purchaseEarn = await db.transaction.findUnique({
      where: { externalId: `tilda_order_${order.orderNumber}` },
      select: { userId: true, metadata: true }
    });
    const effectiveUserId = order.userId ?? purchaseEarn?.userId ?? null;
    if (effectiveUserId) {
      await this.restoreSpentBonuses(order.orderNumber, effectiveUserId);
    }

    const purchaseReversal = await BonusService.reversePurchaseBonus(
      order.orderNumber,
      projectId
    );
    const referralReversal = await ReferralService.reverseReferralBonus(
      order.orderNumber,
      projectId
    );
    const referralReversals = await db.transaction.findMany({
      where: {
        type: 'REFUND',
        isReferralBonus: true,
        metadata: { path: ['orderId'], equals: order.orderNumber }
      },
      select: { metadata: true }
    });
    const referralShortfall = referralReversals.reduce((sum, transaction) => {
      const reversalMetadata = jsonRecord(transaction.metadata);
      return sum + numericMetadata(reversalMetadata, 'shortfall');
    }, 0);
    const shortfall = purchaseReversal.shortfall + referralShortfall;

    const purchaseMetadata = jsonRecord(purchaseEarn?.metadata ?? null);
    const recordedPurchaseAmount = Number(order.accountedPurchaseAmount);
    const identifiableLegacyAmount = purchaseEarn
      ? numericMetadata(purchaseMetadata, 'purchaseTotalAmount') ||
        numericMetadata(purchaseMetadata, 'purchaseAmount') ||
        Number(order.totalAmount)
      : 0;
    const purchaseAmount =
      recordedPurchaseAmount > 0
        ? recordedPurchaseAmount
        : Math.max(0, identifiableLegacyAmount);
    const wasLegacy =
      claimedFromLegacy ||
      (recordedPurchaseAmount === 0 && order.accountedAt === null);
    const legacyPurchaseUnverified =
      wasLegacy && purchaseAmount === 0 && Number(order.totalAmount) > 0;
    const finalAccountingState: OrderAccountingState =
      shortfall > 0 || referralReversal.failures > 0 || legacyPurchaseUnverified
        ? 'PARTIALLY_REVERSED'
        : 'REVERSED';

    await db.$transaction(async (tx) => {
      const finalized = await tx.order.updateMany({
        where: {
          id: orderId,
          projectId,
          accountingState: 'REVERSING',
          reversedAt: claimStartedAt
        },
        data: {
          status: input.status,
          accountingState: finalAccountingState,
          reversalShortfall: shortfall,
          reversedAt: new Date()
        }
      });
      if (finalized.count === 0) {
        throw new OrderAccountingConflictError('Право отката заказа потеряно');
      }

      if (effectiveUserId && purchaseAmount > 0) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${effectiveUserId} FOR UPDATE`
        );
        const user = await tx.user.findFirst({
          where: { id: effectiveUserId, projectId },
          select: { totalPurchases: true }
        });
        if (user) {
          const nextTotalPurchases = Math.max(
            0,
            Number(user.totalPurchases) - purchaseAmount
          );
          const currentLevel = await resolveLevelName(
            tx,
            projectId,
            nextTotalPurchases
          );
          await tx.user.update({
            where: { id: effectiveUserId },
            data: { totalPurchases: nextTotalPurchases, currentLevel }
          });
        }
      }

      await tx.orderHistory.create({
        data: {
          orderId,
          status: input.status,
          comment: input.comment,
          changedBy: input.changedBy,
          metadata: {
            accountingState: finalAccountingState,
            reversalShortfall: shortfall,
            legacyPurchaseUnverified
          }
        }
      });
    });

    if (legacyPurchaseUnverified) {
      logger.warn('Legacy order purchase total could not be safely reversed', {
        orderId,
        orderNumber: order.orderNumber,
        projectId,
        component: 'order-accounting-service'
      });
    }
    logger.info('Order accounting reversed', {
      orderId,
      orderNumber: order.orderNumber,
      projectId,
      accountingState: finalAccountingState,
      reversalShortfall: shortfall,
      component: 'order-accounting-service'
    });
  }
}
