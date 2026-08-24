/**
 * @file: src/app/r/[code]/route.ts
 * @description: Публичный эндпоинт редиректа для трекинга переходов по ссылкам из рассылок (Telegram / MAX)
 */

import { NextRequest, NextResponse } from 'next/server';
import { MailingTrackerService } from '@/lib/services/mailing-tracker.service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const recipientId = searchParams.get('r');

    const userAgent = request.headers.get('user-agent');
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp;

    const result = await MailingTrackerService.recordClick({
      shortCode: code,
      recipientId,
      userAgent,
      ipAddress
    });

    return NextResponse.redirect(result.destinationUrl, { status: 302 });
  } catch (error) {
    const fallbackUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://gupil.ru';
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }
}
