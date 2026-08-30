import { resolvePartnerAccess } from '@/lib/services/partner-access';

describe('resolvePartnerAccess', () => {
  it('keeps an organization customer out of partner UI and actions', () => {
    const access = resolvePartnerAccess({
      enablePartnerRoles: true,
      partnerRole: 'CLIENT',
      memberships: [{ level: null, canManage: false }]
    });

    expect(access).toMatchObject({
      isPartner: false,
      canManageOrganization: false,
      canUseReferralProgram: false,
      partnerMenuKind: 'CLIENT',
      partnerMemberships: []
    });
  });

  it.each([
    ['TRAINER', { level: 1, canManage: false }],
    ['MANAGER', { level: 2, canManage: false }],
    ['DIRECTOR', { level: null, canManage: true }]
  ] as const)('keeps %s partner access', (partnerRole, membership) => {
    const access = resolvePartnerAccess({
      enablePartnerRoles: true,
      partnerRole,
      memberships: [membership]
    });

    expect(access.isPartner).toBe(true);
    expect(access.canUseReferralProgram).toBe(true);
    expect(access.partnerMemberships).toEqual([membership]);
  });

  it('does not trust a stale compatibility role in a B2B project', () => {
    const access = resolvePartnerAccess({
      enablePartnerRoles: true,
      partnerRole: 'TRAINER',
      memberships: [{ level: null, canManage: false }]
    });

    expect(access.isPartner).toBe(false);
    expect(access.canUseReferralProgram).toBe(false);
    expect(access.partnerMenuKind).toBe('CLIENT');
  });

  it('preserves customer referrals in a C2C project', () => {
    const access = resolvePartnerAccess({
      enablePartnerRoles: false,
      partnerRole: 'CLIENT',
      memberships: []
    });

    expect(access.isPartner).toBe(false);
    expect(access.canUseReferralProgram).toBe(true);
  });
});
