/**
 * @file: payout.service.test.ts
 * @description: План 007 — машина состояний вывода b2b-комиссии. Резерв на
 *   REQUESTED, возврат на REJECTED/CANCELLED/FAILED, отсутствие повторного
 *   дебета на PAID, идемпотентность и запрещённые переходы.
 * @project: SaaS Bonus System
 */

import { PayoutService } from '@/lib/services/payout.service';
import { db } from '@/lib/db';
import { BonusService } from '@/lib/services/user.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/services/user.service');

const mockDb = db as jest.Mocked<typeof db>;
const mockUser = BonusService as jest.Mocked<typeof BonusService>;

const projectId = 'project-1';
const userId = 'user-1';

function payoutRow(over: Partial<any> = {}) {
  return {
    id: 'payout-1',
    projectId,
    userId,
    amount: 500,
    status: 'REQUESTED',
    ledgerBatchId: 'batch-1',
    ...over
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockUser.spendBonuses as jest.Mock) = jest.fn().mockResolvedValue([]);
  (mockUser.awardBonus as jest.Mock) = jest.fn().mockResolvedValue({});
  (mockDb as any).referralProgram = {
    findUnique: jest.fn().mockResolvedValue({ payoutMinAmount: 0 })
  };
  (mockDb as any).payout = {
    findUnique: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn().mockResolvedValue(payoutRow()),
    updateMany: jest.fn()
  };
});

describe('PayoutService.requestPayout', () => {
  it('резервирует бонусы и создаёт заявку REQUESTED', async () => {
    const result = await PayoutService.requestPayout({
      projectId,
      userId,
      amount: 500
    });

    expect(mockUser.spendBonuses).toHaveBeenCalledWith(
      userId,
      500,
      expect.any(String),
      expect.objectContaining({ source: 'payout' })
    );
    expect((mockDb as any).payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REQUESTED', userId })
      })
    );
    expect(result.status).toBe('REQUESTED');
  });

  it('отклоняет сумму <= 0 без резерва', async () => {
    await expect(
      PayoutService.requestPayout({ projectId, userId, amount: 0 })
    ).rejects.toThrow('больше 0');
    expect(mockUser.spendBonuses).not.toHaveBeenCalled();
  });

  it('отклоняет сумму ниже порога проекта без резерва', async () => {
    (mockDb as any).referralProgram.findUnique = jest
      .fn()
      .mockResolvedValue({ payoutMinAmount: 1000 });

    await expect(
      PayoutService.requestPayout({ projectId, userId, amount: 500 })
    ).rejects.toThrow('Минимальная сумма');
    expect(mockUser.spendBonuses).not.toHaveBeenCalled();
  });

  it('идемпотентен по externalId — не резервирует повторно', async () => {
    (mockDb as any).payout.findUnique = jest
      .fn()
      .mockResolvedValue(payoutRow({ id: 'existing' }));

    const result = await PayoutService.requestPayout({
      projectId,
      userId,
      amount: 500,
      externalId: 'dup-key'
    });

    expect(result.id).toBe('existing');
    expect(mockUser.spendBonuses).not.toHaveBeenCalled();
    expect((mockDb as any).payout.create).not.toHaveBeenCalled();
  });

  it('пробрасывает ошибку нехватки баланса (резерв не прошёл, заявки нет)', async () => {
    (mockUser.spendBonuses as jest.Mock) = jest
      .fn()
      .mockRejectedValue(new Error('Недостаточно бонусов. Доступно: 100'));

    await expect(
      PayoutService.requestPayout({ projectId, userId, amount: 500 })
    ).rejects.toThrow('Недостаточно бонусов');
    expect((mockDb as any).payout.create).not.toHaveBeenCalled();
  });

  it('при сбое создания заявки после резерва возвращает бонусы', async () => {
    (mockDb as any).payout.create = jest
      .fn()
      .mockRejectedValue(new Error('db down'));

    await expect(
      PayoutService.requestPayout({ projectId, userId, amount: 500 })
    ).rejects.toThrow('db down');
    // резерв возвращён через awardBonus
    expect(mockUser.awardBonus).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, userId })
    );
  });
});

describe('PayoutService переходы состояний', () => {
  it('REQUESTED → REJECTED возвращает резерв', async () => {
    (mockDb as any).payout.updateMany = jest
      .fn()
      .mockResolvedValue({ count: 1 });
    (mockDb as any).payout.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(payoutRow({ status: 'REJECTED' }));

    await PayoutService.rejectPayout('payout-1', 'admin-1', 'нет реквизитов');

    expect((mockDb as any).payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payout-1', status: { in: ['REQUESTED'] } },
        data: expect.objectContaining({ status: 'REJECTED' })
      })
    );
    expect(mockUser.awardBonus).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500,
        externalId: 'payout_refund_payout-1'
      })
    );
  });

  it('APPROVED → PAID НЕ списывает повторно (без awardBonus/spendBonuses)', async () => {
    (mockDb as any).payout.updateMany = jest
      .fn()
      .mockResolvedValue({ count: 1 });
    (mockDb as any).payout.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(payoutRow({ status: 'PAID' }));

    const result = await PayoutService.markPaid('payout-1', 'admin-1', 'ПП-42');

    expect(result.status).toBe('PAID');
    expect(mockUser.awardBonus).not.toHaveBeenCalled();
    expect(mockUser.spendBonuses).not.toHaveBeenCalled();
  });

  it('запрещённый переход (PAID на REQUESTED-заявке) бросает и не возвращает резерв', async () => {
    (mockDb as any).payout.updateMany = jest
      .fn()
      .mockResolvedValue({ count: 0 });
    (mockDb as any).payout.findUnique = jest
      .fn()
      .mockResolvedValue(payoutRow({ status: 'REQUESTED' }));

    await expect(PayoutService.markPaid('payout-1', 'admin-1')).rejects.toThrow(
      'Недопустимый переход'
    );
    expect(mockUser.awardBonus).not.toHaveBeenCalled();
  });

  it('REQUESTED → CANCELLED возвращает резерв', async () => {
    (mockDb as any).payout.findUnique = jest.fn().mockResolvedValue({ userId });
    (mockDb as any).payout.updateMany = jest
      .fn()
      .mockResolvedValue({ count: 1 });
    (mockDb as any).payout.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(payoutRow({ status: 'CANCELLED' }));

    await PayoutService.cancelPayout('payout-1', userId);

    expect(mockUser.awardBonus).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'payout_refund_payout-1' })
    );
  });

  it('чужой пользователь не может отозвать заявку (статус не меняется)', async () => {
    (mockDb as any).payout.findUnique = jest
      .fn()
      .mockResolvedValue({ userId: 'owner' });
    (mockDb as any).payout.updateMany = jest.fn();

    await expect(
      PayoutService.cancelPayout('payout-1', 'intruder')
    ).rejects.toThrow('чужую заявку');
    expect((mockDb as any).payout.updateMany).not.toHaveBeenCalled();
    expect(mockUser.awardBonus).not.toHaveBeenCalled();
  });
});
