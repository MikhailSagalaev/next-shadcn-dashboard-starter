/**
 * @file: payout.service.ts
 * @description: b2b partner cashout (план 007 v1, ручная выплата). Реестр заявок
 *   Payout поверх бонусного ledger'а: резерв бонусов на REQUESTED, окончательное
 *   списание на PAID, возврат резерва на REJECTED/CANCELLED/FAILED. Машина
 *   состояний с атомарными guard-переходами.
 * @project: SaaS Bonus System
 * @dependencies: Prisma, BonusService.spendBonuses/awardBonus
 * @see: docs/partner-payout-flow-design.md
 */

import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Payout, PayoutStatus } from '@prisma/client';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { BonusService } from './user.service';
import type { CreateBonusInput } from '@/types/bonus';

export interface RequestPayoutInput {
  projectId: string;
  userId: string;
  amount: number;
  requestTelegramId?: bigint | number;
  payoutMethod?: string;
  payoutDetails?: Record<string, unknown>;
  /** Канал заявки: 'telegram_bot' (по умолчанию) | 'max_bot'. */
  requestSource?: string;
  /** Детерминированный ключ для идемпотентности двойного тапа в боте. */
  externalId?: string;
}

export class PayoutService {
  /**
   * Партнёр подаёт заявку на вывод. Бонусы РЕЗЕРВИРУЮТСЯ сразу (debit через
   * spendBonuses): между REQUESTED и PAID их уже нельзя потратить в магазине или
   * вывести второй заявкой. Аналог hold/authorization в платёжных системах.
   */
  static async requestPayout(input: RequestPayoutInput): Promise<Payout> {
    const { projectId, userId, amount } = input;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Сумма вывода должна быть больше 0');
    }

    // Идемпотентность: тот же externalId → возвращаем существующую заявку,
    // НЕ резервируем повторно.
    if (input.externalId) {
      const existing = await db.payout.findUnique({
        where: { externalId: input.externalId }
      });
      if (existing) {
        if (existing.projectId !== projectId || existing.userId !== userId) {
          throw new Error('Ключ идемпотентности уже использован');
        }
        return existing;
      }
    }

    const user = await db.user.findFirst({
      where: {
        id: userId,
        projectId,
        isActive: true,
        OR: [
          { partnerRole: { not: 'CLIENT' } },
          {
            organizationMemberships: {
              some: {
                projectId,
                OR: [{ level: { not: null } }, { canManage: true }]
              }
            }
          }
        ]
      },
      select: { id: true }
    });
    if (!user) throw new Error('Партнёр не принадлежит активному проекту');

    // Порог вывода из настроек b2b-программы (план 007, 0 = без порога).
    const program = await db.referralProgram.findUnique({
      where: { projectId },
      select: { payoutMinAmount: true, payoutHoldDays: true }
    });
    const minAmount = Number(program?.payoutMinAmount ?? 0);
    if (minAmount > 0 && amount < minAmount) {
      throw new Error(`Минимальная сумма вывода: ${minAmount}`);
    }

    const holdDays = Math.max(0, program?.payoutHoldDays ?? 0);
    const createdBefore = new Date(Date.now() - holdDays * 24 * 60 * 60 * 1000);
    const eligible = await db.bonus.aggregate({
      where: {
        userId,
        type: 'REFERRAL',
        isUsed: false,
        createdAt: { lte: createdBefore },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      _sum: { amount: true }
    });
    const withdrawableAmount = Number(eligible._sum.amount ?? 0);
    if (withdrawableAmount < amount) {
      throw new Error(
        holdDays > 0
          ? `Недостаточно доступной партнёрской комиссии после выдержки ${holdDays} дн. Доступно: ${withdrawableAmount}`
          : `Недостаточно доступной партнёрской комиссии. Доступно: ${withdrawableAmount}`
      );
    }

    // Резерв бонусов. spendBonuses атомарно проверяет баланс и бросает при
    // нехватке (нельзя зарезервировать больше заработанного-и-непотраченного).
    const spendBatchId = randomUUID();
    const reservingPayout = await db.payout.create({
      data: {
        projectId,
        userId,
        amount: new Prisma.Decimal(amount),
        status: 'RESERVING',
        requestSource: input.requestSource ?? 'telegram_bot',
        requestTelegramId:
          input.requestTelegramId != null
            ? BigInt(input.requestTelegramId)
            : null,
        payoutMethod: input.payoutMethod ?? null,
        payoutDetails: (input.payoutDetails ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        externalId: input.externalId ?? null,
        ledgerBatchId: spendBatchId,
        metadata: { reserveSpendBatchId: spendBatchId }
      }
    });
    try {
      await BonusService.spendBonuses(
        userId,
        amount,
        'Резерв под вывод средств',
        {
          source: 'payout',
          spendBatchId
        },
        spendBatchId,
        { bonusType: 'REFERRAL', createdBefore }
      );
    } catch (error) {
      await db.payout.deleteMany({
        where: { id: reservingPayout.id, status: 'RESERVING' }
      });
      throw error;
    }

    try {
      const payout = await db.payout.update({
        where: { id: reservingPayout.id },
        data: {
          projectId,
          userId,
          amount: new Prisma.Decimal(amount),
          status: 'REQUESTED',
          requestSource: input.requestSource ?? 'telegram_bot',
          requestTelegramId:
            input.requestTelegramId != null
              ? BigInt(input.requestTelegramId)
              : null,
          payoutMethod: input.payoutMethod ?? null,
          payoutDetails: (input.payoutDetails ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          externalId: input.externalId ?? null,
          ledgerBatchId: spendBatchId,
          metadata: { reserveSpendBatchId: spendBatchId }
        }
      });

      logger.info('Payout requested (reserve held)', {
        payoutId: payout.id,
        projectId,
        userId,
        amount,
        spendBatchId,
        component: 'payout-service'
      });
      return payout;
    } catch (err) {
      // Заявку создать не удалось ПОСЛЕ резерва — нельзя молча списать бонусы.
      // Возвращаем резерв (идемпотентно) и пробрасываем ошибку.
      await PayoutService.creditBack(
        userId,
        amount,
        `payout_reserve_rollback_${spendBatchId}`,
        { source: 'payout_reserve_rollback', spendBatchId }
      );
      await db.payout.deleteMany({
        where: { id: reservingPayout.id, status: 'RESERVING' }
      });
      logger.error('Payout create failed after reserve — reserve refunded', {
        projectId,
        userId,
        amount,
        spendBatchId,
        error: err instanceof Error ? err.message : String(err),
        component: 'payout-service'
      });
      throw err;
    }
  }

  /** REQUESTED → APPROVED (админ одобрил, движения денег нет). */
  static async approvePayout(
    payoutId: string,
    adminId: string
  ): Promise<Payout> {
    return PayoutService.transition(payoutId, ['REQUESTED'], 'APPROVED', {
      reviewedBy: adminId,
      reviewedAt: new Date()
    });
  }

  /** REQUESTED → REJECTED (админ отклонил) + возврат резерва. */
  static async rejectPayout(
    payoutId: string,
    adminId: string,
    reason?: string
  ): Promise<Payout> {
    return PayoutService.transitionWithRefund(
      payoutId,
      ['REQUESTED'],
      'REJECTED',
      {
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectReason: reason ?? null
      }
    );
  }

  /** REQUESTED → CANCELLED (партнёр отозвал до одобрения) + возврат резерва. */
  static async cancelPayout(
    payoutId: string,
    byUserId?: string
  ): Promise<Payout> {
    // Защита владельца ДО перехода: иначе чужой вызов успел бы флипнуть статус
    // в CANCELLED ещё до выброса ошибки.
    if (byUserId) {
      const existing = await db.payout.findUnique({
        where: { id: payoutId },
        select: { userId: true }
      });
      if (!existing) throw new Error(`Заявка на вывод ${payoutId} не найдена`);
      if (existing.userId !== byUserId) {
        throw new Error('Нельзя отозвать чужую заявку на вывод');
      }
    }

    return PayoutService.transitionWithRefund(
      payoutId,
      ['REQUESTED'],
      'CANCELLED',
      { cancelledAt: new Date() }
    );
  }

  /**
   * APPROVED → PAID (админ выплатил деньги вручную и отметил выплаченным).
   * Бонусы уже списаны на REQUESTED — повторного дебета нет, резерв становится
   * окончательным.
   */
  static async markPaid(
    payoutId: string,
    adminId: string,
    externalRef?: string
  ): Promise<Payout> {
    return PayoutService.transition(payoutId, ['APPROVED'], 'PAID', {
      paidBy: adminId,
      paidAt: new Date(),
      externalRef: externalRef ?? null
    });
  }

  /** APPROVED → FAILED (выплата физически не прошла) + возврат резерва. */
  static async failPayout(
    payoutId: string,
    adminId: string,
    reason?: string
  ): Promise<Payout> {
    return PayoutService.transitionWithRefund(
      payoutId,
      ['APPROVED'],
      'FAILED',
      { reviewedBy: adminId, failReason: reason ?? null }
    );
  }

  /**
   * Makes the refund itself a durable state. If bonus credit fails, the payout
   * stays REFUND_PENDING and a reconciler can safely retry by externalId.
   */
  private static async transitionWithRefund(
    payoutId: string,
    from: PayoutStatus[],
    target: Extract<PayoutStatus, 'REJECTED' | 'CANCELLED' | 'FAILED'>,
    data: Prisma.PayoutUpdateManyMutationInput
  ): Promise<Payout> {
    const claimed = await db.payout.updateMany({
      where: { id: payoutId, status: { in: from } },
      data: {
        ...data,
        status: 'REFUND_PENDING',
        refundTargetStatus: target,
        refundCompletedAt: null
      }
    });
    if (claimed.count !== 1) {
      const current = await db.payout.findUnique({ where: { id: payoutId } });
      if (!current) throw new Error(`Заявка на вывод ${payoutId} не найдена`);
      throw new Error(
        `Недопустимый переход выплаты ${payoutId}: ${current.status} → ${target}`
      );
    }

    const pending = await db.payout.findUniqueOrThrow({
      where: { id: payoutId }
    });
    await PayoutService.refundReserve(pending);
    return PayoutService.finishRefund(pending.id, target);
  }

  private static async finishRefund(
    payoutId: string,
    target: Extract<PayoutStatus, 'REJECTED' | 'CANCELLED' | 'FAILED'>
  ): Promise<Payout> {
    const finalized = await db.payout.updateMany({
      where: {
        id: payoutId,
        status: 'REFUND_PENDING',
        refundTargetStatus: target
      },
      data: {
        status: target,
        refundCompletedAt: new Date()
      }
    });
    if (finalized.count !== 1) {
      throw new Error(`Не удалось завершить возврат выплаты ${payoutId}`);
    }
    return db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  }

  static async reconcilePending(limit = 100): Promise<{
    reservingRecovered: number;
    refundsRecovered: number;
    failures: number;
  }> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const [reserving, refunds] = await Promise.all([
      db.payout.findMany({
        where: { status: 'RESERVING', updatedAt: { lt: cutoff } },
        take: limit,
        orderBy: { updatedAt: 'asc' }
      }),
      db.payout.findMany({
        where: { status: 'REFUND_PENDING' },
        take: limit,
        orderBy: { updatedAt: 'asc' }
      })
    ]);

    let reservingRecovered = 0;
    let refundsRecovered = 0;
    let failures = 0;

    for (const payout of reserving) {
      try {
        const ledgerBatchId = payout.ledgerBatchId;
        const spend = ledgerBatchId
          ? await db.transaction.findFirst({
              where: {
                userId: payout.userId,
                type: 'SPEND',
                OR: [
                  { externalId: { startsWith: `${ledgerBatchId}:` } },
                  {
                    metadata: {
                      path: ['spendBatchId'],
                      equals: ledgerBatchId
                    }
                  }
                ]
              },
              select: { id: true }
            })
          : null;
        if (spend) {
          await db.payout.updateMany({
            where: { id: payout.id, status: 'RESERVING' },
            data: { status: 'REQUESTED' }
          });
        } else {
          await db.payout.deleteMany({
            where: { id: payout.id, status: 'RESERVING' }
          });
        }
        reservingRecovered += 1;
      } catch (error) {
        failures += 1;
        logger.error('Failed to reconcile reserving payout', {
          payoutId: payout.id,
          error: error instanceof Error ? error.message : String(error),
          component: 'payout-service'
        });
      }
    }

    for (const payout of refunds) {
      try {
        const target = payout.refundTargetStatus;
        if (!target || !['REJECTED', 'CANCELLED', 'FAILED'].includes(target)) {
          throw new Error('Некорректный целевой статус возврата');
        }
        await PayoutService.refundReserve(payout);
        await PayoutService.finishRefund(
          payout.id,
          target as Extract<PayoutStatus, 'REJECTED' | 'CANCELLED' | 'FAILED'>
        );
        refundsRecovered += 1;
      } catch (error) {
        failures += 1;
        logger.error('Failed to reconcile payout refund', {
          payoutId: payout.id,
          error: error instanceof Error ? error.message : String(error),
          component: 'payout-service'
        });
      }
    }

    return { reservingRecovered, refundsRecovered, failures };
  }

  /**
   * Атомарный guard-переход: updateMany с фильтром по текущему статусу гарантирует,
   * что только один актор флипнет состояние (защита от гонок/двойных кликов).
   */
  private static async transition(
    payoutId: string,
    from: PayoutStatus[],
    to: PayoutStatus,
    data: Prisma.PayoutUpdateManyMutationInput
  ): Promise<Payout> {
    const res = await db.payout.updateMany({
      where: { id: payoutId, status: { in: from } },
      data: { ...data, status: to }
    });

    if (res.count !== 1) {
      const current = await db.payout.findUnique({ where: { id: payoutId } });
      if (!current) throw new Error(`Заявка на вывод ${payoutId} не найдена`);
      throw new Error(
        `Недопустимый переход выплаты ${payoutId}: ${current.status} → ${to} (ожидался один из ${from.join('/')})`
      );
    }

    const updated = await db.payout.findUniqueOrThrow({
      where: { id: payoutId }
    });
    logger.info('Payout transition', {
      payoutId,
      to,
      component: 'payout-service'
    });
    return updated;
  }

  /**
   * Возврат зарезервированных бонусов партнёру. Идемпотентно по детерминированному
   * externalId (`payout_refund_<id>`) — awardBonus глотает P2002 как «уже возвращено».
   */
  private static async refundReserve(payout: Payout): Promise<void> {
    await PayoutService.creditBack(
      payout.userId,
      Number(payout.amount),
      `payout_refund_${payout.id}`,
      { source: 'payout_refund', payoutId: payout.id }
    );
    logger.info('Payout reserve refunded', {
      payoutId: payout.id,
      userId: payout.userId,
      amount: Number(payout.amount),
      component: 'payout-service'
    });
  }

  /** Кредит бонусов обратно через существующий идемпотентный awardBonus. */
  private static async creditBack(
    userId: string,
    amount: number,
    externalId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await BonusService.awardBonus({
      userId,
      amount,
      type: 'REFERRAL',
      isReferralBonus: true,
      description: 'Возврат резерва вывода средств',
      metadata,
      externalId
    } as CreateBonusInput & { externalId?: string });
  }
}
