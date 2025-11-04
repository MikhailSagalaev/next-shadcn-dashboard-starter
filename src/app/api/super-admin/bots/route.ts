/**
 * @file: src/app/api/super-admin/bots/route.ts
 * @description: API для управления ботами всех проектов
 * @project: SaaS Bonus System
 * @dependencies: Prisma
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

    try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    // Получаем боты из двух источников:
    // 1. Из таблицы bot_settings (основной источник)
    // 2. Из таблицы projects (для проектов, где бот настроен напрямую, но нет записи в bot_settings)
    
    // Сначала получаем боты из bot_settings
    const botSettingsWhere: any = {};
    if (search) {
      botSettingsWhere.OR = [
        { botUsername: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    if (isActive !== null && isActive !== undefined) {
      botSettingsWhere.isActive = isActive === 'true';
    }

    console.log('🔍 Querying bot_settings with where:', JSON.stringify(botSettingsWhere, null, 2));

    const [botSettings, botSettingsCount] = await Promise.all([
      db.botSettings.findMany({
        where: botSettingsWhere,
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
      db.botSettings.count({ where: botSettingsWhere })
    ]);

    console.log('📊 BotSettings query results:', {
      count: botSettings.length,
      totalCount: botSettingsCount,
      samples: botSettings.slice(0, 3).map(bs => ({
        id: bs.id,
        projectId: bs.projectId,
        botUsername: bs.botUsername,
        projectName: bs.project?.name
      }))
    });

    // Проверяем общее количество записей в bot_settings (без фильтров)
    const totalBotSettingsCount = await db.botSettings.count();
    console.log('📈 Total bot_settings in database (no filters):', totalBotSettingsCount);

    // Теперь получаем проекты, где бот настроен в таблице projects
    // Получаем ID проектов, которые уже есть в bot_settings, чтобы исключить их
    const projectIdsWithBotSettings = botSettings.map(bs => bs.projectId);
    console.log('🆔 Project IDs that already have bot_settings:', projectIdsWithBotSettings);

    const projectsWhere: any = {
      OR: [
        { botToken: { not: null } },
        { botUsername: { not: null } }
      ]
    };

    // Исключаем проекты, которые уже есть в bot_settings
    if (projectIdsWithBotSettings.length > 0) {
      projectsWhere.NOT = {
        id: { in: projectIdsWithBotSettings }
      };
    }

    if (search) {
      projectsWhere.AND = [
        ...(projectsWhere.AND || []),
        {
          OR: [
            { botUsername: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      const activeValue = isActive === 'true';
      projectsWhere.AND = [
        ...(projectsWhere.AND || []),
        { botStatus: activeValue ? 'ACTIVE' : 'INACTIVE' }
      ];
    }

    console.log('🔍 Querying projects with where:', JSON.stringify(projectsWhere, null, 2));

    // Проверяем общее количество проектов с ботами (без фильтров и исключений)
    const totalProjectsWithBots = await db.project.count({
      where: {
        OR: [
          { botToken: { not: null } },
          { botUsername: { not: null } }
        ]
      }
    });
    console.log('📈 Total projects with bots (no filters):', totalProjectsWithBots);

    const [projectsWithBots, projectsCount] = await Promise.all([
      db.project.findMany({
        where: projectsWhere,
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
      db.project.count({ where: projectsWhere })
    ]);

    console.log('📊 Projects query results:', {
      count: projectsWithBots.length,
      totalCount: projectsCount,
      samples: projectsWithBots.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        botUsername: p.botUsername,
        botStatus: p.botStatus,
        hasBotToken: !!p.botToken
      }))
    });

    // Объединяем данные из обоих источников
    const allBots = [
      ...botSettings.map(bs => ({
        id: bs.id,
        botUsername: bs.botUsername,
        isActive: bs.isActive,
        createdAt: bs.createdAt,
        project: bs.project,
        source: 'bot_settings' as const
      })),
      ...projectsWithBots
        .filter(p => p.botToken || p.botUsername)
        .map(p => ({
          id: `project_${p.id}`, // Временный ID для проектов без bot_settings
          botUsername: p.botUsername || 'Не указан',
          isActive: p.botStatus === 'ACTIVE',
          createdAt: p.createdAt,
          project: {
            id: p.id,
            name: p.name,
            domain: p.domain
          },
          source: 'projects' as const
        }))
    ];

    const total = botSettingsCount + projectsCount;

    // Сортировка по дате создания (новые сначала)
    allBots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Пагинация
    const paginatedBots = allBots.slice((page - 1) * limit, page * limit);

    console.log('Bots fetched:', {
      fromBotSettings: botSettings.length,
      fromProjects: projectsWithBots.length,
      total: allBots.length,
      paginated: paginatedBots.length,
      sample: paginatedBots.length > 0 ? {
        id: paginatedBots[0].id,
        botUsername: paginatedBots[0].botUsername,
        projectName: paginatedBots[0].project?.name,
        source: paginatedBots[0].source
      } : null
    });

    // Сериализация данных с обработкой BigInt и Date
    const serializedBots = paginatedBots.map(bot => ({
      id: bot.id,
      botUsername: bot.botUsername,
      isActive: bot.isActive,
      createdAt: bot.createdAt.toISOString(),
      project: bot.project
    }));

    return NextResponse.json({
      bots: serializedBots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    } catch (dbError) {
      console.error('Database error fetching bots:', dbError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in super-admin bots API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
