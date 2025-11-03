/**
 * @file: src/app/api/auth/register/route.ts
 * @description: Регистрация администратора по email/паролю
 * @project: SaaS Bonus System
 * @dependencies: Prisma, zod, auth utils
 * @created: 2025-09-03
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { withAuthRateLimit } from '@/lib';
import { logger } from '@/lib/logger';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'MANAGER']).optional()
});

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const existing = await db.adminAccount.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Пользователь уже существует' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);
    
    // Генерируем токен верификации email
    const verificationToken = Buffer.from(
      `${data.email}:${Date.now()}:${Math.random()}`
    ).toString('base64url');
    
    // Устанавливаем срок действия токена (24 часа)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const created = await db.adminAccount.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role ?? 'ADMIN',
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      }
    });

    // Отправляем email с подтверждением
    try {
      const { NotificationService } = await import('@/lib/services/notification.service');
      await NotificationService.sendVerificationEmail(data.email, verificationToken);
      
      logger.info('Email verification sent', {
        email: data.email.substring(0, 3) + '***',
        accountId: created.id
      });
    } catch (emailError) {
      logger.error('Failed to send verification email', {
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
        email: data.email.substring(0, 3) + '***'
      });
      // Продолжаем регистрацию даже если email не отправился
    }

    // НЕ создаем сессию - пользователь должен подтвердить email
    return NextResponse.json(
      {
        message: 'Регистрация успешна! Пожалуйста, проверьте вашу электронную почту для подтверждения аккаунта.',
        email: data.email
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    logger.error('Ошибка регистрации', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: err.flatten() },
        { status: 400 }
      );
    }

    const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
    // Если известная проблема (например, JWT_SECRET), вернём 500 c явным сообщением
    if (errorMessage.includes('JWT_SECRET')) {
      return NextResponse.json(
        { error: 'JWT секрет не задан на сервере', details: errorMessage },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Внутренняя ошибка', details: errorMessage }, { status: 500 });
  }
}

// Применяем rate limiting к POST запросам (5 попыток за 15 минут)
export const POST = withAuthRateLimit(handlePOST);
