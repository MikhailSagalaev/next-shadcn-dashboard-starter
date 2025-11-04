/**
 * @file: src/app/api/super-admin/auth/logout/route.ts
 * @description: Выход супер-администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('super_admin_auth');
  return response;
}
