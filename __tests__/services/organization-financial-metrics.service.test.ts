import { db } from '@/lib/db';
import { OrganizationFinancialMetricsService } from '@/lib/services/organization-financial-metrics.service';

jest.mock('@/lib/db');

describe('OrganizationFinancialMetricsService', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(mockDb, 'referralAttribution', {
      configurable: true,
      value: { findMany: jest.fn() }
    });
    Object.defineProperty(mockDb, 'order', {
      configurable: true,
      value: { groupBy: jest.fn() }
    });
    Object.defineProperty(mockDb, 'user', {
      configurable: true,
      value: { findMany: jest.fn() }
    });
    Object.defineProperty(mockDb, 'transaction', {
      configurable: true,
      value: { findMany: jest.fn() }
    });
  });

  it('не смешивает покупки и чистое вознаграждение двух организаций', async () => {
    (mockDb.referralAttribution.findMany as jest.Mock).mockResolvedValue([
      { userId: 'member-a', organizationId: 'org-a' },
      { userId: 'member-b', organizationId: 'org-b' }
    ]);
    (mockDb.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        userId: 'member-a',
        referralUserId: 'buyer-a',
        amount: 50,
        type: 'EARN',
        metadata: { referralOrganizationId: 'org-a' }
      },
      {
        userId: 'member-a',
        referralUserId: 'buyer-b',
        amount: 800,
        type: 'EARN',
        metadata: { referralOrganizationId: 'org-b' }
      },
      {
        userId: 'member-a',
        referralUserId: 'buyer-a-legacy',
        amount: 10,
        type: 'REFUND',
        metadata: { source: 'order_reversal' }
      },
      {
        userId: 'member-b',
        referralUserId: 'buyer-a',
        amount: 25,
        type: 'EARN',
        metadata: { referralOrganizationId: 'org-a' }
      }
    ]);
    (mockDb.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'buyer-a-legacy',
        organizationId: null,
        referralAttribution: { organizationId: 'org-a' }
      }
    ]);
    (mockDb.order.groupBy as jest.Mock).mockResolvedValue([
      { userId: 'member-a', _sum: { accountedPurchaseAmount: 100 } }
    ]);

    const metrics = await OrganizationFinancialMetricsService.getMany({
      projectId: 'project',
      organizationId: 'org-a',
      subjects: [
        {
          id: 'member-a',
          totalPurchases: 100,
          legacyOrganizationId: 'org-b'
        },
        {
          id: 'member-b',
          totalPurchases: 500,
          legacyOrganizationId: 'org-b'
        }
      ]
    });

    expect(metrics.get('member-a')).toEqual({
      totalPurchases: 100,
      referralBonusEarned: 40
    });
    expect(metrics.get('member-b')).toEqual({
      totalPurchases: 0,
      referralBonusEarned: 25
    });
    expect(mockDb.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project',
          userId: { in: ['member-a', 'member-b'] },
          accountingState: 'APPLIED',
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
            {
              OR: [
                { organizationId: 'org-a' },
                { organizationId: null, userId: { in: ['member-a'] } }
              ]
            }
          ])
        })
      })
    );
  });

  it('для периода считает только применённые заказы целевой организации', async () => {
    const since = new Date('2026-08-01T00:00:00.000Z');
    (mockDb.referralAttribution.findMany as jest.Mock).mockResolvedValue([
      { userId: 'member-a', organizationId: 'org-a' },
      { userId: 'member-b', organizationId: 'org-b' }
    ]);
    (mockDb.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (mockDb.order.groupBy as jest.Mock).mockResolvedValue([
      { userId: 'member-a', _sum: { accountedPurchaseAmount: 33 } }
    ]);

    const metrics = await OrganizationFinancialMetricsService.getMany({
      projectId: 'project',
      organizationId: 'org-a',
      since,
      subjects: [
        { id: 'member-a', totalPurchases: 100 },
        { id: 'member-b', totalPurchases: 500 }
      ]
    });

    expect(mockDb.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project',
          userId: { in: ['member-a', 'member-b'] },
          accountingState: 'APPLIED',
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
            {
              OR: [
                { organizationId: 'org-a' },
                { organizationId: null, userId: { in: ['member-a'] } }
              ]
            }
          ]),
          accountedAt: { gte: since }
        })
      })
    );
    expect(metrics.get('member-a')?.totalPurchases).toBe(33);
    expect(metrics.get('member-b')?.totalPurchases).toBe(0);
  });

  it('без организации не использует legacy-счётчик и считает только заказы', async () => {
    (mockDb.referralAttribution.findMany as jest.Mock).mockResolvedValue([]);
    (mockDb.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (mockDb.order.groupBy as jest.Mock).mockResolvedValue([
      { userId: 'member-a', _sum: { accountedPurchaseAmount: 75 } }
    ]);

    const metrics = await OrganizationFinancialMetricsService.getMany({
      projectId: 'project',
      subjects: [{ id: 'member-a', totalPurchases: 999 }]
    });

    expect(metrics.get('member-a')?.totalPurchases).toBe(75);
    expect(mockDb.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project',
          userId: { in: ['member-a'] },
          accountingState: 'APPLIED',
          OR: expect.any(Array)
        })
      })
    );
  });
});
