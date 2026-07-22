import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  encryptIntegrationSecret,
  IntegrationCredentialConfigurationError
} from '@/lib/integrations/credential-encryption';
import { logger } from '@/lib/logger';

const settingsSchema = z.object({
  shopId: z.string().trim().min(1, 'Укажите shopId'),
  secretKey: z.string().trim().min(1, 'Укажите секретный ключ').optional(),
  receiptTimezone: z.number().int().min(1).max(11).default(2),
  deliveryVatCode: z.number().int().min(1).max(12).nullable().optional(),
  isActive: z.boolean().optional()
});

async function ownsProject(projectId: string, ownerId: string) {
  return db.project.findFirst({
    where: { id: projectId, ownerId },
    select: { id: true }
  });
}

function safeIntegration(integration: {
  secretKeyEncrypted: string;
  [key: string]: unknown;
}) {
  const { secretKeyEncrypted, ...safe } = integration;
  return { ...safe, hasSecretKey: Boolean(secretKeyEncrypted) };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await ownsProject(projectId, admin.sub)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const integration = await db.yooKassaFiscalIntegration.findUnique({
    where: { projectId }
  });
  return NextResponse.json({
    integration: integration ? safeIntegration(integration) : null
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: projectId } = await params;
    if (!(await ownsProject(projectId, admin.sub)))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Проверьте настройки', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.yooKassaFiscalIntegration.findUnique({
      where: { projectId }
    });
    if (!existing && !parsed.data.secretKey) {
      return NextResponse.json(
        { error: 'Для первого подключения нужен секретный ключ' },
        { status: 400 }
      );
    }

    const credentialsChanged =
      !existing ||
      existing.shopId !== parsed.data.shopId ||
      Boolean(parsed.data.secretKey);
    if (
      parsed.data.isActive === true &&
      (credentialsChanged || !existing?.lastTestedAt)
    ) {
      return NextResponse.json(
        { error: 'Сначала сохраните настройки и проверьте подключение' },
        { status: 400 }
      );
    }

    const common = {
      shopId: parsed.data.shopId,
      receiptTimezone: parsed.data.receiptTimezone,
      deliveryVatCode: parsed.data.deliveryVatCode ?? null
    };
    const integration = existing
      ? await db.yooKassaFiscalIntegration.update({
          where: { projectId },
          data: {
            ...common,
            ...(parsed.data.secretKey
              ? {
                  secretKeyEncrypted: encryptIntegrationSecret(
                    parsed.data.secretKey
                  )
                }
              : {}),
            ...(credentialsChanged
              ? { isActive: false, lastTestedAt: null, lastError: null }
              : parsed.data.isActive === undefined
                ? {}
                : { isActive: parsed.data.isActive })
          }
        })
      : await db.yooKassaFiscalIntegration.create({
          data: {
            projectId,
            ...common,
            secretKeyEncrypted: encryptIntegrationSecret(
              parsed.data.secretKey as string
            ),
            isActive: false
          }
        });

    return NextResponse.json({ integration: safeIntegration(integration) });
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack
          }
        : { errorMessage: String(error) };
    logger.error(
      'Failed to save YooKassa fiscal integration',
      errorDetails,
      'yookassa-fiscal-api'
    );
    if (error instanceof IntegrationCredentialConfigurationError) {
      return NextResponse.json(
        {
          error:
            'На сервере не настроен технический ключ шифрования интеграций. Обратитесь к администратору Gupil.'
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Не удалось сохранить настройки' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await ownsProject(projectId, admin.sub)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.yooKassaFiscalIntegration.deleteMany({ where: { projectId } });
  return NextResponse.json({ success: true });
}
