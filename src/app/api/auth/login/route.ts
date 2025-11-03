/**
 * @file: src/app/api/auth/login/route.ts
 * @description: Вход администратора по email/паролю
 * @project: SaaS Bonus System
 * @dependencies: Prisma, zod, auth utils
 * @created: 2025-09-03
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { signJwt } from '@/lib/jwt';
import { withAuthRateLimit } from '@/lib';
import { logger } from '@/lib/logger';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const account = await db.adminAccount.findUnique({
      where: { email: data.email }
    });
    if (!account || !account.isActive) {
      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      );
    }

    // Проверяем, подтвержден ли email
    if (!account.emailVerified) {
      logger.warn('Login attempt with unverified email', {
        email: data.email.substring(0, 3) + '***',
        accountId: account.id
      });
      return NextResponse.json(
        { 
          error: 'Email не подтвержден',
          message: 'Пожалуйста, подтвердите ваш email перед входом. Проверьте вашу почту для ссылки подтверждения.'
        },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(data.password, account.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      );
    }

    const token = await signJwt({
      sub: account.id,
      email: account.email,
      role: account.role
    });
    await setSessionCookie(token);

    return NextResponse.json({
      id: account.id,
      email: account.email,
      role: account.role
    });
  } catch (err: unknown) {
    logger.error('Login error', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: err.flatten() },
        { status: 400 }
      );
    }

    const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: 'Внутренняя ошибка', details: errorMessage }, { status: 500 });
  }
}

// Применяем rate limiting к POST запросам (5 попыток за 15 минут)
export const POST = withAuthRateLimit(handlePOST);
