/**
 * @file: src/app/api/profile/avatar/route.ts
 * @description: Загрузка и сохранение аватаров администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, Node fs, JWT
 * @created: 2025-11-16
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp']
]);

const AVATAR_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

async function ensureDirExists() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

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

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Файл превышает 2MB' },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: 'Допустимы только PNG/JPEG/WebP' },
        { status: 400 }
      );
    }

    await ensureDirExists();

    const fileName = `${payload.sub}-${Date.now()}.${extension}`;
    const filePath = path.join(AVATAR_DIR, fileName);
    const publicPath = `/uploads/avatars/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: { metadata: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const metadata = (admin.metadata as Record<string, unknown>) || {};
    const profileSettings = (metadata.profileSettings as Record<
      string,
      unknown
    >) || { personal: {} };
    const personal =
      (profileSettings.personal as Record<string, unknown>) || {};
    personal.avatar = publicPath;
    profileSettings.personal = personal;
    metadata.profileSettings = profileSettings;
    metadata.avatarUrl = publicPath;

    await db.adminAccount.update({
      where: { id: payload.sub },
      data: { metadata: metadata as Prisma.InputJsonValue }
    });

    logger.info('Avatar uploaded', { adminId: payload.sub, fileName });

    return NextResponse.json({
      success: true,
      avatarUrl: publicPath
    });
  } catch (error) {
    logger.error('Avatar upload failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Не удалось загрузить аватар' },
      { status: 500 }
    );
  }
}
