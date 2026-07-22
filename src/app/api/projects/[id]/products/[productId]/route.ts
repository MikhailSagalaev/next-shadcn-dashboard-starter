/**
 * @file: src/app/api/projects/[id]/products/[productId]/route.ts
 * @description: API для получения, обновления и удаления конкретного товара
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { ProductService } from '@/lib/services/product.service';
import { z } from 'zod';
import { ProductMarkingStatus } from '@prisma/client';

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  externalId: z.string().nullable().optional(),
  gtin: z
    .string()
    .regex(/^\d{8,14}$/)
    .transform((value) => value.padStart(14, '0'))
    .nullable()
    .optional(),
  markingStatus: z.nativeEnum(ProductMarkingStatus).optional(),
  vatCode: z.number().int().min(1).max(12).nullable().optional(),
  paymentSubject: z.string().max(64).nullable().optional(),
  measure: z.string().max(32).optional(),
  stockOnHand: z.number().int().min(0).optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, productId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const products = await ProductService.getProducts(projectId);
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch {
    return NextResponse.json(
      { error: 'Ошибка получения товара' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, productId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const data = updateProductSchema.parse(body);

    const { stockOnHand, ...productData } = data;
    let product = await ProductService.updateProduct(
      projectId,
      productId,
      productData
    );
    if (typeof stockOnHand === 'number') {
      product = await ProductService.setStock({
        projectId,
        productId,
        quantity: stockOnHand,
        reason: 'Ручная корректировка каталога',
        createdBy: admin.sub
      });
    }

    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Ошибка обновления товара' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, productId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    await ProductService.deleteProduct(projectId, productId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Ошибка удаления товара' },
      { status: 500 }
    );
  }
}
