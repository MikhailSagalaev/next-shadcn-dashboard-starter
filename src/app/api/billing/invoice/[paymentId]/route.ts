/**
 * @file: src/app/api/billing/invoice/[paymentId]/route.ts
 * @description: API endpoint для скачивания инвойса
 * @project: SaaS Bonus System
 * @dependencies: InvoiceService, JWT auth
 * @created: 2026-01-05
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { InvoiceService } from '@/lib/services/invoice.service';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ paymentId: string }>;
}

/**
 * GET /api/billing/invoice/[paymentId]
 * Получить инвойс в формате HTML (для печати/PDF)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId } = await params;

    // Проверяем, что платеж принадлежит текущему пользователю
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: { adminAccountId: true, status: true }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.adminAccountId !== admin.sub) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Получаем данные инвойса
    const invoiceData = await InvoiceService.getInvoiceData(paymentId);
    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Проверяем формат ответа
    const format = request.nextUrl.searchParams.get('format') || 'html';

    if (format === 'json') {
      return NextResponse.json({ invoice: invoiceData });
    }

    // Генерируем HTML
    const html = InvoiceService.generateInvoiceHtml(invoiceData);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${invoiceData.invoiceNumber}.html"`
      }
    });
  } catch (error) {
    logger.error('Error generating invoice', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
