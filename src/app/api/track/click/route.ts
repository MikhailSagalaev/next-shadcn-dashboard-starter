/**
 * @file: src/app/api/track/click/route.ts
 * @description: Публичный API для отслеживания кликов по ссылкам в рассылках
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma
 * @created: 2025-11-26
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

// GET /api/track/click?m=mailingId&r=recipientId&u=encodedUrl
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const mailingId = url.searchParams.get('m');
    const recipientId = url.searchParams.get('r');
    const targetUrl = url.searchParams.get('u');

    if (!mailingId || !recipientId || !targetUrl) {
      // Редирект на главную если параметры неполные
      return NextResponse.redirect(new URL('/', request.url));
    }

    const decodedUrl = decodeURIComponent(targetUrl);

    // Получаем информацию о запросе
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress =
      forwardedFor?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Записываем клик асинхронно (не блокируем редирект)
    db.mailingLinkClick
      .create({
        data: {
          mailingId,
          recipientId,
          url: decodedUrl,
          userAgent,
          ipAddress
        }
      })
      .then(() => {
        // Обновляем счетчики получателя
        return db.mailingRecipient.update({
          where: { id: recipientId },
          data: {
            clickCount: { increment: 1 },
            clickedAt: db.mailingRecipient
              .findUnique({
                where: { id: recipientId },
                select: { clickedAt: true }
              })
              .then((r) => r?.clickedAt || new Date())
          }
        });
      })
      .catch((error) => {
        logger.error('Ошибка записи клика', {
          mailingId,
          recipientId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка'
        });
      });

    // Немедленный редирект на целевой URL
    return NextResponse.redirect(decodedUrl, { status: 302 });
  } catch (error) {
    logger.error('Ошибка обработки клика', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });

    // В случае ошибки редиректим на главную
    return NextResponse.redirect(new URL('/', request.url));
  }
}

// POST /api/track/click - Альтернативный метод для callback кнопок Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mailingId, recipientId, url } = body;

    if (!mailingId || !recipientId || !url) {
      return NextResponse.json(
        { error: 'Missing parameters' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress =
      forwardedFor?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Записываем клик
    await db.mailingLinkClick.create({
      data: {
        mailingId,
        recipientId,
        url,
        userAgent,
        ipAddress
      }
    });

    // Обновляем счетчики получателя
    const recipient = await db.mailingRecipient.findUnique({
      where: { id: recipientId },
      select: { clickedAt: true }
    });

    await db.mailingRecipient.update({
      where: { id: recipientId },
      data: {
        clickCount: { increment: 1 },
        clickedAt: recipient?.clickedAt || new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Ошибка записи клика (POST)', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });

    return NextResponse.json({ error: 'Ошибка записи клика' }, { status: 500 });
  }
}
