import { getSafeAuthRedirect } from '@/lib/auth-redirect';

describe('getSafeAuthRedirect', () => {
  it('возвращает глубокую ссылку кабинета без внутреннего origin', () => {
    expect(
      getSafeAuthRedirect(
        'https://0.0.0.0:3000/dashboard/projects/project-1?tab=organizations'
      )
    ).toBe('/dashboard/projects/project-1?tab=organizations');
  });

  it('принимает относительный маршрут dashboard', () => {
    expect(getSafeAuthRedirect('/dashboard/projects/project-1')).toBe(
      '/dashboard/projects/project-1'
    );
  });

  it.each([
    ['https://example.com/'],
    ['/auth/sign-in'],
    ['javascript:alert(1)'],
    [null]
  ])('отклоняет небезопасный redirect %s', (value) => {
    expect(getSafeAuthRedirect(value)).toBe('/dashboard');
  });
});
