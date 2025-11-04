/**
 * @file: src/app/api/super-admin/auth/verify/route.ts
 * @description: Проверка валидности сессии супер-администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, JWT
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('super_admin_auth')?.value;
  
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const payload = await verifyJwt(token);
  
  if (!payload || payload.role !== 'SUPERADMIN') {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ 
    valid: true,
    role: payload.role
  });
}
