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
import { ProductMarkingStatus } from '@prisma/client';

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  externalId: z.string().optional(),
  gtin: z
    .string()
    .regex(/^\d{8,14}$/)
    .transform((value) => value.padStart(14, '0'))
    .optional(),
  markingStatus: z.nativeEnum(ProductMarkingStatus).optional(),
  vatCode: z.number().int().min(1).max(12).optional(),
  paymentSubject: z.string().max(64).optional(),
  measure: z.string().max(32).optional(),
  stockOnHand: z.number().int().min(0).optional(),
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
    const markingParam = url.searchParams.get('markingStatus');
    const needsSetup = markingParam === 'NEEDS_SETUP';
    const markingStatus =
      markingParam && !needsSetup
        ? ProductMarkingStatus[
            markingParam as keyof typeof ProductMarkingStatus
          ]
        : undefined;
    const search = url.searchParams.get('search') || undefined;

    const pageParam = url.searchParams.get('page');
    const pageSizeParam = url.searchParams.get('pageSize');
    if (pageParam || pageSizeParam) {
      const page = Math.max(1, Math.floor(Number(pageParam) || 1));
      const pageSize = Math.min(
        100,
        Math.max(1, Math.floor(Number(pageSizeParam) || 25))
      );
      const result = await ProductService.getProductsPage(projectId, {
        page,
        pageSize,
        categoryId,
        isActive,
        markingStatus,
        needsSetup,
        search
      });
      return NextResponse.json(result);
    }

    const products = await ProductService.getProducts(projectId, {
      categoryId,
      isActive,
      markingStatus,
      search
    });

    return NextResponse.json({ products });
  } catch {
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
      externalId: data.externalId,
      gtin: data.gtin,
      markingStatus: data.markingStatus,
      vatCode: data.vatCode,
      paymentSubject: data.paymentSubject,
      measure: data.measure,
      stockOnHand: data.stockOnHand,
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
