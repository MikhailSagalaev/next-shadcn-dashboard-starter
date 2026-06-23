/**
 * @file: payout.service.ts
 * @description: b2b partner cashout (план 007 v1, ручная выплата). Реестр заявок
 *   Payout поверх бонусного ledger'а: резерв бонусов на REQUESTED, окончательное
 *   списание на PAID, возврат резерва на REJECTED/CANCELLED/FAILED. Машина
 *   состояний с атомарными guard-переходами.
 * @project: SaaS Bonus System
 * @dependencies: Prisma, UserService.spendBonuses/awardBonus
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
      if (existing) return existing;
    }

    // Порог вывода из настроек b2b-программы (план 007, 0 = без порога).
    const program = await db.referralProgram.findUnique({
      where: { projectId },
      select: { payoutMinAmount: true }
    });
    const minAmount = Number(program?.payoutMinAmount ?? 0);
    if (minAmount > 0 && amount < minAmount) {
      throw new Error(`Минимальная сумма вывода: ${minAmount}`);
    }

    // Резерв бонусов. spendBonuses атомарно проверяет баланс и бросает при
    // нехватке (нельзя зарезервировать больше заработанного-и-непотраченного).
    const spendBatchId = randomUUID();
    await BonusService.spendBonuses(
      userId,
      amount,
      'Резерв под вывод средств',
      {
        source: 'payout',
        spendBatchId
      }
    );

    try {
      const payout = await db.payout.create({
        data: {
          projectId,
          userId,
          amount: new Prisma.Decimal(amount),
          status: 'REQUESTED',
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
    const payout = await PayoutService.transition(
      payoutId,
      ['REQUESTED'],
      'REJECTED',
      {
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectReason: reason ?? null
      }
    );
    await PayoutService.refundReserve(payout);
    return payout;
  }

  /** REQUESTED → CANCELLED (партнёр отозвал до одобрения) + возврат резерва. */
  static async cancelPayout(
    payoutId: string,
    byUserId?: string
  ): Promise<Payout> {
    const payout = await PayoutService.transition(
      payoutId,
      ['REQUESTED'],
      'CANCELLED',
      { cancelledAt: new Date() }
    );
    // Защита: отзывать может только сам владелец заявки.
    if (byUserId && payout.userId !== byUserId) {
      throw new Error('Нельзя отозвать чужую заявку на вывод');
    }
    await PayoutService.refundReserve(payout);
    return payout;
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
    const payout = await PayoutService.transition(
      payoutId,
      ['APPROVED'],
      'FAILED',
      { reviewedBy: adminId, failReason: reason ?? null }
    );
    await PayoutService.refundReserve(payout);
    return payout;
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
