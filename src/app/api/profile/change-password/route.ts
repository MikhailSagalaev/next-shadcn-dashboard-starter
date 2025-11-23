/**
 * @file: src/app/api/profile/change-password/route.ts
 * @description: Изменение пароля администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Zod, Prisma, bcrypt
 * @created: 2025-11-16
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { logger } from '@/lib/logger';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
  newPassword: z
    .string()
    .min(8, 'Пароль должен быть не менее 8 символов')
    .regex(/[A-Za-z]/, 'Пароль должен содержать буквы')
    .regex(/[0-9]/, 'Пароль должен содержать цифры'),
  confirmPassword: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sb_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const json = await request.json();
    const body = changePasswordSchema.parse(json);

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json(
        { error: 'Пароли не совпадают' },
        { status: 400 }
      );
    }

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const validCurrent = await verifyPassword(
      body.currentPassword,
      admin.passwordHash
    );

    if (!validCurrent) {
      return NextResponse.json(
        { error: 'Текущий пароль неверен' },
        { status: 400 }
      );
    }

    const samePassword = await verifyPassword(
      body.newPassword,
      admin.passwordHash
    );
    if (samePassword) {
      return NextResponse.json(
        { error: 'Новый пароль совпадает со старым' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(body.newPassword);

    await db.adminAccount.update({
      where: { id: admin.id },
      data: {
        passwordHash: newHash,
        metadata: {
          ...(admin.metadata as Record<string, unknown> | null),
          lastPasswordChange: new Date().toISOString()
        }
      }
    });

    logger.info('Password changed', { adminId: admin.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Change password error', { error: String(error) });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Некорректные данные' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Не удалось изменить пароль' },
      { status: 500 }
    );
  }
}
