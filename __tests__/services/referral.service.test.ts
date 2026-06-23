/**
 * @file: referral.service.test.ts
 * @description: Тесты расчёта реферальной статистики и b2b-фильтра партнёрских ролей
 * @project: SaaS Bonus System
 */

import { ReferralService } from '@/lib/services/referral.service';
import { BonusService } from '@/lib/services/user.service';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/services/user.service');

describe('ReferralService.getReferralStats', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const projectId = 'project-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes totals, period metrics and UTM sources', async () => {
    mockDb.user.count = jest
      .fn()
      .mockResolvedValueOnce(10) // totalReferrals
      .mockResolvedValueOnce(5); // activeReferrals

    mockDb.transaction.aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: 123.45 } }) // totalReferralBonuses
      .mockResolvedValueOnce({ _sum: { amount: 23.45 } }); // periodBonus

    mockDb.transaction.findMany = jest
      .fn()
      .mockResolvedValue([{ amount: 100 }, { amount: 50 }] as any);

    mockDb.user.findMany = jest.fn().mockResolvedValue([] as any);

    mockDb.user.groupBy = jest.fn().mockResolvedValue([
      {
        utmSource: 'ads',
        utmMedium: 'cpc',
        utmCampaign: 'spring',
        _count: { _all: 3 }
      }
    ] as any);

    const stats = await ReferralService.getReferralStats(projectId);

    expect(stats.totalReferrals).toBe(10);
    expect(stats.activeReferrers).toBe(5);
    expect(stats.totalBonusPaid).toBeCloseTo(123.45);
    expect(stats.periodBonusPaid).toBeCloseTo(23.45);
    expect(stats.averageOrderValue).toBeGreaterThan(0);
    expect(stats.utmSources[0].utm_source).toBe('ads');
  });
});

describe('ReferralService.findReferrer (b2b partner roles)', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const projectId = 'project-1';
  const utmRef = 'user-ref-1';

  const buildUser = (partnerRole: string) =>
    ({
      id: utmRef,
      projectId,
      partnerRole,
      isActive: true,
      totalPurchases: 100,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: null,
      referredBy: null
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the user when enablePartnerRoles=false even if user is CLIENT', async () => {
    mockDb.project.findUnique = jest
      .fn()
      .mockResolvedValue({ enablePartnerRoles: false } as any);
    mockDb.user.findFirst = jest.fn().mockResolvedValue(buildUser('CLIENT'));

    const result = await ReferralService.findReferrer(projectId, utmRef);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(utmRef);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns null and logs warn when enablePartnerRoles=true and user is CLIENT', async () => {
    mockDb.project.findUnique = jest
      .fn()
      .mockResolvedValue({ enablePartnerRoles: true } as any);
    mockDb.user.findFirst = jest.fn().mockResolvedValue(buildUser('CLIENT'));

    const result = await ReferralService.findReferrer(projectId, utmRef);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ reason: 'client_role_excluded' })
    );
  });

  it.each([
    ['TRAINER', false],
    ['TRAINER', true],
    ['MANAGER', false],
    ['MANAGER', true],
    ['DIRECTOR', false],
    ['DIRECTOR', true]
  ])(
    'returns the user when role=%s and enablePartnerRoles=%s',
    async (role, flag) => {
      mockDb.project.findUnique = jest
        .fn()
        .mockResolvedValue({ enablePartnerRoles: flag } as any);
      mockDb.user.findFirst = jest.fn().mockResolvedValue(buildUser(role));

      const result = await ReferralService.findReferrer(projectId, utmRef);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(utmRef);
      expect(logger.warn).not.toHaveBeenCalled();
    }
  );
});

describe('ReferralService.generateReferralLink (b2b partner roles)', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const baseUrl = 'https://shop.example.com';
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when enablePartnerRoles=true and user is CLIENT', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      partnerRole: 'CLIENT',
      project: { enablePartnerRoles: true }
    } as any);

    await expect(
      ReferralService.generateReferralLink(userId, baseUrl)
    ).rejects.toThrow('Реферальная ссылка доступна только партнёрам');
  });

  it('returns a URL with utm_ref when enablePartnerRoles=false even for CLIENT', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      partnerRole: 'CLIENT',
      project: { enablePartnerRoles: false }
    } as any);

    const link = await ReferralService.generateReferralLink(userId, baseUrl);

    expect(link).toContain(`utm_ref=${userId}`);
    expect(link).toMatch(/^https:\/\/shop\.example\.com/);
  });

  it('returns a URL when user is TRAINER and flag is on', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      partnerRole: 'TRAINER',
      project: { enablePartnerRoles: true }
    } as any);

    const link = await ReferralService.generateReferralLink(userId, baseUrl);

    expect(link).toContain(`utm_ref=${userId}`);
  });
});

describe('ReferralService.processReferralBonus (atomic + observable payout)', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const mockAwardBonus = BonusService.awardBonus as jest.Mock;
  const projectId = 'project-1';
  const buyerId = 'buyer-1';
  const purchaseAmount = 1000;

  // 3-уровневая цепочка предков: L1 -> L2 -> L3
  const chain = [
    {
      id: 'ref-l1',
      firstName: 'Lvl1',
      lastName: 'Trainer',
      email: 'l1@example.com',
      phone: null,
      referredBy: 'ref-l2'
    },
    {
      id: 'ref-l2',
      firstName: 'Lvl2',
      lastName: 'Manager',
      email: 'l2@example.com',
      phone: null,
      referredBy: 'ref-l3'
    },
    {
      id: 'ref-l3',
      firstName: 'Lvl3',
      lastName: 'Director',
      email: 'l3@example.com',
      phone: null,
      referredBy: null
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Покупатель с привязкой к рефереру; коммерческий план выключен,
    // поэтому используются уровни базовой реферальной программы.
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      id: buyerId,
      projectId,
      firstName: 'Buyer',
      lastName: 'One',
      email: 'buyer@example.com',
      phone: null,
      referredBy: 'ref-l1',
      project: { referralPlansEnabled: false },
      referralAttribution: null
    } as any);

    // Партнёрские роли выключены -> resolveReferrerChain.
    mockDb.project.findUnique = jest
      .fn()
      .mockResolvedValue({ enablePartnerRoles: false } as any);

    // 3-уровневая программа: 10% / 5% / 2%.
    jest.spyOn(ReferralService, 'getReferralProgram').mockResolvedValue({
      isActive: true,
      minPurchaseAmount: 0,
      referrerBonus: 0,
      levels: [
        { level: 1, percent: 10, isActive: true },
        { level: 2, percent: 5, isActive: true },
        { level: 3, percent: 2, isActive: true }
      ]
    } as any);

    jest
      .spyOn(ReferralService as any, 'resolveReferrerChain')
      .mockResolvedValue(chain as any);
  });

  it('pays the full 3-level chain and returns no partialFailure', async () => {
    mockAwardBonus
      .mockResolvedValueOnce({ id: 'bonus-l1' })
      .mockResolvedValueOnce({ id: 'bonus-l2' })
      .mockResolvedValueOnce({ id: 'bonus-l3' });

    const result = await ReferralService.processReferralBonus(
      buyerId,
      purchaseAmount,
      'order-1'
    );

    expect(mockAwardBonus).toHaveBeenCalledTimes(3);
    expect(result.bonusAwarded).toBe(true);
    expect(result.payouts).toHaveLength(3);
    expect(result.payouts?.map((p) => p.level)).toEqual([1, 2, 3]);
    expect(result.partialFailure).toBeUndefined();
  });

  it('aborts on mid-chain NON-P2002 failure without throwing and reports partialFailure', async () => {
    const failure = new Error('DB blip on level 2');
    mockAwardBonus
      .mockResolvedValueOnce({ id: 'bonus-l1' }) // L1 succeeds
      .mockRejectedValueOnce(failure); // L2 throws (non-P2002)

    let result: Awaited<
      ReturnType<typeof ReferralService.processReferralBonus>
    >;

    // Не должно пробрасывать ошибку (иначе сломается чек-аут покупателя).
    await expect(
      (async () => {
        result = await ReferralService.processReferralBonus(
          buyerId,
          purchaseAmount,
          'order-2'
        );
      })()
    ).resolves.not.toThrow();

    // L1 выплачен, L2 упал -> L3 не вызван.
    expect(mockAwardBonus).toHaveBeenCalledTimes(2);

    expect(result!.bonusAwarded).toBe(false);
    expect(result!.partialFailure).toBeDefined();
    expect(result!.partialFailure?.paidLevels).toEqual([1]);
    expect(result!.partialFailure?.failedAtLevel).toBe(2);
    expect(result!.partialFailure?.reason).toContain('DB blip on level 2');

    // Структурный error-лог, называющий выплаченные уровни.
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        paidLevels: [1],
        failedAtLevel: 2,
        component: 'referral-service'
      })
    );
  });
});
