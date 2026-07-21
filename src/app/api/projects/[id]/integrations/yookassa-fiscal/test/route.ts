import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptIntegrationSecret } from '@/lib/integrations/credential-encryption';
import { listYooKassaReceipts } from '@/lib/yookassa/client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: admin.sub },
    select: { id: true }
  });
  if (!project)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const integration = await db.yooKassaFiscalIntegration.findUnique({
    where: { projectId }
  });
  if (!integration) {
    return NextResponse.json(
      { error: 'Сначала сохраните настройки' },
      { status: 404 }
    );
  }

  try {
    const result = await listYooKassaReceipts(
      {
        shopId: integration.shopId,
        secretKey: decryptIntegrationSecret(integration.secretKeyEncrypted)
      },
      { limit: '1' }
    );
    if ('status' in result) {
      await db.yooKassaFiscalIntegration.update({
        where: { projectId },
        data: {
          isActive: false,
          lastError: `ЮKassa вернула HTTP ${result.status}`
        }
      });
      return NextResponse.json(
        { error: 'ЮKassa отклонила shopId или секретный ключ' },
        { status: 400 }
      );
    }

    await db.yooKassaFiscalIntegration.update({
      where: { projectId },
      data: { lastTestedAt: new Date(), lastError: null }
    });
    return NextResponse.json({ success: true });
  } catch {
    await db.yooKassaFiscalIntegration.update({
      where: { projectId },
      data: { isActive: false, lastError: 'Ошибка соединения с ЮKassa' }
    });
    return NextResponse.json(
      { error: 'Не удалось проверить подключение к ЮKassa' },
      { status: 502 }
    );
  }
}
