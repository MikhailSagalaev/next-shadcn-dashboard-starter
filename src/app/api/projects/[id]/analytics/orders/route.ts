/**
 * @file: route.ts
 * @description: API endpoint для аналитики заказов
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
    const period = url.searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y

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

    // Get orders statistics
    const [orders, totalStats, topProducts] = await Promise.all([
      // Recent orders
      db.order.findMany({
        where: {
          projectId,
          createdAt: { gte: startDate }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),

      // Total statistics
      db.order.aggregate({
        where: {
          projectId,
          createdAt: { gte: startDate }
        },
        _count: { id: true },
        _sum: {
          totalAmount: true,
          bonusAmount: true,
          paidAmount: true
        },
        _avg: {
          totalAmount: true
        }
      }),

      // Top products
      db.orderItem.groupBy({
        by: ['productId', 'name'],
        where: {
          order: {
            projectId,
            createdAt: { gte: startDate }
          }
        },
        _sum: {
          quantity: true,
          total: true
        },
        _count: {
          id: true
        },
        orderBy: {
          _sum: {
            total: 'desc'
          }
        },
        take: 10
      })
    ]);

    // Orders by day
    const ordersByDay = await db.$queryRaw<
      Array<{ date: Date; count: bigint; total: number }>
    >`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::bigint as count,
        SUM(total_amount)::numeric as total
      FROM orders
      WHERE project_id = ${projectId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return NextResponse.json({
      period,
      stats: {
        totalOrders: totalStats._count.id,
        totalRevenue: Number(totalStats._sum.totalAmount || 0),
        totalBonusUsed: Number(totalStats._sum.bonusAmount || 0),
        averageOrderValue: Number(totalStats._avg.totalAmount || 0)
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        bonusAmount: Number(order.bonusAmount),
        paidAmount: Number(order.paidAmount),
        itemsCount: order.items.length,
        user: order.user,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: Number(item.price),
          total: Number(item.total),
          product: item.product
        }))
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: p.name,
        ordersCount: p._count.id,
        totalQuantity: Number(p._sum.quantity || 0),
        totalRevenue: Number(p._sum.total || 0)
      })),
      ordersByDay: ordersByDay.map((d) => ({
        date: d.date,
        count: Number(d.count),
        total: Number(d.total)
      }))
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
