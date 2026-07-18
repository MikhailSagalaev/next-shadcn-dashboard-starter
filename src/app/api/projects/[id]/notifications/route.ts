/**
 * @file: notifications/route.ts
 * @description: API для управления уведомлениями проекта
 * @project: Gupil.ru - SaaS Bonus System
 * @dependencies: @/lib/services/notification.service, @/lib/auth
 * @created: 2024-09-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectNotificationService } from '../../../../../lib/services/project-notification.service';
import { MailingService } from '../../../../../lib/services/mailing.service';
import { logger } from '../../../../../lib/logger';
import { withApiRateLimit } from '../../../../../lib/with-rate-limit';
import { requireProjectAccess } from '../../../../../lib/with-project-access';

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const access = await requireProjectAccess(params);
    if (access instanceof NextResponse) return access;

    // Получаем шаблоны уведомлений
    const templates = await ProjectNotificationService.getTemplates(projectId);

    // Получаем логи уведомлений
    const logs =
      await ProjectNotificationService.getNotificationLogs(projectId);

    return NextResponse.json({
      success: true,
      data: {
        templates,
        logs
      }
    });
  } catch (error) {
    logger.error('Failed to get notifications:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const access = await requireProjectAccess(params);
    if (access instanceof NextResponse) return access;
    const body = await request.json();

    // Валидация обязательных полей
    if (!body.channel || !body.title || !body.message) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные поля: channel, title, message' },
        { status: 400 }
      );
    }

    // Валидация канала
    const validChannels = ['telegram', 'email', 'sms', 'push'];
    if (!validChannels.includes(body.channel)) {
      return NextResponse.json(
        {
          error:
            'Неверный канал отправки. Допустимые: telegram, email, sms, push'
        },
        { status: 400 }
      );
    }

    const isTelegramBroadcastToAll =
      body.channel === 'telegram' &&
      !body.userId &&
      !Array.isArray(body.userIds);

    // Полная рассылка выполняется фоново. На 10 000+ пользователей синхронный
    // HTTP-запрос неизбежно упрётся в timeout и лимиты Telegram.
    if (isTelegramBroadcastToAll) {
      try {
        const queued = await MailingService.queueTelegramBroadcast({
          projectId,
          title: body.title,
          message: body.message,
          imageUrl: body.metadata?.imageUrl || body.imageUrl,
          buttons: body.metadata?.buttons || body.buttons,
          parseMode: body.metadata?.parseMode || body.parseMode || 'HTML'
        });

        return NextResponse.json(
          {
            success: true,
            data: {
              queued: true,
              mailingId: queued.mailingId,
              total: queued.total,
              eligible: queued.eligible,
              skipped: queued.skipped,
              sent: 0,
              failed: 0,
              results: []
            }
          },
          { status: 202 }
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Очередь недоступна';
        const status = message.includes('нет активных пользователей')
          ? 400
          : 503;
        return NextResponse.json({ error: message }, { status });
      }
    }

    // Определяем пользователей для точечной отправки
    let userIds: string[] = [];

    if (typeof body.userId === 'string' && body.userId.trim()) {
      userIds = [body.userId];
    } else if (Array.isArray(body.userIds)) {
      userIds = Array.from(
        new Set(
          body.userIds.filter(
            (userId: unknown): userId is string =>
              typeof userId === 'string' && userId.trim().length > 0
          )
        )
      );
    } else {
      const users = await ProjectNotificationService.getProjectUsers(projectId);
      userIds = users.map((user) => user.id);
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'Не найдено пользователей для отправки' },
        { status: 400 }
      );
    }

    // Отправляем уведомления массово
    // Извлекаем данные из metadata, если они там есть, иначе из body напрямую
    const imageUrl = body.metadata?.imageUrl || body.imageUrl;
    const buttons = body.metadata?.buttons || body.buttons;
    const parseMode = body.metadata?.parseMode || body.parseMode || 'Markdown';

    const result = await ProjectNotificationService.sendBulk(
      projectId,
      userIds,
      {
        type: body.type || 'custom',
        channel: body.channel as string,
        title: body.title,
        message: body.message,
        metadata: {
          imageUrl,
          buttons,
          parseMode,
          priority: body.priority || 'medium'
        }
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        eligible: result.total - result.skipped,
        total: result.total,
        // Не возвращаем тысячи skipped-записей в браузер. Для диагностики
        // достаточно реальных ошибок доставки (первые 100).
        results: result.results
          .filter((item) => !item.success && !item.skipped)
          .slice(0, 100)
      }
    });
  } catch (error) {
    logger.error('Failed to send notification:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Применяем rate limiting
export const GET = withApiRateLimit(handleGET);
export const POST = withApiRateLimit(handlePOST);
