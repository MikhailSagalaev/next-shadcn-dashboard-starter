/**
 * @file: src/lib/services/notification.service.ts
 * @description: Сервис уведомлений - Email, SMS, Push
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger, Resend
 * @created: 2025-10-02
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { Resend } from 'resend';

// Типы каналов уведомлений
export type NotificationChannel = 'email' | 'sms' | 'push' | 'telegram';

// Интерфейс провайдера уведомлений
interface NotificationProvider {
  send(
    to: string,
    subject: string,
    content: string,
    options?: any
  ): Promise<boolean>;
}

// Email провайдер через Resend
class EmailProvider implements NotificationProvider {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@localhost';
    
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      logger.warn('RESEND_API_KEY не установлен, используется заглушка для email');
    }
  }

  async send(to: string, subject: string, content: string): Promise<boolean> {
    try {
      // Если Resend не настроен, используем заглушку
      if (!this.resend) {
        logger.info('📧 Email отправлен (заглушка - RESEND_API_KEY не настроен)', {
          to: to.substring(0, 3) + '***',
          subject,
          contentLength: content.length
        });
        return true;
      }

      // Отправка через Resend
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: to,
        subject: subject,
        html: content
      });

      if (result.error) {
        logger.error('Ошибка отправки email через Resend', {
          error: result.error.message,
          to: to.substring(0, 3) + '***'
        });
        return false;
      }

      logger.info('📧 Email отправлен успешно через Resend', {
        to: to.substring(0, 3) + '***',
        subject,
        emailId: result.data?.id
      });

      return true;
    } catch (error) {
      logger.error('Ошибка отправки email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: to.substring(0, 3) + '***'
      });
      return false;
    }
  }
}

// SMS провайдер (заглушка)
class SMSProvider implements NotificationProvider {
  async send(to: string, subject: string, content: string): Promise<boolean> {
    try {
      logger.info('📱 SMS отправлен (заглушка)', {
        to: to.substring(0, 3) + '***',
        contentLength: content.length
      });

      // TODO: Интеграция с SMS провайдером (Twilio, SMS.ru и т.д.)
      return true;
    } catch (error) {
      logger.error('Ошибка отправки SMS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Push провайдер (заглушка)
class PushProvider implements NotificationProvider {
  async send(to: string, subject: string, content: string): Promise<boolean> {
    try {
      logger.info('🔔 Push уведомление отправлено (заглушка)', {
        to: to.substring(0, 8) + '***',
        subject
      });

      // TODO: Интеграция с Push провайдером (Firebase, OneSignal и т.д.)
      return true;
    } catch (error) {
      logger.error('Ошибка отправки Push', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Основной сервис уведомлений
export class NotificationService {
  private static providers: Map<NotificationChannel, NotificationProvider> =
    new Map([
      ['email', new EmailProvider()],
      ['sms', new SMSProvider()],
      ['push', new PushProvider()]
    ]);

  /**
   * Отправка уведомления через указанный канал
   */
  static async send(
    channel: NotificationChannel,
    to: string,
    subject: string,
    content: string,
    options?: any
  ): Promise<boolean> {
    const provider = this.providers.get(channel);

    if (!provider) {
      logger.error('Провайдер уведомлений не найден', { channel });
      return false;
    }

    return provider.send(to, subject, content, options);
  }

  /**
   * Отправка email для восстановления пароля
   */
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    resetUrl?: string
  ): Promise<boolean> {
    const url =
      resetUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

    const subject = 'Восстановление пароля - gupil.ru';
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Восстановление пароля</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e5e5;">
                    <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">🔐 Восстановление пароля</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 40px;">
                    <p style="margin: 0 0 20px; color: #555; font-size: 16px; line-height: 1.6;">Вы запросили восстановление пароля для вашего аккаунта.</p>
                    <p style="margin: 0 0 30px; color: #555; font-size: 16px; line-height: 1.6;">Нажмите на кнопку ниже, чтобы установить новый пароль:</p>
                    <table role="presentation" style="margin: 30px 0;">
                      <tr>
                        <td style="text-align: center;">
                          <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Восстановить пароль</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 30px 0 0; color: #999; font-size: 14px; line-height: 1.6;">Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
                    <p style="margin: 10px 0 0; color: #999; font-size: 14px; line-height: 1.6;">⏰ Ссылка действительна в течение 1 часа.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                    <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.6;">© ${new Date().getFullYear()} gupil.ru. Все права защищены.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.send('email', email, subject, content);
  }

  /**
   * Отправка welcome email
   */
  static async sendWelcomeEmail(
    email: string,
    name?: string
  ): Promise<boolean> {
    const subject = 'Добро пожаловать в gupil.ru!';
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Добро пожаловать!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e5e5;">
                    <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">🎉 Добро пожаловать${name ? `, ${name}` : ''}!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 40px;">
                    <p style="margin: 0 0 20px; color: #555; font-size: 16px; line-height: 1.6;">Спасибо за регистрацию в нашей системе управления бонусами!</p>
                    <p style="margin: 0 0 25px; color: #555; font-size: 16px; line-height: 1.6;">Теперь вы можете:</p>
                    <ul style="margin: 0 0 30px; padding-left: 25px; color: #555; font-size: 16px; line-height: 2;">
          <li>Создавать проекты бонусных программ</li>
          <li>Настраивать Telegram ботов</li>
          <li>Интегрировать с Tilda и другими платформами</li>
          <li>Управлять пользователями и бонусами</li>
        </ul>
                    <table role="presentation" style="margin: 30px 0;">
                      <tr>
                        <td style="text-align: center;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Перейти в панель управления</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                    <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.6;">© ${new Date().getFullYear()} gupil.ru. Все права защищены.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.send('email', email, subject, content);
  }

  /**
   * Отправка email верификации
   */
  static async sendVerificationEmail(
    email: string,
    verificationToken: string
  ): Promise<boolean> {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${verificationToken}`;

    const subject = 'Подтверждение email - gupil.ru';
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Подтверждение email</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e5e5;">
                    <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">✉️ Подтверждение email</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 40px;">
                    <p style="margin: 0 0 20px; color: #555; font-size: 16px; line-height: 1.6;">Спасибо за регистрацию в gupil.ru!</p>
                    <p style="margin: 0 0 30px; color: #555; font-size: 16px; line-height: 1.6;">Для завершения регистрации подтвердите ваш email адрес, нажав на кнопку ниже:</p>
                    <table role="presentation" style="margin: 30px 0;">
                      <tr>
                        <td style="text-align: center;">
                          <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Подтвердить email</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 30px 0 0; color: #999; font-size: 14px; line-height: 1.6;">⏰ Ссылка действительна в течение 24 часов.</p>
                    <p style="margin: 10px 0 0; color: #999; font-size: 14px; line-height: 1.6;">Если вы не создавали аккаунт, проигнорируйте это письмо.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                    <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.6;">© ${new Date().getFullYear()} gupil.ru. Все права защищены.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.send('email', email, subject, content);
  }

  /**
   * Пакетная отправка уведомлений
   */
  static async sendBatch(
    channel: NotificationChannel,
    recipients: Array<{ to: string; subject: string; content: string }>,
    options?: {
      parallel?: boolean;
      batchSize?: number;
    }
  ): Promise<{ sent: number; failed: number; total: number }> {
    const { parallel = false, batchSize = 10 } = options || {};

    const results = {
      sent: 0,
      failed: 0,
      total: recipients.length
    };

    if (parallel) {
      // Параллельная отправка порциями
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const promises = batch.map((r) =>
          this.send(channel, r.to, r.subject, r.content)
        );

        const batchResults = await Promise.allSettled(promises);
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            results.sent++;
          } else {
            results.failed++;
          }
        });
      }
    } else {
      // Последовательная отправка
      for (const recipient of recipients) {
        const success = await this.send(
          channel,
          recipient.to,
          recipient.subject,
          recipient.content
        );
        if (success) {
          results.sent++;
        } else {
          results.failed++;
        }
      }
    }

    logger.info('Пакетная отправка завершена', {
      channel,
      ...results
    });

    return results;
  }
}
