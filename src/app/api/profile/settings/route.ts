/**
 * @file: src/app/api/profile/settings/route.ts
 * @description: API endpoint для настроек профиля администратора
 * @project: SaaS Bonus System
 * @dependencies: Prisma, JWT auth
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';

type ProfileSettings = {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatar: string;
  };
  security: {
    enableTwoFactor: boolean;
    sessionTimeout: number;
    changePassword: boolean;
  };
  notifications: {
    enableEmailNotifications: boolean;
    enableSystemNotifications: boolean;
    enableSecurityAlerts: boolean;
    notificationEmail: string;
  };
};

const defaultSettings = (): ProfileSettings => ({
  personal: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatar: ''
  },
  security: {
    enableTwoFactor: false,
    sessionTimeout: 24,
    changePassword: false
  },
  notifications: {
    enableEmailNotifications: true,
    enableSystemNotifications: true,
    enableSecurityAlerts: true,
    notificationEmail: ''
  }
});

const mergeSettings = (stored?: Partial<ProfileSettings>): ProfileSettings => {
  const defaults = defaultSettings();
  if (!stored) {
    return defaults;
  }

  return {
    personal: { ...defaults.personal, ...(stored.personal || {}) },
    security: { ...defaults.security, ...(stored.security || {}) },
    notifications: {
      ...defaults.notifications,
      ...(stored.notifications || {})
    }
  };
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sb_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        twoFactorEnabled: true
      }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const storedSettings = (admin.metadata as Prisma.JsonObject | null)
      ?.profileSettings as ProfileSettings | undefined;

    const settings = mergeSettings(storedSettings);
    settings.personal.email = settings.personal.email || admin.email;
    settings.notifications.notificationEmail =
      settings.notifications.notificationEmail || admin.email;
    settings.security.enableTwoFactor = !!admin.twoFactorEnabled;

    return NextResponse.json({
      settings,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      },
      twoFactorEnabled: !!admin.twoFactorEnabled
    });
  } catch (error) {
    logger.error('Error fetching profile settings:', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('sb_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const existingAdmin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        twoFactorEnabled: true
      }
    });

    if (!existingAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const body = await request.json();
    const nextSettings = mergeSettings(body.settings);
    nextSettings.security.enableTwoFactor = !!existingAdmin.twoFactorEnabled;

    const metadata: Prisma.JsonObject = {
      ...(existingAdmin.metadata as Prisma.JsonObject | null),
      profileSettings: nextSettings
    };

    const updatedAdmin = await db.adminAccount.update({
      where: { id: payload.sub },
      data: {
        email: nextSettings.personal.email || existingAdmin.email,
        metadata
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logger.info('Profile settings updated', { adminId: payload.sub });

    return NextResponse.json({
      success: true,
      message: 'Настройки профиля обновлены',
      admin: updatedAdmin,
      settings: nextSettings
    });
  } catch (error) {
    logger.error('Error updating profile settings:', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
