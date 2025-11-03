/**
 * @file: src/lib/services/billing.service.ts
 * @description: Сервис для управления тарифами и проверки лимитов подписки
 * @project: SaaS Bonus System
 * @dependencies: Prisma, db
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    projects: number;
    users: number;
    bots: number;
    notifications: number;
  };
  popular?: boolean;
}

export interface UsageStats {
  projects: { used: number; limit: number };
  users: { used: number; limit: number };
  bots: { used: number; limit: number };
  notifications: { used: number; limit: number };
}

export class BillingService {
  /**
   * Получить план на основе роли администратора
   */
  static getPlanByRole(role: string): BillingPlan {
    switch (role) {
      case 'SUPERADMIN':
      case 'ADMIN':
        return {
          id: 'professional',
          name: 'Профессиональный',
          price: 2990,
          currency: 'RUB',
          interval: 'month',
          features: [
            'До 5 проектов',
            'До 1000 пользователей',
            '5 Telegram ботов',
            'Расширенные уведомления',
            'Приоритетная поддержка',
            'Аналитика и отчеты'
          ],
          limits: {
            projects: 5,
            users: 1000,
            bots: 5,
            notifications: 10000
          },
          popular: true
        };
      case 'MANAGER':
      default:
        return {
          id: 'starter',
          name: 'Стартовый',
          price: 0,
          currency: 'RUB',
          interval: 'month',
          features: [
            'До 1 проекта',
            'До 100 пользователей',
            '1 Telegram бот',
            'Базовые уведомления',
            'Email поддержка'
          ],
          limits: {
            projects: 1,
            users: 100,
            bots: 1,
            notifications: 1000
          }
        };
    }
  }

  /**
   * Получить текущий план администратора
   */
  static async getCurrentPlan(adminId: string): Promise<BillingPlan | null> {
    const admin = await db.adminAccount.findUnique({
      where: { id: adminId },
      select: { role: true }
    });

    if (!admin) return null;

    return this.getPlanByRole(admin.role || 'MANAGER');
  }

  /**
   * Проверить, не превышен ли лимит
   */
  static async checkLimit(
    adminId: string,
    resourceType: 'projects' | 'users' | 'bots' | 'notifications'
  ): Promise<{ allowed: boolean; used: number; limit: number; planId: string }> {
    const plan = await this.getCurrentPlan(adminId);
    if (!plan) {
      throw new Error('Admin not found');
    }

    let used = 0;

    switch (resourceType) {
      case 'projects':
        used = await db.project.count({
          where: { ownerId: adminId }
        });
        break;

      case 'bots':
        const projects = await db.project.findMany({
          where: { ownerId: adminId },
          select: { id: true }
        });
        used = await db.botSettings.count({
          where: {
            projectId: { in: projects.map(p => p.id) }
          }
        });
        break;

      case 'users':
        const userProjects = await db.project.findMany({
          where: { ownerId: adminId },
          select: { id: true }
        });
        used = await db.user.count({
          where: {
            projectId: { in: userProjects.map(p => p.id) }
          }
        });
        break;

      case 'notifications':
        // TODO: Реализовать подсчет уведомлений за период
        used = 0;
        break;
    }

    const limit = plan.limits[resourceType];
    const allowed = limit === -1 || used < limit;

    return {
      allowed,
      used,
      limit,
      planId: plan.id
    };
  }

  /**
   * Получить статистику использования для администратора
   */
  static async getUsageStats(adminId: string): Promise<{
    plan: BillingPlan;
    usage: UsageStats;
  } | null> {
    const plan = await this.getCurrentPlan(adminId);
    if (!plan) return null;

    const projects = await db.project.findMany({
      where: { ownerId: adminId },
      select: { id: true }
    });

    const [projectsCount, usersCount, botsCount] = await Promise.all([
      db.project.count({ where: { ownerId: adminId } }),
      db.user.count({
        where: { projectId: { in: projects.map(p => p.id) } }
      }),
      db.botSettings.count({
        where: { projectId: { in: projects.map(p => p.id) } }
      })
    ]);

    const usage: UsageStats = {
      projects: {
        used: projectsCount,
        limit: plan.limits.projects === -1 ? -1 : plan.limits.projects
      },
      users: {
        used: usersCount,
        limit: plan.limits.users === -1 ? -1 : plan.limits.users
      },
      bots: {
        used: botsCount,
        limit: plan.limits.bots === -1 ? -1 : plan.limits.bots
      },
      notifications: {
        used: 0, // TODO: Подсчет уведомлений
        limit: plan.limits.notifications === -1 ? -1 : plan.limits.notifications
      }
    };

    return { plan, usage };
  }

  /**
   * Проверить, приближается ли пользователь к лимиту
   */
  static async isApproachingLimit(
    adminId: string,
    resourceType: 'projects' | 'users' | 'bots' | 'notifications',
    threshold: number = 0.8
  ): Promise<boolean> {
    const { used, limit } = await this.checkLimit(adminId, resourceType);

    if (limit === -1) return false; // Безлимитный план

    return used / limit >= threshold;
  }
}

