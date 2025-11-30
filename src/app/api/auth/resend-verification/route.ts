/**
 * @file: src/app/api/auth/resend-verification/route.ts
 * @description: API endpoint для повторной отправки письма подтверждения
 * @project: SaaS Bonus System
 * @dependencies: Prisma, zod, auth utils, NotificationService
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withAuthRateLimit } from '@/lib';

const resendSchema = z.object({
  email: z.string().email()
});

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email } = resendSchema.parse(body);

    // Нормализуем email (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();

    // Получаем аккаунт
    const account = await db.adminAccount.findUnique({
      where: { email: normalizedEmail }
    });

    // Безопасный ответ - не раскрываем существует ли аккаунт
    if (!account || !account.isActive) {
      logger.warn('Resend verification attempt for non-existent account', {
        email: normalizedEmail.substring(0, 3) + '***'
      });
      return NextResponse.json({
        message:
          'Если аккаунт с таким email существует, письмо будет отправлено.'
      });
    }

    // Проверяем, нужна ли верификация
    if (account.emailVerified) {
      logger.info('Resend verification for already verified account', {
        email: normalizedEmail.substring(0, 3) + '***'
      });
      return NextResponse.json({
        message: 'Этот аккаунт уже подтвержден. Вы можете войти в систему.'
      });
    }

    // Генерируем новый токен
    const verificationToken = Buffer.from(
      `${normalizedEmail}:${Date.now()}:${Math.random()}`
    ).toString('base64url');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Обновляем токен в БД
    await db.adminAccount.update({
      where: { id: account.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      }
    });

    // Отправляем email
    try {
      const { NotificationService } = await import(
        '@/lib/services/notification.service'
      );
      await NotificationService.sendVerificationEmail(
        normalizedEmail,
        verificationToken
      );

      logger.info('Verification email resent', {
        email: normalizedEmail.substring(0, 3) + '***',
        accountId: account.id
      });
    } catch (emailError) {
      logger.error('Failed to resend verification email', {
        error:
          emailError instanceof Error ? emailError.message : 'Unknown error',
        email: normalizedEmail.substring(0, 3) + '***'
      });
      return NextResponse.json(
        { error: 'Не удалось отправить письмо. Попробуйте позже.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Письмо с подтверждением отправлено на вашу электронную почту.'
    });
  } catch (err: unknown) {
    logger.error('Ошибка повторной отправки письма', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверный формат email', details: err.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}

// Более строгий rate limit для повторной отправки: 3 попытки за 15 минут
export const POST = withAuthRateLimit(handlePOST, {
  maxRequests: 3,
  windowMs: 15 * 60 * 1000
});
