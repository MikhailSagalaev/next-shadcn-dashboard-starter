import { db } from '@/lib/db';
import {
  normalizeReferralLinks,
  PartnerReferralGraphService
} from '@/lib/services/partner-referral-graph.service';

jest.mock('@/lib/db');

describe('PartnerReferralGraphService', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(mockDb, 'partnerReferralLink', {
      configurable: true,
      value: { findMany: jest.fn() }
    });
    Object.defineProperty(mockDb, 'partnerOrganization', {
      configurable: true,
      value: { findFirst: jest.fn() }
    });
    Object.defineProperty(mockDb, 'partnerOrganizationMembership', {
      configurable: true,
      value: { findMany: jest.fn() }
    });
  });

  it('не разрешает создать цикл в мульти-реферальном графе', async () => {
    (mockDb.partnerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: 'organization'
    });
    (
      mockDb.partnerOrganizationMembership.findMany as jest.Mock
    ).mockResolvedValue([{ userId: 'child' }, { userId: 'parent' }]);
    (mockDb.partnerReferralLink.findMany as jest.Mock).mockResolvedValue([
      { childUserId: 'parent', referrerUserId: 'child' }
    ]);

    await expect(
      PartnerReferralGraphService.replaceLinks({
        projectId: 'project',
        organizationId: 'organization',
        childUserId: 'child',
        links: [{ referrerId: 'parent', sharePercent: 100 }]
      })
    ).rejects.toThrow('создаёт цикл');
  });

  describe('normalizeReferralLinks', () => {
    it('поддерживает нескольких рефереров и сохраняет их доли', () => {
      expect(
        normalizeReferralLinks('child', [
          { referrerId: 'first', sharePercent: 60, isPrimary: true },
          { referrerId: 'second', sharePercent: 40 }
        ])
      ).toEqual([
        { referrerId: 'first', sharePercent: 60, isPrimary: true },
        { referrerId: 'second', sharePercent: 40, isPrimary: false }
      ]);
    });

    it('не разрешает выплатить больше 100 процентов', () => {
      expect(() =>
        normalizeReferralLinks('child', [
          { referrerId: 'first', sharePercent: 70 },
          { referrerId: 'second', sharePercent: 40 }
        ])
      ).toThrow('не может превышать 100%');
    });

    it('автоматически выбирает основного реферера', () => {
      const links = normalizeReferralLinks('child', [
        { referrerId: 'visibility-only', sharePercent: 0 },
        { referrerId: 'paid', sharePercent: 25 }
      ]);

      expect(links.find((link) => link.isPrimary)?.referrerId).toBe('paid');
    });
  });

  describe('resolvePayoutLevels', () => {
    it('делит выплату уровня между несколькими реферерами', async () => {
      (mockDb.partnerReferralLink.findMany as jest.Mock).mockResolvedValue([
        {
          childUserId: 'child',
          referrerUserId: 'first',
          sharePercent: 60
        },
        {
          childUserId: 'child',
          referrerUserId: 'second',
          sharePercent: 40
        }
      ]);
      (mockDb.user.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 'child', partnerParentId: null, referredBy: null }
        ])
        .mockResolvedValueOnce([
          {
            id: 'first',
            firstName: 'Первый',
            lastName: null,
            email: null,
            phone: null
          },
          {
            id: 'second',
            firstName: 'Второй',
            lastName: null,
            email: null,
            phone: null
          }
        ]);

      const levels = await PartnerReferralGraphService.resolvePayoutLevels({
        projectId: 'project',
        organizationId: 'organization',
        childUserId: 'child',
        depth: 1
      });

      expect(levels[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'first', weight: 0.6 }),
          expect.objectContaining({ id: 'second', weight: 0.4 })
        ])
      );
    });

    it('не превращает связь 0% в legacy-выплату', async () => {
      (mockDb.partnerReferralLink.findMany as jest.Mock).mockResolvedValue([
        {
          childUserId: 'child',
          referrerUserId: 'visibility-only',
          sharePercent: 0
        }
      ]);
      (mockDb.user.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'child',
          partnerParentId: 'visibility-only',
          referredBy: 'visibility-only'
        }
      ]);

      const levels = await PartnerReferralGraphService.resolvePayoutLevels({
        projectId: 'project',
        organizationId: 'organization',
        childUserId: 'child',
        depth: 3
      });

      expect(levels).toEqual([]);
      expect(mockDb.user.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
