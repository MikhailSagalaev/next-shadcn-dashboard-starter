import { db } from '@/lib/db';
import { PartnerReferralGraphService } from '@/lib/services/partner-referral-graph.service';
import { ReferralService } from '@/lib/services/referral.service';
import { BonusService } from '@/lib/services/user.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/services/user.service');

describe('ReferralService B2B runtime gate', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const mockAwardBonus = BonusService.awardBonus as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('pays a locked B2B graph plan without a classic program or legacy referredBy', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      id: 'buyer',
      projectId: 'project',
      firstName: 'Buyer',
      lastName: null,
      email: null,
      phone: null,
      referredBy: null,
      organizationId: 'organization',
      project: { referralPlansEnabled: true },
      referralAttribution: {
        organizationId: 'organization',
        commissionPlanId: 'plan',
        commissionPlan: {
          maxPayoutDepth: 1,
          levels: [{ level: 1, percent: 10, isActive: true }]
        }
      }
    } as any);
    mockDb.project.findUnique = jest
      .fn()
      .mockResolvedValue({ enablePartnerRoles: true } as any);
    jest.spyOn(ReferralService, 'getReferralProgram').mockResolvedValue(null);
    jest
      .spyOn(PartnerReferralGraphService, 'resolvePayoutLevels')
      .mockResolvedValue([
        [
          {
            id: 'referrer',
            firstName: 'Referrer',
            lastName: null,
            email: null,
            phone: null,
            weight: 1
          }
        ]
      ]);
    mockAwardBonus.mockResolvedValue({ id: 'bonus' });

    const result = await ReferralService.processReferralBonus(
      'buyer',
      1000,
      'order-b2b'
    );

    expect(mockAwardBonus).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'referrer',
        amount: 100,
        isReferralBonus: true,
        referralUserId: 'buyer'
      })
    );
    expect(result.bonusAwarded).toBe(true);
    expect(result.totalBonus).toBe(100);
  });

  it('keeps payouts disabled when neither classic nor B2B plan is active', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      id: 'buyer',
      projectId: 'project',
      referredBy: 'referrer',
      project: { referralPlansEnabled: false },
      referralAttribution: null
    } as any);
    jest.spyOn(ReferralService, 'getReferralProgram').mockResolvedValue({
      isActive: false,
      minPurchaseAmount: 0,
      referrerBonus: 10,
      levels: [{ level: 1, percent: 10, isActive: true }]
    } as any);

    const result = await ReferralService.processReferralBonus(
      'buyer',
      1000,
      'order-classic-disabled'
    );

    expect(mockAwardBonus).not.toHaveBeenCalled();
    expect(result.bonusAwarded).toBe(false);
  });
});
