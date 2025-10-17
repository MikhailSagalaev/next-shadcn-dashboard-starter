/**
 * @file: src/app/api/workflow/database-queries/route.ts
 * @description: API endpoint для получения доступных database queries
 * @project: SaaS Bonus System
 * @dependencies: QueryExecutor
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextResponse } from 'next/server';
import { QueryExecutor } from '@/lib/services/workflow/query-executor';

export async function GET() {
  try {
    const availableQueries = QueryExecutor.getAvailableQueries();
    
    // Описания запросов для UI
    const queryDescriptions: Record<string, { description: string; parameters: string[] }> = {
      'check_user_by_telegram': {
        description: 'Проверить пользователя по Telegram ID, телефону или email',
        parameters: ['telegramId', 'phone', 'email', 'projectId']
      },
      'create_user': {
        description: 'Создать нового пользователя',
        parameters: ['telegramId', 'username', 'firstName', 'lastName', 'phone', 'email', 'projectId']
      },
      'add_bonus': {
        description: 'Начислить бонусы пользователю',
        parameters: ['userId', 'amount', 'type', 'description', 'expiresAt']
      },
      'spend_bonus': {
        description: 'Списать бонусы у пользователя',
        parameters: ['userId', 'amount', 'description']
      },
      'get_user_balance': {
        description: 'Получить баланс бонусов пользователя',
        parameters: ['userId']
      },
      'update_user': {
        description: 'Обновить данные пользователя',
        parameters: ['userId', 'data: {phone, email, firstName, lastName}']
      }
    };

    const queriesWithInfo = availableQueries.map(query => ({
      id: query,
      name: query,
      description: queryDescriptions[query]?.description || 'Описание недоступно',
      parameters: queryDescriptions[query]?.parameters || []
    }));

    return NextResponse.json({ queries: queriesWithInfo });
  } catch (error) {
    console.error('Error fetching database queries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database queries' },
      { status: 500 }
    );
  }
}
