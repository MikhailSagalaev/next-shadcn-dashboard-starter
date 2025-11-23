/**
 * @file: src/app/api/profile/2fa/setup/route.ts
 * @description: Генерация QR и временного секрета для 2FA
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, JWT, TwoFactorService
 * @created: 2025-11-16
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import {
  encryptSecret,
  generateTwoFactorSetup
} from '@/lib/services/two-factor.service';

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

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const { secret, otpauthUrl, qrCodeDataUrl } = await generateTwoFactorSetup(
      admin.email
    );

    await db.adminAccount.update({
      where: { id: admin.id },
      data: {
        twoFactorTempSecret: encryptSecret(secret)
      }
    });

    return NextResponse.json({
      success: true,
      otpauthUrl,
      qrCodeDataUrl,
      secret
    });
  } catch (error) {
    logger.error('2FA setup failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Не удалось инициировать настройку 2FA' },
      { status: 500 }
    );
  }
}
