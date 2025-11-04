/**
 * @file: src/app/api/super-admin/auth/login/route.ts
 * @description: Вход супер-администратора по паролю
 * @project: SaaS Bonus System
 * @dependencies: Next.js, JWT
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signJwt } from '@/lib/jwt';

const loginSchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!superAdminPassword) {
      return NextResponse.json(
        { error: 'Super admin password not configured' },
        { status: 500 }
      );
    }

    if (data.password !== superAdminPassword) {
      return NextResponse.json(
        { error: 'Неверный пароль' },
        { status: 401 }
      );
    }

    // Создаем JWT токен для супер-админа
    const token = await signJwt({
      sub: 'super-admin',
      email: 'super-admin@system',
      role: 'SUPERADMIN'
    }, 24); // 24 часа

    const response = NextResponse.json({ success: true });
    const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') || false;
    
    response.cookies.set('super_admin_auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 24 * 60 * 60 // 24 часа
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
