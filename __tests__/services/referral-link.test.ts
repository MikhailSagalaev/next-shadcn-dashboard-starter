import {
  buildOrganizationReferralLink,
  buildReferralLink
} from '@/lib/utils/referral-link';

describe('referral-link utilities', () => {
  it('строит org-only ссылку без персонального utm_ref', () => {
    const result = buildOrganizationReferralLink(
      'example.com/shop',
      'organization-id'
    );

    expect(result).toBe(
      'https://example.com/shop/members/signup?utm_org=organization-id'
    );
    expect(result).not.toContain('utm_ref');
  });

  it('не дублирует маршрут регистрации в настроенном домене', () => {
    expect(
      buildOrganizationReferralLink(
        'https://example.com/members/signup',
        'organization-id'
      )
    ).toBe('https://example.com/members/signup?utm_org=organization-id');
  });

  it('не зависит от изменяемого названия или slug организации', () => {
    const beforeRename = buildOrganizationReferralLink(
      'example.com',
      'organization-id'
    );
    const afterRename = buildOrganizationReferralLink(
      'example.com',
      'organization-id'
    );

    expect(afterRename).toBe(beforeRename);
  });

  it('сохраняет персональную ссылку отдельным сценарием', () => {
    expect(buildReferralLink('example.com', 'user-1', 'xfit')).toBe(
      'https://example.com/?utm_ref=user-1&utm_org=xfit'
    );
  });
});
