/**
 * @file: src/app/api/super-admin/bots/debug/route.ts
 * @description: Диагностический endpoint для проверки данных о ботах
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации супер-админа
    const token = request.cookies.get('super_admin_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload || payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем все данные о ботах из обеих таблиц
    const [
      allBotSettings,
      allProjects,
      totalBotSettings,
      totalProjects,
      projectsWithBots
    ] = await Promise.all([
      // Все записи из bot_settings
      db.botSettings.findMany({
        include: {
          project: {
            select: {
              id: true,
              name: true,
              domain: true
            }
          }
        }
      }),
      // Все проекты
      db.project.findMany({
        select: {
          id: true,
          name: true,
          domain: true,
          botToken: true,
          botUsername: true,
          botStatus: true,
          createdAt: true
        }
      }),
      // Общее количество bot_settings
      db.botSettings.count(),
      // Общее количество проектов
      db.project.count(),
      // Проекты с ботами (без bot_settings)
      db.project.findMany({
        where: {
          OR: [
            { botToken: { not: null } },
            { botUsername: { not: null } }
          ]
        },
        select: {
          id: true,
          name: true,
          domain: true,
          botToken: true,
          botUsername: true,
          botStatus: true
        }
      })
    ]);

    // Проверяем, какие проекты имеют bot_settings
    const projectIdsWithBotSettings = allBotSettings.map(bs => bs.projectId);
    const projectsWithoutBotSettings = projectsWithBots.filter(
      p => !projectIdsWithBotSettings.includes(p.id)
    );

    return NextResponse.json({
      summary: {
        totalBotSettings: totalBotSettings,
        totalProjects: totalProjects,
        projectsWithBots: projectsWithBots.length,
        projectsWithoutBotSettings: projectsWithoutBotSettings.length
      },
      botSettings: allBotSettings.map(bs => ({
        id: bs.id,
        projectId: bs.projectId,
        botUsername: bs.botUsername,
        isActive: bs.isActive,
        projectName: bs.project?.name,
        createdAt: bs.createdAt.toISOString()
      })),
      projectsWithBotsInProjectsTable: projectsWithBots.map(p => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        botToken: p.botToken ? '***' : null,
        botUsername: p.botUsername,
        botStatus: p.botStatus,
        hasBotSettings: projectIdsWithBotSettings.includes(p.id)
      })),
      projectsWithoutBotSettings: projectsWithoutBotSettings.map(p => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        botUsername: p.botUsername,
        botStatus: p.botStatus
      }))
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
