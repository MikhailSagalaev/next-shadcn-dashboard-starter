/**
 * @file: src/app/api/super-admin/system-status/route.ts
 * @description: Статистика системы для супер-админки
 * @project: SaaS Bonus System
 */

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import redis from '@/lib/redis';

export async function GET() {
  try {
    await requireSuperAdmin();

    const [projects, users, bots, admins] = await Promise.all([
      db.project.count(),
      db.user.count(),
      db.botSettings.count(),
      db.adminAccount.count()
    ]);

    let redisStatus = 'Не настроен';
    try {
      await redis.ping();
      redisStatus = 'Активен';
    } catch {
      redisStatus = 'Недоступен';
    }

    return NextResponse.json({
      version: 'v2.1.0',
      metrics: {
        projects,
        users,
        bots,
        admins
      },
      status: {
        database: 'Подключена',
        redis: redisStatus,
        telegram: bots > 0 ? 'Работает' : 'Нет активных ботов'
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching system status', { error: String(error) });
    return NextResponse.json(
      { error: 'Не удалось получить состояние системы' },
      { status: 500 }
    );
  }
}
