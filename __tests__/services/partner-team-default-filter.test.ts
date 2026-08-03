import { PartnerTeamService } from '@/lib/services/partner-team.service';

describe('PartnerTeamService.getDefaultTeamFilter', () => {
  test('organization manager sees all', () => {
    expect(
      PartnerTeamService.getDefaultTeamFilter({
        partnerRole: 'TRAINER',
        managesOrganization: true
      })
    ).toBe('all');
  });
  test('trainer sees clients', () => {
    expect(
      PartnerTeamService.getDefaultTeamFilter({
        partnerRole: 'TRAINER',
        managesOrganization: false
      })
    ).toBe('clients');
  });
  test('client sees direct referrals', () => {
    expect(
      PartnerTeamService.getDefaultTeamFilter({
        partnerRole: 'CLIENT',
        managesOrganization: false
      })
    ).toBe('direct');
  });
});
