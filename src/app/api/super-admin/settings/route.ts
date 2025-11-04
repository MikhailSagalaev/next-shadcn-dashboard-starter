/**
 * @file: src/app/api/super-admin/settings/route.ts
 * @description: API для управления системными настройками
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    let settings = await db.systemSettings.findUnique({
      where: { id: 'system' }
    });

    if (!settings) {
      // Создаем дефолтные настройки если их нет
      settings = await db.systemSettings.create({
        data: {
          id: 'system',
          settings: {
            maintenanceMode: false,
            featureFlags: {},
            limits: {
              maxProjectsPerAdmin: 10,
              maxUsersPerProject: 10000,
              maxBotsPerProject: 1
            }
          }
        }
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings data' },
        { status: 400 }
      );
    }

    const updated = await db.systemSettings.upsert({
      where: { id: 'system' },
      update: { settings },
      create: {
        id: 'system',
        settings
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating system settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
