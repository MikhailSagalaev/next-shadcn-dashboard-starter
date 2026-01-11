import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';

const PROTECTED_MATCHERS = ['/dashboard', '/api/admin', '/api/projects'];
const SUPER_ADMIN_MATCHERS = ['/super-admin'];
const EMAIL_VERIFICATION_REQUIRED = true; // Включить проверку email после настройки Resend

// Публичные API, доступные без авторизации (для внешних интеграций)
// 1) Баланс пользователя для Tilda:
//    GET /api/projects/:id/users/balance?email=...&phone=...
// 2) Вебхуки проектов
// 3) Настройки виджета (GET only)
//    GET /api/projects/:id/widget
const PUBLIC_API_PATTERNS: RegExp[] = [
  /^\/api\/projects\/[^/]+\/users\/balance(?:\/?|$)/i,
  /^\/api\/webhook\//i,
  /^\/api\/projects\/[^/]+\/widget$/i
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Защита /super-admin/* (исключая /super-admin/login)
  const isSuperAdminPath = SUPER_ADMIN_MATCHERS.some((p) =>
    pathname.startsWith(p)
  );
  if (isSuperAdminPath && pathname !== '/super-admin/login') {
    const superAdminToken = req.cookies.get('super_admin_auth')?.value;
    if (!superAdminToken) {
      if (pathname.startsWith('/api/super-admin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/super-admin/login', req.url));
    }
    // Проверяем валидность токена
    const payload = await verifyJwt(superAdminToken);
    if (!payload || payload.role !== 'SUPERADMIN') {
      if (pathname.startsWith('/api/super-admin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/super-admin/login', req.url));
    }
    return NextResponse.next();
  }

  const requiresAuth = PROTECTED_MATCHERS.some((p) => pathname.startsWith(p));

  // allowlist публичных маршрутов внутри защищённого префикса
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_PATTERNS.some((re) => re.test(pathname));
    if (isPublicApi) return NextResponse.next();
  }
  if (!requiresAuth) return NextResponse.next();

  // Dev bypass for API with header x-dev-auth: 1
  if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/api/')) {
    const devBypass = req.headers.get('x-dev-auth');
    if (devBypass === '1') {
      return NextResponse.next();
    }
  }

  const token = req.cookies.get('sb_auth')?.value;
  const payload = token ? await verifyJwt(token) : null;

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signInUrl = new URL('/auth/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Проверка подтверждения email убрана из middleware
  // Prisma Client не работает в Edge Runtime
  // Проверка email выполняется на уровне страниц/API routes
  // TODO: Можно добавить проверку через JWT payload, если добавить emailVerified в токен

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
