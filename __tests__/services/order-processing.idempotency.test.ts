/**
 * @file: order-processing.idempotency.test.ts
 * @description: Регрессионные тесты идемпотентности обработки заказов из вебхука
 *               Tilda (повторный/ретраенный вебхук не должен повторно начислять
 *               покупательский бонус и реферальную цепочку).
 * @project: SaaS Bonus System
 */

import { OrderProcessingService } from '@/lib/services/orders/order-processing.service';
import { ReferralService } from '@/lib/services/referral.service';
import { UserService, BonusService } from '@/lib/services/user.service';
import { db } from '@/lib/db';
import type { NormalizedOrder } from '@/lib/services/integration/tilda-parser.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

const mockDb = db as jest.Mocked<typeof db>;

const projectId = 'project-1';

const buildOrder = (
  overrides: Partial<NormalizedOrder> = {}
): NormalizedOrder => ({
  orderId: 'ORDER-100',
  email: 'buyer@example.com',
  phone: '+70000000000',
  name: 'Test Buyer',
  amount: 1000,
  products: [],
  appliedBonuses: 0,
  raw: {},
  ...overrides
});

describe('OrderProcessingService.processOrder idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // The automock of @/lib/db does not always materialize every Prisma model
    // delegate, so ensure the namespaces we touch exist.
    (mockDb as any).order = (mockDb as any).order || {};
    (mockDb as any).project = (mockDb as any).project || {};
    (mockDb as any).analyticsEvent = (mockDb as any).analyticsEvent || {};

    mockDb.project.findUnique = jest
      .fn()
      .mockResolvedValue({
        id: projectId,
        bonusBehavior: 'SPEND_AND_EARN'
      } as any);

    // No spend by default; getUserBalance is only called when appliedBonuses > 0.
    jest
      .spyOn(UserService, 'getUserBalance')
      .mockResolvedValue({ currentBalance: 0 } as any);
  });

  it('happy path: a new orderNumber awards the purchase bonus exactly once', async () => {
    // No pre-existing order.
    mockDb.order.findFirst = jest.fn().mockResolvedValue(null);
    mockDb.order.update = jest.fn().mockResolvedValue({} as any);

    // saveOrder internals.
    mockDb.order.create = jest
      .fn()
      .mockResolvedValue({ id: 'saved-order-1' } as any);
    mockDb.analyticsEvent.create = jest.fn().mockResolvedValue({} as any);

    jest.spyOn(UserService, 'findUserByContact').mockResolvedValue(null as any);
    jest
      .spyOn(UserService, 'createUser')
      .mockResolvedValue({ id: 'user-1', projectId } as any);

    const awardSpy = jest
      .spyOn(BonusService, 'awardPurchaseBonus')
      .mockResolvedValue({ bonus: { amount: 50 } } as any);

    const result = await OrderProcessingService.processOrder(
      projectId,
      buildOrder()
    );

    expect(result.success).toBe(true);
    expect(result.message).not.toBe('Order already processed');
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(awardSpy).toHaveBeenCalledWith(
      'user-1',
      1000,
      'ORDER-100',
      expect.any(String)
    );
  });

  it('duplicate webhook: a second call for the same orderNumber awards nothing and returns "Order already processed"', async () => {
    // An order with this orderNumber already exists.
    mockDb.order.findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'existing-order-1' } as any);

    const awardSpy = jest
      .spyOn(BonusService, 'awardPurchaseBonus')
      .mockResolvedValue({ bonus: { amount: 50 } } as any);
    const createUserSpy = jest.spyOn(UserService, 'createUser');
    const orderCreateSpy = (mockDb.order.create = jest.fn());

    const result = await OrderProcessingService.processOrder(
      projectId,
      buildOrder()
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Order already processed');
    expect(result.data).toEqual(
      expect.objectContaining({ spent: 0, earned: 0, userCreated: false })
    );
    // Zero additional awards, no user creation, no new order row.
    expect(awardSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
    expect(orderCreateSpy).not.toHaveBeenCalled();
  });
});

describe('ReferralService.processReferralBonus idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const setupSingleLevelChain = () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      id: 'buyer-1',
      projectId,
      firstName: 'Buyer',
      lastName: 'One',
      email: 'buyer@example.com',
      phone: null,
      referredBy: 'referrer-1',
      project: { referralPlansEnabled: false },
      referralAttribution: null
    } as any);

    mockDb.project.findUnique = jest
      .fn()
      .mockResolvedValue({ enablePartnerRoles: false } as any);

    jest.spyOn(ReferralService, 'getReferralProgram').mockResolvedValue({
      isActive: true,
      minPurchaseAmount: 0,
      referrerBonus: 10,
      levels: [{ level: 1, percent: 10, isActive: true }]
    } as any);

    jest
      .spyOn(ReferralService as any, 'resolveReferrerChain')
      .mockResolvedValue([{ id: 'referrer-1', referredBy: null }] as any);
  };

  it('passes a deterministic per-payout externalId into awardBonus when orderId is present', async () => {
    setupSingleLevelChain();

    const awardSpy = jest
      .spyOn(BonusService, 'awardBonus')
      .mockResolvedValue({ id: 'bonus-ref-1' } as any);

    const result = await ReferralService.processReferralBonus(
      'buyer-1',
      1000,
      'ORDER-100'
    );

    expect(result.bonusAwarded).toBe(true);
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(awardSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'referrer-1',
        externalId: 'referral_ORDER-100_referrer-1_L1',
        metadata: expect.objectContaining({ orderId: 'ORDER-100' })
      })
    );
  });

  it('referral dedup: a P2002 on the per-payout externalId is tolerated and produces no payout for that level', async () => {
    setupSingleLevelChain();

    const awardSpy = jest
      .spyOn(BonusService, 'awardBonus')
      .mockRejectedValue({ code: 'P2002' } as any);

    const result = await ReferralService.processReferralBonus(
      'buyer-1',
      1000,
      'ORDER-100'
    );

    // The single ancestor was already paid for this order -> no new payout.
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(result.bonusAwarded).toBe(false);
    expect(result.payouts ?? []).toHaveLength(0);
  });
});
