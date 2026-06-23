/**
 * @file: order-refund-reversal.test.ts
 * @description: Регрессионные тесты отката бонуса за покупку и реферальных
 *   выплат при отмене/возврате заказа (план 003).
 * @project: SaaS Bonus System
 */

import { BonusService } from '@/lib/services/user.service';
import { ReferralService } from '@/lib/services/referral.service';
import { db } from '@/lib/db';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/telegram/notifications');

describe('BonusService.reversePurchaseBonus', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const orderId = 'ORDER-100';
  const externalId = `tilda_order_${orderId}`;
  const reversalExternalId = `reversal_tilda_order_${orderId}`;

  beforeEach(() => {
    jest.clearAllMocks();
    // $transaction исполняет колбэк с mockDb как tx.
    (mockDb as any).$transaction = jest.fn(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockDb);
      return Promise.all(cb);
    });
    mockDb.bonus.update = jest.fn().mockResolvedValue({} as any);
  });

  it('1. создаёт ровно одну REFUND-транзакцию и убирает бонус из баланса', async () => {
    mockDb.transaction.findUnique = jest
      .fn()
      // existingReversal -> null
      .mockResolvedValueOnce(null)
      // earnTransaction -> найдена, бонус не использован
      .mockResolvedValueOnce({
        id: 'earn-1',
        userId: 'buyer-1',
        amount: 350,
        externalId,
        bonus: { id: 'bonus-1', isUsed: false, amount: 350 }
      } as any);
    mockDb.transaction.create = jest.fn().mockResolvedValue({} as any);

    const result = await BonusService.reversePurchaseBonus(orderId, 'proj-1');

    expect(result.reversed).toBe(true);
    expect(result.amount).toBe(350);
    expect(result.shortfall).toBe(0);

    // Бонус помечен использованным (исключён из баланса).
    expect(mockDb.bonus.update).toHaveBeenCalledWith({
      where: { id: 'bonus-1' },
      data: { isUsed: true }
    });

    // Ровно одна компенсирующая транзакция.
    expect(mockDb.transaction.create).toHaveBeenCalledTimes(1);
    const created = (mockDb.transaction.create as jest.Mock).mock.calls[0][0];
    expect(created.data.type).toBe('REFUND');
    expect(created.data.amount).toBe(350);
    expect(created.data.externalId).toBe(reversalExternalId);
  });

  it('3. уже потрачено: логирует недостачу и не уводит баланс в минус', async () => {
    mockDb.transaction.findUnique = jest
      .fn()
      .mockResolvedValueOnce(null) // existingReversal
      .mockResolvedValueOnce({
        id: 'earn-2',
        userId: 'buyer-2',
        amount: 350,
        externalId,
        // Бонус уже использован — остаток к откату = 0.
        bonus: { id: 'bonus-2', isUsed: true, amount: 0 }
      } as any);
    mockDb.transaction.create = jest.fn().mockResolvedValue({} as any);

    const result = await BonusService.reversePurchaseBonus(orderId);

    expect(result.reversed).toBe(true);
    expect(result.amount).toBe(0); // не уходим в минус
    expect(result.shortfall).toBe(350);

    const created = (mockDb.transaction.create as jest.Mock).mock.calls[0][0];
    expect(created.data.amount).toBe(0);
  });

  it('4. no-op: заказ без начисления — ничего не создаёт и не падает', async () => {
    mockDb.transaction.findUnique = jest
      .fn()
      .mockResolvedValueOnce(null) // existingReversal
      .mockResolvedValueOnce(null); // earnTransaction отсутствует
    mockDb.transaction.create = jest.fn();

    const result = await BonusService.reversePurchaseBonus(orderId);

    expect(result.reversed).toBe(false);
    expect(result.amount).toBe(0);
    expect(mockDb.transaction.create).not.toHaveBeenCalled();
  });

  it('идемпотентность: повторный откат не создаёт вторую транзакцию', async () => {
    mockDb.transaction.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'already-reversed' } as any); // existingReversal найдена
    mockDb.transaction.create = jest.fn();

    const result = await BonusService.reversePurchaseBonus(orderId);

    expect(result.reversed).toBe(false);
    expect(mockDb.transaction.create).not.toHaveBeenCalled();
  });
});

describe('ReferralService.reverseReferralBonus', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const orderId = 'ORDER-200';

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDb as any).$transaction = jest.fn(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockDb);
      return Promise.all(cb);
    });
    mockDb.bonus.update = jest.fn().mockResolvedValue({} as any);
    mockDb.transaction.count = jest.fn().mockResolvedValue(0 as any);
  });

  it('2. откатывает обе реферальные выплаты', async () => {
    mockDb.transaction.findMany = jest.fn().mockResolvedValue([
      {
        id: 'ref-tx-1',
        userId: 'trainer-1',
        amount: 100,
        externalId: `referral_${orderId}_trainer-1_L1`,
        referralUserId: 'buyer-1',
        referralLevel: 1,
        bonus: { id: 'rb-1', isUsed: false, amount: 100 }
      },
      {
        id: 'ref-tx-2',
        userId: 'manager-1',
        amount: 50,
        externalId: `referral_${orderId}_manager-1_L2`,
        referralUserId: 'buyer-1',
        referralLevel: 2,
        bonus: { id: 'rb-2', isUsed: false, amount: 50 }
      }
    ] as any);
    // Для каждой выплаты: existingReversal -> null.
    mockDb.transaction.findUnique = jest.fn().mockResolvedValue(null);
    mockDb.transaction.create = jest.fn().mockResolvedValue({} as any);

    const result = await ReferralService.reverseReferralBonus(
      orderId,
      'proj-1'
    );

    expect(result.reversedCount).toBe(2);
    expect(result.reversedAmount).toBe(150);
    expect(result.failures).toBe(0);
    expect(mockDb.transaction.create).toHaveBeenCalledTimes(2);

    const createdTypes = (
      mockDb.transaction.create as jest.Mock
    ).mock.calls.map((c) => c[0].data.type);
    expect(createdTypes).toEqual(['REFUND', 'REFUND']);
  });

  it('2b. идемпотентность: повторная отмена не создаёт лишних откатов', async () => {
    mockDb.transaction.findMany = jest.fn().mockResolvedValue([
      {
        id: 'ref-tx-1',
        userId: 'trainer-1',
        amount: 100,
        externalId: `referral_${orderId}_trainer-1_L1`,
        referralUserId: 'buyer-1',
        referralLevel: 1,
        bonus: { id: 'rb-1', isUsed: true, amount: 0 }
      }
    ] as any);
    // existingReversal уже существует.
    mockDb.transaction.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'existing-reversal' } as any);
    mockDb.transaction.create = jest.fn();

    const result = await ReferralService.reverseReferralBonus(orderId);

    expect(result.reversedCount).toBe(0);
    expect(mockDb.transaction.create).not.toHaveBeenCalled();
  });

  it('3b. уже потрачено: откатывает только остаток, не уводя баланс в минус', async () => {
    mockDb.transaction.findMany = jest.fn().mockResolvedValue([
      {
        id: 'ref-tx-1',
        userId: 'trainer-1',
        amount: 100,
        externalId: `referral_${orderId}_trainer-1_L1`,
        referralUserId: 'buyer-1',
        referralLevel: 1,
        // Предок частично потратил: остаток 40 из 100.
        bonus: { id: 'rb-1', isUsed: false, amount: 40 }
      }
    ] as any);
    mockDb.transaction.findUnique = jest.fn().mockResolvedValue(null);
    mockDb.transaction.create = jest.fn().mockResolvedValue({} as any);

    const result = await ReferralService.reverseReferralBonus(orderId);

    expect(result.reversedCount).toBe(1);
    expect(result.reversedAmount).toBe(40);
    const created = (mockDb.transaction.create as jest.Mock).mock.calls[0][0];
    expect(created.data.amount).toBe(40);
    expect(created.data.metadata.shortfall).toBe(60);
  });

  it('4b. no-op: заказ без реферальных выплат ничего не делает и не падает', async () => {
    mockDb.transaction.findMany = jest.fn().mockResolvedValue([] as any);
    mockDb.transaction.create = jest.fn();

    const result = await ReferralService.reverseReferralBonus(orderId);

    expect(result.reversedCount).toBe(0);
    expect(mockDb.transaction.create).not.toHaveBeenCalled();
  });
});
