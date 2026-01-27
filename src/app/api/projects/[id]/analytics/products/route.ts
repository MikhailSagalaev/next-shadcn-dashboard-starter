/**
 * @file: route.ts
 * @description: API endpoint для аналитики товаров
 * @project: SaaS Bonus System
 * @created: 2026-01-27
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, ownerId: admin.sub }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '30d';

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get products with sales data
    const products = await db.product.findMany({
      where: { projectId },
      include: {
        items: {
          where: {
            order: {
              createdAt: { gte: startDate }
            }
          },
          include: {
            order: {
              select: {
                createdAt: true,
                status: true
              }
            }
          }
        },
        category: true
      }
    });

    // Calculate product statistics
    const productsWithStats = products.map((product) => {
      const totalQuantity = product.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      const totalRevenue = product.items.reduce(
        (sum, item) => sum + Number(item.total),
        0
      );
      const ordersCount = new Set(product.items.map((i) => i.orderId)).size;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.price),
        category: product.category?.name,
        isActive: product.isActive,
        metadata: product.metadata, // Include metadata with images
        stats: {
          totalQuantity,
          totalRevenue,
          ordersCount,
          averagePrice: ordersCount > 0 ? totalRevenue / totalQuantity : 0
        },
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    // Sort by revenue
    productsWithStats.sort(
      (a, b) => b.stats.totalRevenue - a.stats.totalRevenue
    );

    // Category statistics
    const categoryStats = await db.$queryRaw<
      Array<{ category_id: string; name: string; count: bigint; total: number }>
    >`
      SELECT 
        pc.id as category_id,
        pc.name,
        COUNT(DISTINCT oi.order_id)::bigint as count,
        SUM(oi.total)::numeric as total
      FROM product_categories pc
      INNER JOIN products p ON p.category_id = pc.id
      INNER JOIN order_items oi ON oi.product_id = p.id
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE pc.project_id = ${projectId}
        AND o.created_at >= ${startDate}
      GROUP BY pc.id, pc.name
      ORDER BY total DESC
    `;

    return NextResponse.json({
      period,
      products: productsWithStats,
      categories: categoryStats.map((c) => ({
        categoryId: c.category_id,
        name: c.name,
        ordersCount: Number(c.count),
        totalRevenue: Number(c.total)
      })),
      summary: {
        totalProducts: products.length,
        activeProducts: products.filter((p) => p.isActive).length,
        productsWithSales: productsWithStats.filter(
          (p) => p.stats.ordersCount > 0
        ).length
      }
    });
  } catch (error) {
    console.error('Products analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
