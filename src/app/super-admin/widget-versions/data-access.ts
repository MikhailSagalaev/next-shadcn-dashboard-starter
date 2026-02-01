/**
 * @file: src/app/super-admin/widget-versions/data-access.ts
 * @description: Data access layer для управления версиями виджета
 * @project: SaaS Bonus System
 * @created: 2026-02-01
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface WidgetVersionStats {
  totalProjects: number;
  legacyProjects: number;
  universalProjects: number;
  legacyPercentage: number;
  universalPercentage: number;
}

export interface ProjectWithVersion {
  id: string;
  name: string;
  domain: string | null;
  widgetVersion: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
  owner: {
    email: string;
  } | null;
  _count: {
    users: number;
    webhookLogs: number;
  };
}

export interface WidgetVersionPageData {
  stats: WidgetVersionStats;
  projects: ProjectWithVersion[];
}

/**
 * Получить статистику по версиям виджета
 */
export async function getWidgetVersionStats(): Promise<WidgetVersionStats> {
  try {
    const [totalProjects, legacyProjects, universalProjects] =
      await Promise.all([
        db.project.count(),
        db.project.count({ where: { widgetVersion: 'legacy' } }),
        db.project.count({ where: { widgetVersion: 'universal' } })
      ]);

    return {
      totalProjects,
      legacyProjects,
      universalProjects,
      legacyPercentage:
        totalProjects > 0
          ? Math.round((legacyProjects / totalProjects) * 100)
          : 0,
      universalPercentage:
        totalProjects > 0
          ? Math.round((universalProjects / totalProjects) * 100)
          : 0
    };
  } catch (error) {
    logger.error(
      'Error fetching widget version stats',
      { error },
      'widget-versions'
    );
    return {
      totalProjects: 0,
      legacyProjects: 0,
      universalProjects: 0,
      legacyPercentage: 0,
      universalPercentage: 0
    };
  }
}

/**
 * Получить все проекты с информацией о версии виджета
 */
export async function getProjectsWithVersions(): Promise<ProjectWithVersion[]> {
  try {
    const projects = await db.project.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        widgetVersion: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        owner: {
          select: {
            email: true
          }
        },
        _count: {
          select: {
            users: true,
            webhookLogs: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return projects;
  } catch (error) {
    logger.error(
      'Error fetching projects with versions',
      { error },
      'widget-versions'
    );
    return [];
  }
}

/**
 * Получить данные для страницы управления версиями
 */
export async function getWidgetVersionPageData(): Promise<WidgetVersionPageData> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/super-admin/login');
  }

  try {
    const [stats, projects] = await Promise.all([
      getWidgetVersionStats(),
      getProjectsWithVersions()
    ]);

    return {
      stats,
      projects
    };
  } catch (error) {
    logger.error(
      'Error fetching widget version page data',
      { error },
      'widget-versions'
    );
    return {
      stats: {
        totalProjects: 0,
        legacyProjects: 0,
        universalProjects: 0,
        legacyPercentage: 0,
        universalPercentage: 0
      },
      projects: []
    };
  }
}

/**
 * Получить активность проекта за последние 7 дней
 */
export async function getProjectActivity(projectId: string): Promise<number> {
  try {
    const count = await db.webhookLog.count({
      where: {
        projectId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    return count;
  } catch (error) {
    logger.error(
      'Error fetching project activity',
      { error, projectId },
      'widget-versions'
    );
    return 0;
  }
}
