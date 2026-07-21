import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { parseCatalogCsv } from '@/lib/catalog/catalog-csv';
import { ProductService } from '@/lib/services/product.service';
import { ProjectService } from '@/lib/services/project.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const csv = await request.text();
    if (Buffer.byteLength(csv, 'utf8') > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Файл больше 5 МБ' }, { status: 413 });
    }
    const rows = parseCatalogCsv(csv);
    if (rows.length > 10_000) {
      return NextResponse.json(
        { error: 'Не более 10 000 строк за импорт' },
        { status: 400 }
      );
    }
    const result = await ProductService.importCatalog(
      projectId,
      rows,
      admin.sub
    );
    return NextResponse.json(result, {
      status: result.errors.length ? 207 : 200
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Ошибка импорта каталога'
      },
      { status: 400 }
    );
  }
}
