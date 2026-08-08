import { PartnerTeamService } from '@/lib/services/partner-team.service';

describe('PartnerTeamService.getDefaultTeamFilter', () => {
  test('organization manager sees all', () => {
    expect(
      PartnerTeamService.getDefaultTeamFilter({
        isOrganizationMember: true,
        managesOrganization: true
      })
    ).toBe('all');
  });

  test('organization member sees direct referrals first', () => {
    expect(
      PartnerTeamService.getDefaultTeamFilter({
        isOrganizationMember: true,
        managesOrganization: false
      })
    ).toBe('direct');
  });

  test('regular client sees direct referrals', () => {
    expect(
      PartnerTeamService.getDefaultTeamFilter({
        isOrganizationMember: false,
        managesOrganization: false
      })
    ).toBe('direct');
  });
});
