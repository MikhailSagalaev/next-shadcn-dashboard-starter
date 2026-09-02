const DEFAULT_AUTH_REDIRECT = '/dashboard';

/**
 * Возвращает только внутренний маршрут кабинета. Middleware может работать за
 * reverse proxy и передать абсолютный URL с внутренним host, поэтому origin
 * намеренно отбрасывается.
 */
export function getSafeAuthRedirect(value?: string | null): string {
  if (!value) return DEFAULT_AUTH_REDIRECT;

  try {
    const parsed = new URL(value, 'https://auth-redirect.invalid');
    if (
      parsed.pathname !== '/dashboard' &&
      !parsed.pathname.startsWith('/dashboard/')
    ) {
      return DEFAULT_AUTH_REDIRECT;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
