/**
 * @file: referral-program-payout-settings.test.ts
 * @description: Тесты на сохранение и возврат настроек вывода средств
 *               (payoutMinAmount / payoutHoldDays) реферальной программы
 * @project: SaaS Bonus System
 */

import { Prisma } from '@prisma/client';

import { ReferralService } from '@/lib/services/referral.service';
import { db } from '@/lib/db';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

describe('ReferralService payout settings (payoutMinAmount / payoutHoldDays)', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const projectId = 'project-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildSavedRow = (
    payoutMinAmount: number,
    payoutHoldDays: number
  ): any => ({
    id: 'rp-1',
    projectId,
    isActive: true,
    bonusPercent: 5,
    referrerBonus: new Prisma.Decimal(10),
    minPurchaseAmount: new Prisma.Decimal(0),
    cookieLifetime: 30,
    welcomeBonus: new Prisma.Decimal(0),
    welcomeRewardType: 'BONUS',
    firstPurchaseDiscountPercent: 0,
    payoutMinAmount: new Prisma.Decimal(payoutMinAmount),
    payoutHoldDays,
    description: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    project: null,
    levels: []
  });

  it('persists payoutMinAmount and payoutHoldDays in the data written to Prisma', async () => {
    const updateMock = jest.fn().mockResolvedValue(buildSavedRow(500, 7));

    // $transaction передаёт транзакционный клиент в callback.
    const tx: any = {
      referralProgram: {
        findUnique: jest
          .fn()
          // existing внутри транзакции
          .mockResolvedValueOnce(buildSavedRow(0, 0))
          // финальный findUnique, возвращающий сохранённую строку
          .mockResolvedValueOnce(buildSavedRow(500, 7)),
        update: updateMock,
        create: jest.fn()
      },
      referralLevel: {
        count: jest.fn().mockResolvedValue(1),
        deleteMany: jest.fn(),
        createMany: jest.fn()
      }
    };

    mockDb.$transaction = jest.fn(async (cb: any) => cb(tx)) as any;

    await ReferralService.createOrUpdateReferralProgram({
      projectId,
      referrerBonus: 10,
      refereeBonus: 5,
      payoutMinAmount: 500,
      payoutHoldDays: 7
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const writtenData = updateMock.mock.calls[0][0].data;
    expect(Number(writtenData.payoutMinAmount)).toBe(500);
    expect(writtenData.payoutHoldDays).toBe(7);
  });

  it('returns numeric payoutMinAmount and payoutHoldDays from createOrUpdateReferralProgram', async () => {
    const tx: any = {
      referralProgram: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildSavedRow(0, 0))
          .mockResolvedValueOnce(buildSavedRow(500, 7)),
        update: jest.fn().mockResolvedValue(buildSavedRow(500, 7)),
        create: jest.fn()
      },
      referralLevel: {
        count: jest.fn().mockResolvedValue(1),
        deleteMany: jest.fn(),
        createMany: jest.fn()
      }
    };

    mockDb.$transaction = jest.fn(async (cb: any) => cb(tx)) as any;

    const result = await ReferralService.createOrUpdateReferralProgram({
      projectId,
      referrerBonus: 10,
      refereeBonus: 5,
      payoutMinAmount: 500,
      payoutHoldDays: 7
    });

    expect(typeof result.payoutMinAmount).toBe('number');
    expect(result.payoutMinAmount).toBe(500);
    expect(typeof result.payoutHoldDays).toBe('number');
    expect(result.payoutHoldDays).toBe(7);
  });

  it('getReferralProgram maps Decimal payoutMinAmount to a number', async () => {
    (mockDb as any).referralProgram = {
      findUnique: jest.fn().mockResolvedValue(buildSavedRow(1000, 14))
    };

    const program = await ReferralService.getReferralProgram(projectId);

    expect(program).not.toBeNull();
    expect(typeof program?.payoutMinAmount).toBe('number');
    expect(program?.payoutMinAmount).toBe(1000);
    expect(program?.payoutHoldDays).toBe(14);
  });
});
