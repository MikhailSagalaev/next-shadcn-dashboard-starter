// Типизация восстановлена для обеспечения безопасности типов

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { BonusLevelService } from '@/lib/services/bonus-level.service';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  Project
} from '@/types/bonus';

export class ProjectService {
  /**
   * Проверка доступа к проекту
   * @throws Error если доступ запрещен
   */
  static async verifyProjectAccess(
    projectId: string,
    adminId: string
  ): Promise<void> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project) {
      throw new Error('FORBIDDEN');
    }

    if (project.ownerId !== adminId) {
      throw new Error('FORBIDDEN');
    }
  }

  /**
   * Нормализация домена - принимает любой формат и приводит к стандартному виду
   */
  private static normalizeDomain(domain?: string): string | undefined {
    if (!domain || domain.trim() === '') {
      return undefined;
    }

    let normalized = domain.trim().toLowerCase();

    // Убираем протокол если есть
    normalized = normalized.replace(/^https?:\/\//, '');

    // Убираем www если есть
    normalized = normalized.replace(/^www\./, '');

    // Убираем завершающий слеш
    normalized = normalized.replace(/\/$/, '');

    // Убираем путь если есть (оставляем только домен)
    normalized = normalized.split('/')[0];

    // Проверяем, что это валидный домен
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!domainRegex.test(normalized)) {
      logger.warn('Некорректный формат домена', {
        original: domain,
        normalized,
        component: 'project-service'
      });
      return undefined;
    }

    logger.info('Домен нормализован', {
      original: domain,
      normalized,
      component: 'project-service'
    });

    return normalized;
  }

  // Создание нового проекта
  static async createProject(
    data: CreateProjectInput,
    ownerId: string
  ): Promise<Project> {
    const normalizedDomain = this.normalizeDomain(data.domain);

    const project = await db.project.create({
      data: {
        name: data.name,
        domain: normalizedDomain,
        bonusPercentage: data.bonusPercentage || 1.0,
        bonusExpiryDays: data.bonusExpiryDays || 365,
        ownerId
      },
      include: {
        botSettings: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    // Автоматически создаем уровни бонусов по умолчанию
    try {
      await BonusLevelService.createDefaultLevels(project.id);
      logger.info('Созданы уровни бонусов по умолчанию для проекта', {
        projectId: project.id,
        component: 'project-service'
      });
    } catch (error) {
      // Логируем ошибку, но не прерываем создание проекта
      logger.error('Не удалось создать уровни бонусов по умолчанию', {
        projectId: project.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'project-service'
      });
    }

    return project as any;
  }

  // Получение проекта по ID
  static async getProjectById(id: string): Promise<Project | null> {
    const project = await db.project.findUnique({
      where: { id },
      include: {
        botSettings: true,
        referralProgram: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    return project as any;
  }

  // Получение проекта по webhook secret
  static async getProjectByWebhookSecret(
    webhookSecret: string
  ): Promise<Project | null> {
    try {
      logger.info('ProjectService: поиск проекта по webhook secret', {
        webhookSecret,
        component: 'project-service'
      });

      // Сначала проверим подключение к БД
      await db.$queryRaw`SELECT 1`;

      let project = await db.project.findUnique({
        where: { webhookSecret },
        include: {
          botSettings: true,
          referralProgram: true,
          _count: {
            select: {
              users: true
            }
          }
        }
      });

      // Fallback: если findUnique не нашел, попробуем findFirst
      if (!project) {
        logger.warn('ProjectService: findUnique не нашел, пробуем findFirst', {
          webhookSecret,
          component: 'project-service'
        });

        project = await db.project.findFirst({
          where: { webhookSecret },
          include: {
            botSettings: true,
            referralProgram: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        });
      }

      if (project) {
        logger.info('ProjectService: проект найден', {
          projectId: project.id,
          projectName: project.name,
          webhookSecret,
          component: 'project-service'
        });
      } else {
        logger.warn('ProjectService: проект не найден', {
          webhookSecret,
          component: 'project-service'
        });

        // Попробуем найти любые проекты для отладки
        const allProjects = await db.project.findMany({
          select: {
            id: true,
            name: true,
            webhookSecret: true
          },
          take: 5
        });

        logger.info('ProjectService: существующие проекты (первые 5)', {
          projects: allProjects.map((p: any) => ({
            id: p.id,
            name: p.name,
            webhookSecret: p.webhookSecret
          })),
          component: 'project-service'
        });
      }

      return project as any;
    } catch (error) {
      logger.error('ProjectService: ошибка при поиске проекта', {
        webhookSecret,
        error: error instanceof Error ? error.message : 'Unknown error',
        component: 'project-service'
      });
      throw error;
    }
  }

  // Получение проекта по домену
  static async getProjectByDomain(domain: string): Promise<Project | null> {
    const project = await db.project.findUnique({
      where: { domain },
      include: {
        botSettings: true,
        referralProgram: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    return project as any;
  }

  // Получение всех проектов с пагинацией (фильтр по владельцу)
  static async getProjects(
    page = 1,
    limit = 10,
    ownerId?: string
  ): Promise<{ projects: Project[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const whereClause = ownerId ? { ownerId } : {};

      logger.info('ProjectService.getProjects: начало запроса', {
        page,
        limit,
        ownerId,
        whereClause,
        component: 'project-service'
      });

      const [projects, total] = await Promise.all([
        db.project.findMany({
          where: whereClause,
          skip,
          take: limit,
          include: {
            botSettings: true,
            referralProgram: true,
            _count: {
              select: {
                users: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        db.project.count({ where: whereClause })
      ]);

      logger.info('ProjectService.getProjects: запрос выполнен', {
        page,
        limit,
        ownerId,
        projectsCount: projects.length,
        total,
        component: 'project-service'
      });

      return { projects: projects as any, total };
    } catch (error) {
      // Безопасное логирование
      try {
        logger.error('ProjectService.getProjects: ошибка', {
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          stack: error instanceof Error ? error.stack : undefined,
          page,
          limit,
          ownerId,
          component: 'project-service'
        });
      } catch (logError) {
        console.error('ProjectService.getProjects: ошибка', error);
      }
      throw error;
    }
  }

  // Обновление проекта (с проверкой владельца)
  static async updateProject(
    id: string,
    data: UpdateProjectInput,
    adminId: string
  ): Promise<Project> {
    // Проверяем доступ
    await this.verifyProjectAccess(id, adminId);

    const project = await db.project.update({
      where: { id },
      data,
      include: {
        botSettings: true,
        referralProgram: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    return project as any;
  }

  // Деактивация проекта (с проверкой владельца)
  static async deactivateProject(
    id: string,
    adminId: string
  ): Promise<Project> {
    // Проверяем доступ
    await this.verifyProjectAccess(id, adminId);

    const project = await db.project.update({
      where: { id },
      data: { isActive: false },
      include: {
        botSettings: true,
        referralProgram: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    return project as any;
  }

  // Получение статистики проекта
  static async getProjectStats(projectId: string) {
    const [users, bonuses, transactions, activeBonuses, expiredBonuses] =
      await Promise.all([
        db.user.count({
          where: { projectId, isActive: true }
        }),
        db.bonus.count({
          where: { user: { projectId } }
        }),
        db.transaction.count({
          where: { user: { projectId } }
        }),
        db.bonus.count({
          where: {
            user: { projectId },
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        }),
        db.bonus.count({
          where: {
            user: { projectId },
            expiresAt: { lt: new Date() },
            isUsed: false
          }
        })
      ]);

    const spentBonuses = await db.transaction.aggregate({
      where: {
        user: { projectId },
        type: 'SPEND'
      },
      _sum: {
        amount: true
      }
    });

    return {
      totalUsers: users,
      totalBonuses: bonuses,
      totalTransactions: transactions,
      activeBonuses,
      expiredBonuses,
      spentBonuses: Number(spentBonuses._sum.amount || 0)
    };
  }
}
