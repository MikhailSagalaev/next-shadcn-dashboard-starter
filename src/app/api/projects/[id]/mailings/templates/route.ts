/**
 * @file: src/app/api/projects/[id]/mailings/templates/route.ts
 * @description: API для управления шаблонами рассылок
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { MailingService } from '@/lib/services/mailing.service';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  type: z.enum(['EMAIL', 'SMS', 'TELEGRAM', 'WHATSAPP', 'VIBER']),
  isActive: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  type: z.enum(['EMAIL', 'SMS', 'TELEGRAM', 'WHATSAPP', 'VIBER']).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Получаем шаблоны через MailingService или напрямую из БД
    const templates = await MailingService.getTemplates(projectId);

    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения шаблонов' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const template = await MailingService.createTemplate({
      projectId,
      ...data,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Ошибка создания шаблона' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    const template = await MailingService.updateTemplate(
      projectId,
      data.id,
      {
        name: data.name,
        subject: data.subject,
        body: data.body,
        type: data.type,
        isActive: data.isActive,
      }
    );

    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Ошибка обновления шаблона' },
      { status: 500 }
    );
  }
}

