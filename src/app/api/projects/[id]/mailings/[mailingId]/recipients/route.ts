/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/recipients/route.ts
 * @description: API для получения списка получателей рассылки с пагинацией и поиском
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import type { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; mailingId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, mailingId } = await context.params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const status = url.searchParams.get('status') || 'all';
    const search = url.searchParams.get('search')?.trim() || '';

    const where: Prisma.MailingRecipientWhereInput = {
      mailingId
    };

    if (status === 'sent') {
      where.status = 'SENT';
    } else if (status === 'failed') {
      where.status = 'FAILED';
    } else if (status === 'pending') {
      where.status = 'PENDING';
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { telegramId: { contains: search } },
        { error: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { telegramUsername: { contains: search, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    const [total, recipients] = await Promise.all([
      db.mailingRecipient.count({ where }),
      db.mailingRecipient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramUsername: true,
              phone: true,
              email: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      recipients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения получателей рассылки' },
      { status: 500 }
    );
  }
}
