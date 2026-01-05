/**
 * @file: src/lib/services/subscription-notification.service.ts
 * @description: Сервис уведомлений об истечении подписки
 * @project: SaaS Bonus System
 * @dependencies: Prisma, NotificationService, Resend
 * @created: 2026-01-05
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Resend } from 'resend';

interface SubscriptionExpirationResult {
  processed: number;
  notificationsSent: number;
  subscriptionsDeactivated: number;
  errors: string[];
}

interface ExpiringSubscription {
  id: string;
  adminAccountId: string;
  planId: string;
  status: string;
  endDate: Date;
  adminAccount: {
    id: string;
    email: string;
  };
  plan: {
    id: string;
    name: string;
    price: { toNumber(): number } | number;
    currency: string;
  };
}

export class SubscriptionNotificationService {
  private static resend: Resend | null = null;
  private static fromEmail: string =
    process.env.RESEND_FROM_EMAIL || 'noreply@localhost';

  private static getResend(): Resend | null {
    if (!this.resend) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        this.resend = new Resend(apiKey);
      }
    }
    return this.resend;
  }

  /**
   * Обработка истекающих подписок
   * Отправляет уведомления за 7, 3 и 1 день до истечения
   */
  static async processExpiringSubscriptions(): Promise<SubscriptionExpirationResult> {
    const result: SubscriptionExpirationResult = {
      processed: 0,
      notificationsSent: 0,
      subscriptionsDeactivated: 0,
      errors: []
    };

    try {
      const now = new Date();
      const warningDays = [7, 3, 1];

      for (const days of warningDays) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);

        // Начало и конец целевого дня
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const expiringSubscriptions = (await db.subscription.findMany({
          where: {
            status: { in: ['active', 'trial'] },
            endDate: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          include: {
            adminAccount: {
              select: { id: true, email: true }
            },
            plan: {
              select: { id: true, name: true, price: true, currency: true }
            }
          }
        })) as ExpiringSubscription[];

        for (const subscription of expiringSubscriptions) {
          result.processed++;

          try {
            await this.sendExpirationWarning(subscription, days);
            result.notificationsSent++;
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Subscription ${subscription.id}: ${errorMsg}`);
            logger.error('Failed to send expiration warning', {
              subscriptionId: subscription.id,
              error: errorMsg
            });
          }
        }
      }

      // Деактивация просроченных подписок
      const expiredSubscriptions = (await db.subscription.findMany({
        where: {
          status: { in: ['active', 'trial'] },
          endDate: { lt: now }
        },
        include: {
          adminAccount: { select: { id: true, email: true } },
          plan: {
            select: { id: true, name: true, price: true, currency: true }
          }
        }
      })) as ExpiringSubscription[];

      for (const subscription of expiredSubscriptions) {
        try {
          await db.subscription.update({
            where: { id: subscription.id },
            data: { status: 'expired' }
          });

          await db.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              action: 'expired',
              reason: 'Subscription period ended',
              performedBy: 'system'
            }
          });

          await this.sendExpiredNotification(subscription);
          result.subscriptionsDeactivated++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Deactivation ${subscription.id}: ${errorMsg}`);
        }
      }

      logger.info('Subscription expiration processing completed', { result });
      return result;
    } catch (error) {
      logger.error('Error processing subscription expirations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Отправка предупреждения об истечении подписки
   */
  private static async sendExpirationWarning(
    subscription: ExpiringSubscription,
    daysLeft: number
  ): Promise<void> {
    const { adminAccount, plan } = subscription;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006';

    const subject = `Ваша подписка "${plan.name}" истекает через ${daysLeft} ${this.getDaysWord(daysLeft)}`;

    const html = this.getExpirationWarningTemplate({
      planName: plan.name,
      daysLeft,
      endDate: subscription.endDate,
      renewUrl: `${appUrl}/dashboard/billing`,
      price: plan.price,
      currency: plan.currency
    });

    await this.sendEmail(adminAccount.email, subject, html);

    logger.info('Expiration warning sent', {
      subscriptionId: subscription.id,
      email: adminAccount.email.substring(0, 3) + '***',
      daysLeft
    });
  }

  /**
   * Отправка уведомления об истечении подписки
   */
  private static async sendExpiredNotification(
    subscription: ExpiringSubscription
  ): Promise<void> {
    const { adminAccount, plan } = subscription;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006';

    const subject = `Ваша подписка "${plan.name}" истекла`;

    const html = this.getExpiredTemplate({
      planName: plan.name,
      renewUrl: `${appUrl}/dashboard/billing`
    });

    await this.sendEmail(adminAccount.email, subject, html);

    logger.info('Expired notification sent', {
      subscriptionId: subscription.id,
      email: adminAccount.email.substring(0, 3) + '***'
    });
  }

  /**
   * Отправка email
   */
  private static async sendEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    const resend = this.getResend();

    if (!resend) {
      logger.info('Email sent (stub - RESEND_API_KEY not configured)', {
        to: to.substring(0, 3) + '***',
        subject
      });
      return;
    }

    const result = await resend.emails.send({
      from: this.fromEmail,
      to,
      subject,
      html
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  /**
   * Склонение слова "день"
   */
  private static getDaysWord(days: number): string {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }

  /**
   * HTML шаблон предупреждения об истечении
   */
  private static getExpirationWarningTemplate(data: {
    planName: string;
    daysLeft: number;
    endDate: Date;
    renewUrl: string;
    price: { toNumber(): number } | number;
    currency: string;
  }): string {
    const formattedDate = data.endDate.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const priceValue =
      typeof data.price === 'number' ? data.price : data.price.toNumber();
    const formattedPrice = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: data.currency,
      minimumFractionDigits: 0
    }).format(priceValue);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Подписка истекает</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
      <strong style="color: #92400e;">Внимание!</strong>
      <p style="margin: 5px 0 0; color: #92400e;">
        Ваша подписка "${data.planName}" истекает через <strong>${data.daysLeft} ${this.getDaysWord(data.daysLeft)}</strong>
      </p>
    </div>

    <p>Дата окончания: <strong>${formattedDate}</strong></p>
    <p>Стоимость продления: <strong>${formattedPrice}/месяц</strong></p>

    <p>После истечения подписки:</p>
    <ul style="color: #6b7280;">
      <li>Доступ к платным функциям будет ограничен</li>
      <li>Ваши данные сохранятся</li>
      <li>Вы сможете продлить подписку в любой момент</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.renewUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        Продлить подписку
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
      Если у вас есть вопросы, свяжитесь с нашей поддержкой.
    </p>
  </div>
</body>
</html>`;
  }

  /**
   * HTML шаблон уведомления об истечении
   */
  private static getExpiredTemplate(data: {
    planName: string;
    renewUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Подписка истекла</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
      <strong style="color: #991b1b;">Ваша подписка "${data.planName}" истекла</strong>
    </div>

    <p>Доступ к платным функциям ограничен. Чтобы продолжить пользоваться всеми возможностями сервиса, продлите подписку.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.renewUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        Продлить подписку
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
      Ваши данные сохранены и будут доступны после продления подписки.
    </p>
  </div>
</body>
</html>`;
  }
}
