import { NextResponse } from 'next/server';

import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectService } from '@/lib/services/project.service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ProjectService.verifyProjectAccess(id, admin.sub);
  const credentials = await db.project.findUnique({
    where: { id },
    select: {
      botToken: true,
      maxBotToken: true,
      webhookSecret: true
    }
  });
  if (!credentials) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  return NextResponse.json(credentials, {
    headers: { 'Cache-Control': 'private, no-store' }
  });
}
