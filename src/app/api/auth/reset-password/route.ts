/**
 * @file: src/app/api/auth/reset-password/route.ts
 * @description: API endpoint для установки нового пароля
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Zod, bcrypt
 * @created: 2025-10-02
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { withAuthRateLimit } from '@/lib';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72)
});

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Декодируем токен
    const decoded = Buffer.from(token, 'base64url').toString();
    const [accountId] = decoded.split(':');

    // Получаем аккаунт
    const account = await db.adminAccount.findUnique({
      where: { id: accountId }
    });

    if (!account || !account.isActive) {
      return NextResponse.json(
        { error: 'Неверный или истекший токен' },
        { status: 400 }
      );
    }

    // Проверяем токен и срок действия
    const metadata = account.metadata as any;
    if (
      !metadata?.resetToken ||
      metadata.resetToken !== token ||
      !metadata.resetTokenExpiresAt ||
      new Date(metadata.resetTokenExpiresAt) < new Date()
    ) {
      return NextResponse.json(
        { error: 'Неверный или истекший токен' },
        { status: 400 }
      );
    }

    // Хешируем новый пароль
    const passwordHash = await hashPassword(password);

    // Обновляем пароль и удаляем токен
    await db.adminAccount.update({
      where: { id: accountId },
      data: {
        passwordHash,
        metadata: {
          ...metadata,
          resetToken: null,
          resetTokenExpiresAt: null
        }
      }
    });

    logger.info('Пароль успешно изменен', {
      accountId: accountId.substring(0, 8) + '...',
      component: 'auth-reset-password'
    });

    return NextResponse.json({
      success: true,
      message: 'Пароль успешно изменен'
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: err.errors },
        { status: 400 }
      );
    }

    logger.error('Ошибка при сбросе пароля', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при сбросе пароля' },
      { status: 500 }
    );
  }
}

export const POST = withAuthRateLimit(handlePOST);
