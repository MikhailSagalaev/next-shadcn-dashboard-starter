/**
 * @file: src/app/api/projects/[id]/products/route.ts
 * @description: API для управления товарами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { ProductService } from '@/lib/services/product.service';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
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

    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId') || undefined;
    const isActive =
      url.searchParams.get('isActive') === 'true' ? true : undefined;

    const products = await ProductService.getProducts(projectId, {
      categoryId,
      isActive
    });

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения товаров' },
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
    const data = createProductSchema.parse(body);

    const productPayload = {
      projectId,
      name: data.name,
      sku: data.sku,
      price: data.price,
      categoryId: data.categoryId,
      description: data.description,
      isActive: data.isActive ?? true
    };

    const product = await ProductService.createProduct(productPayload);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Ошибка создания товара' },
      { status: 500 }
    );
  }
}
