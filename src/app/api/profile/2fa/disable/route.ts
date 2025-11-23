/**
 * @file: src/app/api/profile/2fa/disable/route.ts
 * @description: Отключение 2FA после подтверждения кода
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, Zod, TwoFactorService
 * @created: 2025-11-16
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import {
  decryptSecret,
  verifyTwoFactorToken
} from '@/lib/services/two-factor.service';

const bodySchema = z.object({
  code: z.string().min(6, 'Код обязателен')
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

    const body = bodySchema.parse(await request.json());

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true
      }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (!admin.twoFactorEnabled || !admin.twoFactorSecret) {
      return NextResponse.json({ error: '2FA уже отключена' }, { status: 400 });
    }

    const secret = decryptSecret(admin.twoFactorSecret);
    const isValid = verifyTwoFactorToken(secret, body.code);

    if (!isValid) {
      return NextResponse.json({ error: 'Неверный код' }, { status: 400 });
    }

    await db.adminAccount.update({
      where: { id: admin.id },
      data: {
        twoFactorSecret: null,
        twoFactorTempSecret: null,
        twoFactorEnabled: false
      }
    });

    logger.info('2FA disabled', { adminId: admin.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Disable 2FA failed', { error: String(error) });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Некорректные данные' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Не удалось отключить 2FA' },
      { status: 500 }
    );
  }
}
