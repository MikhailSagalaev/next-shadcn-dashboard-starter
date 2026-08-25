const mockDb = {
  partnerOrganizationMembership: { findFirst: jest.fn() },
  transaction: { findMany: jest.fn() },
  order: { findMany: jest.fn() },
  user: { findMany: jest.fn() }
};

jest.mock('@/lib/db', () => ({ db: mockDb }));

import {
  OrganizationMemberActivityService,
  classifyOrganizationActivity,
  organizationActivitySince
} from '@/lib/services/organization-member-activity.service';

describe('OrganizationMemberActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('различает реферальное начисление, кэшбэк и возврат списания', () => {
    expect(
      classifyOrganizationActivity({
        type: 'EARN',
        isReferralBonus: true,
        bonusType: 'REFERRAL'
      })
    ).toMatchObject({ kind: 'REFERRAL_REWARD', sign: 1 });

    expect(
      classifyOrganizationActivity({
        type: 'EARN',
        isReferralBonus: false,
        bonusType: 'PURCHASE',
        metadata: { source: 'tilda_order' }
      })
    ).toMatchObject({ kind: 'PURCHASE_CASHBACK', sign: 1 });

    expect(
      classifyOrganizationActivity({
        type: 'REFUND',
        isReferralBonus: false,
        metadata: { reversalOf: 'order-spend:42:bonus-1' }
      })
    ).toMatchObject({ kind: 'BONUS_SPEND_RETURN', sign: 1 });
  });

  it('считает период от переданной даты', () => {
    const now = new Date('2026-08-22T12:00:00.000Z');
    expect(organizationActivitySince('7d', now)?.toISOString()).toBe(
      '2026-08-15T12:00:00.000Z'
    );
    expect(organizationActivitySince('all', now)).toBeNull();
  });

  it('возвращает только операции выбранной организации и резолвит orderNumber в Order.id', async () => {
    mockDb.partnerOrganizationMembership.findFirst.mockResolvedValue({
      user: {
        id: 'member-1',
        firstName: 'Мария',
        lastName: 'Семерюк',
        email: 'maria@example.com',
        phone: null,
        organizationId: 'org-a',
        referralAttribution: { organizationId: 'org-a' }
      }
    });
    mockDb.transaction.findMany.mockResolvedValue([
      {
        id: 'referral-a',
        amount: 150,
        type: 'EARN',
        description: 'Реферальный бонус',
        metadata: {
          source: 'referral_bonus',
          referralOrganizationId: 'org-a',
          orderId: 'ORDER-10'
        },
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        isReferralBonus: true,
        referralUserId: 'buyer-1',
        referralLevel: 1,
        bonus: { type: 'REFERRAL' }
      },
      {
        id: 'referral-b',
        amount: 900,
        type: 'EARN',
        description: 'Чужая организация',
        metadata: {
          source: 'referral_bonus',
          referralOrganizationId: 'org-b',
          orderId: 'ORDER-20'
        },
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
        isReferralBonus: true,
        referralUserId: 'buyer-2',
        referralLevel: 1,
        bonus: { type: 'REFERRAL' }
      },
      {
        id: 'manual',
        amount: 500,
        type: 'EARN',
        description: 'Ручное начисление',
        metadata: { source: 'manual' },
        createdAt: new Date('2026-08-22T08:00:00.000Z'),
        isReferralBonus: false,
        referralUserId: null,
        referralLevel: null,
        bonus: { type: 'MANUAL' }
      }
    ]);
    mockDb.user.findMany.mockResolvedValue([
      {
        id: 'buyer-1',
        firstName: 'Дарья',
        lastName: null,
        email: null,
        phone: null,
        organizationId: 'org-a',
        referralAttribution: { organizationId: 'org-a' }
      },
      {
        id: 'buyer-2',
        firstName: 'Иван',
        lastName: null,
        email: null,
        phone: null,
        organizationId: 'org-b',
        referralAttribution: { organizationId: 'org-b' }
      }
    ]);
    mockDb.order.findMany.mockImplementation(async (args: any) => {
      if (args.where.userId) {
        return [
          {
            id: 'internal-order-10',
            orderNumber: 'ORDER-10',
            totalAmount: 1500,
            accountedPurchaseAmount: 1500,
            status: 'COMPLETED',
            accountingState: 'APPLIED',
            createdAt: new Date('2026-08-22T07:00:00.000Z')
          }
        ];
      }
      return [
        {
          id: 'internal-order-10',
          orderNumber: 'ORDER-10',
          totalAmount: 1500,
          accountedPurchaseAmount: 1500,
          status: 'COMPLETED',
          accountingState: 'APPLIED',
          createdAt: new Date('2026-08-22T07:00:00.000Z'),
          user: {
            organizationId: 'org-a',
            referralAttribution: { organizationId: 'org-a' }
          }
        },
        {
          id: 'internal-order-20',
          orderNumber: 'ORDER-20',
          totalAmount: 9000,
          accountedPurchaseAmount: 9000,
          status: 'COMPLETED',
          accountingState: 'APPLIED',
          createdAt: new Date('2026-08-22T06:00:00.000Z'),
          user: {
            organizationId: 'org-b',
            referralAttribution: { organizationId: 'org-b' }
          }
        }
      ];
    });

    const result = await OrganizationMemberActivityService.get({
      projectId: 'project-1',
      organizationId: 'org-a',
      userId: 'member-1',
      period: 'all'
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]).toMatchObject({
      id: 'referral-a',
      signedAmount: 150,
      order: { id: 'internal-order-10', orderNumber: 'ORDER-10' }
    });
    expect(result.summary.referralRewardTotal).toBe(150);
    expect(result.summary.purchaseTotal).toBe(1500);
    expect(result.pagination.unscopedTransactions).toBe(2);
  });
});
