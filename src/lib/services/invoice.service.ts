/**
 * @file: src/lib/services/invoice.service.ts
 * @description: Сервис генерации счетов/инвойсов в PDF
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2026-01-05
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;

  // Продавец
  seller: {
    name: string;
    address: string;
    inn?: string;
    kpp?: string;
    email: string;
  };

  // Покупатель
  buyer: {
    name: string;
    email: string;
  };

  // Позиции
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;

  // Итоги
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: string;

  // Статус
  status: 'paid' | 'pending' | 'cancelled';
  paidAt?: Date;
}

export class InvoiceService {
  private static readonly SELLER_INFO = {
    name: process.env.COMPANY_NAME || 'SaaS Bonus System',
    address: process.env.COMPANY_ADDRESS || 'Россия',
    inn: process.env.COMPANY_INN || '',
    kpp: process.env.COMPANY_KPP || '',
    email: process.env.COMPANY_EMAIL || 'billing@example.com'
  };

  /**
   * Получить данные инвойса по ID платежа
   */
  static async getInvoiceData(paymentId: string): Promise<InvoiceData | null> {
    try {
      const payment = await db.payment.findUnique({
        where: { id: paymentId },
        include: {
          adminAccount: {
            select: { email: true }
          },
          plan: {
            select: { name: true, price: true, currency: true, interval: true }
          }
        }
      });

      if (!payment || !payment.plan) {
        return null;
      }

      const amount = Number(payment.amount);
      const taxRate = 0; // Без НДС для упрощенки
      const tax = amount * taxRate;

      return {
        invoiceNumber: this.generateInvoiceNumber(
          payment.id,
          payment.createdAt
        ),
        invoiceDate: payment.createdAt,
        dueDate: payment.createdAt,

        seller: this.SELLER_INFO,

        buyer: {
          name: payment.adminAccount.email,
          email: payment.adminAccount.email
        },

        items: [
          {
            description: `Подписка "${payment.plan.name}" (${payment.plan.interval === 'month' ? '1 месяц' : '1 год'})`,
            quantity: 1,
            unitPrice: amount,
            total: amount
          }
        ],

        subtotal: amount,
        tax,
        taxRate,
        total: amount + tax,
        currency: payment.currency,

        status:
          payment.status === 'succeeded'
            ? 'paid'
            : payment.status === 'canceled'
              ? 'cancelled'
              : 'pending',
        paidAt: payment.status === 'succeeded' ? payment.updatedAt : undefined
      };
    } catch (error) {
      logger.error('Error getting invoice data', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Генерация номера инвойса
   */
  private static generateInvoiceNumber(paymentId: string, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const shortId = paymentId.slice(-6).toUpperCase();
    return `INV-${year}${month}-${shortId}`;
  }

  /**
   * Генерация HTML инвойса для печати/PDF
   */
  static generateInvoiceHtml(invoice: InvoiceData): string {
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: invoice.currency,
        minimumFractionDigits: 2
      }).format(value);

    const formatDate = (date: Date) =>
      date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    const statusBadge =
      invoice.status === 'paid'
        ? '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px;">ОПЛАЧЕНО</span>'
        : invoice.status === 'cancelled'
          ? '<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px;">ОТМЕНЕНО</span>'
          : '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px;">ОЖИДАЕТ ОПЛАТЫ</span>';

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Счет ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #1f2937;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .logo { font-size: 24px; font-weight: bold; color: #4f46e5; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 20px; font-weight: bold; color: #1f2937; }
    .invoice-date { color: #6b7280; margin-top: 4px; }
    .parties { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 40px; 
      margin-bottom: 40px; 
    }
    .party h3 { 
      font-size: 12px; 
      text-transform: uppercase; 
      color: #6b7280; 
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .party-name { font-weight: 600; font-size: 16px; }
    .party-details { color: #6b7280; font-size: 14px; margin-top: 4px; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 30px;
    }
    th { 
      background: #f9fafb; 
      padding: 12px 16px; 
      text-align: left; 
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
    }
    td { 
      padding: 16px; 
      border-bottom: 1px solid #e5e7eb;
    }
    .text-right { text-align: right; }
    .totals { 
      margin-left: auto; 
      width: 300px;
    }
    .totals-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total { 
      font-weight: bold; 
      font-size: 18px;
      border-bottom: none;
      padding-top: 16px;
    }
    .status-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 12px;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${invoice.seller.name}</div>
    <div class="invoice-info">
      <div class="invoice-number">${invoice.invoiceNumber}</div>
      <div class="invoice-date">от ${formatDate(invoice.invoiceDate)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Продавец</h3>
      <div class="party-name">${invoice.seller.name}</div>
      <div class="party-details">
        ${invoice.seller.address}<br>
        ${invoice.seller.inn ? `ИНН: ${invoice.seller.inn}` : ''} 
        ${invoice.seller.kpp ? `КПП: ${invoice.seller.kpp}` : ''}<br>
        ${invoice.seller.email}
      </div>
    </div>
    <div class="party">
      <h3>Покупатель</h3>
      <div class="party-name">${invoice.buyer.name}</div>
      <div class="party-details">${invoice.buyer.email}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Описание</th>
        <th class="text-right">Кол-во</th>
        <th class="text-right">Цена</th>
        <th class="text-right">Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items
        .map(
          (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.total)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Подытог</span>
      <span>${formatCurrency(invoice.subtotal)}</span>
    </div>
    ${
      invoice.taxRate > 0
        ? `
    <div class="totals-row">
      <span>НДС (${invoice.taxRate * 100}%)</span>
      <span>${formatCurrency(invoice.tax)}</span>
    </div>
    `
        : ''
    }
    <div class="totals-row total">
      <span>Итого</span>
      <span>${formatCurrency(invoice.total)}</span>
    </div>
  </div>

  <div class="status-section">
    <div>
      ${invoice.paidAt ? `<span style="color: #6b7280;">Оплачено: ${formatDate(invoice.paidAt)}</span>` : ''}
    </div>
    <div>${statusBadge}</div>
  </div>

  <div class="footer">
    <p>Счет сформирован автоматически и действителен без подписи.</p>
    <p style="margin-top: 8px;">${invoice.seller.name} • ${invoice.seller.email}</p>
  </div>
</body>
</html>`;
  }

  /**
   * Список платежей пользователя с возможностью скачивания инвойсов
   */
  static async getPaymentsWithInvoices(adminId: string): Promise<
    Array<{
      id: string;
      date: string;
      amount: number;
      currency: string;
      status: string;
      description: string;
      invoiceNumber: string;
      canDownload: boolean;
    }>
  > {
    const payments = await db.payment.findMany({
      where: { adminAccountId: adminId },
      include: {
        plan: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return payments.map((payment) => ({
      id: payment.id,
      date: payment.createdAt.toISOString(),
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      description: payment.plan
        ? `Подписка "${payment.plan.name}"`
        : payment.description || 'Платеж',
      invoiceNumber: this.generateInvoiceNumber(payment.id, payment.createdAt),
      canDownload: payment.status === 'succeeded'
    }));
  }
}
