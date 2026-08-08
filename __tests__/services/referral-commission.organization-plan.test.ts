import { db } from '@/lib/db';
import { ReferralCommissionService } from '@/lib/services/referral-commission.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

describe('ReferralCommissionService organization-scoped outbound plan', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDb as any).user = {
      findFirst: jest.fn().mockResolvedValue({
        outboundReferralPlanId: 'global-plan-b',
        organizationId: 'org-b'
      })
    };
    (mockDb as any).partnerOrganizationMembership = {
      findUnique: jest.fn().mockResolvedValue({
        outboundReferralPlanId: 'member-plan-a'
      })
    };
    (mockDb as any).partnerOrganization = {
      findFirst: jest.fn().mockResolvedValue({
        defaultReferralCommissionPlanId: 'org-default-a'
      })
    };
    (mockDb as any).referralCommissionPlan = {
      findFirst: jest.fn(({ where }: any) => Promise.resolve({ id: where.id }))
    };
  });

  it('uses the membership plan before a global plan from another organization', async () => {
    const result = await ReferralCommissionService.resolvePlanIdForNewReferral(
      'project-1',
      'referrer-1',
      'project-default',
      'org-a'
    );

    expect(result).toBe('member-plan-a');
    expect(mockDb.referralCommissionPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 'member-plan-a', projectId: 'project-1', isActive: true },
      select: { id: true }
    });
  });

  it('falls back to the selected organization default before the legacy global plan', async () => {
    (
      mockDb.partnerOrganizationMembership.findUnique as jest.Mock
    ).mockResolvedValue({
      outboundReferralPlanId: null
    });

    const result = await ReferralCommissionService.resolvePlanIdForNewReferral(
      'project-1',
      'referrer-1',
      'project-default',
      'org-a'
    );

    expect(result).toBe('org-default-a');
  });

  it('keeps the legacy global plan for non-organization referrals', async () => {
    const result = await ReferralCommissionService.resolvePlanIdForNewReferral(
      'project-1',
      'referrer-1',
      'project-default'
    );

    expect(result).toBe('global-plan-b');
    expect(
      mockDb.partnerOrganizationMembership.findUnique
    ).not.toHaveBeenCalled();
  });
});
