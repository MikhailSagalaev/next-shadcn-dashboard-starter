/**
 * @file: src/app/api/auth/verify-email/route.ts
 * @description: API endpoint для подтверждения email по токену
 * @project: SaaS Bonus System
 * @dependencies: Prisma, zod, auth utils
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { setSessionCookie, signJwt } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { withAuthRateLimit } from '@/lib';

const verifySchema = z.object({
  token: z.string().min(1)
});

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token } = verifySchema.parse(body);

    // Декодируем токен
    const decoded = Buffer.from(token, 'base64url').toString();
    const [email] = decoded.split(':');

    // Получаем аккаунт по email
    const account = await db.adminAccount.findUnique({
      where: { email }
    });

    if (!account || !account.isActive) {
      return NextResponse.json(
        { error: 'Неверный или истекший токен' },
        { status: 400 }
      );
    }

    // Проверяем токен и срок действия
    if (
      !account.emailVerificationToken ||
      account.emailVerificationToken !== token ||
      !account.emailVerificationExpires ||
      new Date(account.emailVerificationExpires) < new Date()
    ) {
      return NextResponse.json(
        { error: 'Токен подтверждения истек. Пожалуйста, запросите новое письмо.' },
        { status: 400 }
      );
    }

    // Подтверждаем email
    await db.adminAccount.update({
      where: { id: account.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      }
    });

    // Создаем сессию для пользователя
    const jwtToken = await signJwt({
      sub: account.id,
      email: account.email,
      role: account.role as 'SUPERADMIN' | 'ADMIN' | 'MANAGER'
    });
    await setSessionCookie(jwtToken);

    logger.info('Email verified successfully', {
      email: email.substring(0, 3) + '***',
      accountId: account.id
    });

    return NextResponse.json({
      message: 'Email успешно подтвержден!',
      verified: true
    });
  } catch (err: unknown) {
    logger.error('Ошибка подтверждения email', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверный формат токена', details: err.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}

// GET запрос для верификации по query параметру (из ссылки в email)
async function handleGET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не предоставлен' },
        { status: 400 }
      );
    }

    const response = await handlePOST(
      new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ token })
      })
    );

    return response;
  } catch (err: unknown) {
    logger.error('Ошибка подтверждения email (GET)', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}

export const POST = withAuthRateLimit(handlePOST);
export const GET = handleGET;

