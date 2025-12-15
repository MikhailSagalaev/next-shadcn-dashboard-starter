/**
 * @file: middleware.ts
 * @description: Пустой middleware для документации
 * @project: SaaS Bonus System - Documentation
 * @dependencies: Next.js
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import { NextResponse } from 'next/server'

export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: []
}
