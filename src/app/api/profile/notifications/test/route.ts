/**
 * @file: src/app/api/profile/notifications/test/route.ts
 * @description: Отправка тестового уведомления на email администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Zod, Prisma, NotificationService
 * @created: 2025-11-16
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJwt } from '@/lib/jwt';
import { db } from '@/lib/db';
import { NotificationService } from '@/lib/services/notification.service';
import { logger } from '@/lib/logger';

const bodySchema = z.object({
  notificationEmail: z.string().email(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  enableEmailNotifications: z.boolean().optional()
});

type StoredSettings = {
  notifications?: {
    enableEmailNotifications?: boolean;
  };
};

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
    if (body.enableEmailNotifications === false) {
      return NextResponse.json(
        { error: 'Email уведомления отключены' },
        { status: 400 }
      );
    }

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, metadata: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const storedSettings =
      ((admin.metadata as Record<string, unknown> | null)?.profileSettings as
        | StoredSettings
        | undefined) || {};

    if (
      storedSettings.notifications?.enableEmailNotifications === false &&
      body.enableEmailNotifications !== true
    ) {
      return NextResponse.json(
        { error: 'Email уведомления отключены в настройках профиля' },
        { status: 400 }
      );
    }

    const language = body.language || 'ru';
    const timezone = body.timezone || 'UTC';
    const dateFormat = body.dateFormat || 'DD.MM.YYYY';

    let localizedTime = new Date().toISOString();
    try {
      localizedTime = new Intl.DateTimeFormat(language, {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: timezone
      }).format(new Date());
    } catch (error) {
      logger.warn('Failed to format localized time', {
        error: String(error),
        timezone,
        language
      });
    }

    const subject = 'Тестовое уведомление SaaS Bonus System';
    const content = `
      <h2>👋 Привет!</h2>
      <p>Это тестовое уведомление из панели управления SaaS Bonus System.</p>
      <p><strong>Текущий язык:</strong> ${language}</p>
      <p><strong>Часовой пояс:</strong> ${timezone}</p>
      <p><strong>Формат даты:</strong> ${dateFormat}</p>
      <p><strong>Местное время:</strong> ${localizedTime}</p>
      <p>Если вы получили это письмо, значит рассылки настроены корректно.</p>
      <p style="margin-top:24px;">С уважением,<br/>Команда SaaS Bonus System</p>
    `;

    const sent = await NotificationService.send(
      'email',
      body.notificationEmail,
      subject,
      content
    );

    if (!sent) {
      return NextResponse.json(
        { error: 'Почтовый сервис недоступен. Проверьте конфигурацию.' },
        { status: 502 }
      );
    }

    logger.info('Test notification sent', {
      adminId: admin.id,
      notificationEmail: body.notificationEmail
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to send test notification', { error: String(error) });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Некорректные данные' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Не удалось отправить тестовое уведомление' },
      { status: 500 }
    );
  }
}
