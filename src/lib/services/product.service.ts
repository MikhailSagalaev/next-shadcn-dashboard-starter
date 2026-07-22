/**
 * @file: src/lib/services/product.service.ts
 * @description: Сервис для управления товарами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Prisma, ProductMarkingStatus } from '@prisma/client';

export interface CreateProductInput {
  projectId: string;
  name: string;
  sku?: string;
  externalId?: string;
  gtin?: string;
  markingStatus?: ProductMarkingStatus;
  vatCode?: number;
  paymentSubject?: string;
  measure?: string;
  stockOnHand?: number;
  price: number;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export class ProductService {
  private static buildWhere(
    projectId: string,
    filters?: {
      categoryId?: string;
      isActive?: boolean;
      markingStatus?: ProductMarkingStatus;
      needsSetup?: boolean;
      search?: string;
    }
  ): Prisma.ProductWhereInput {
    const readinessFilter: Prisma.ProductWhereInput | undefined =
      filters?.needsSetup
        ? {
            OR: [
              { markingStatus: 'UNKNOWN' },
              { vatCode: null },
              { markingStatus: 'MARKED_REQUIRED', gtin: null }
            ]
          }
        : undefined;
    const searchFilter: Prisma.ProductWhereInput | undefined = filters?.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
            {
              externalId: {
                contains: filters.search,
                mode: 'insensitive'
              }
            },
            { gtin: { contains: filters.search } }
          ]
        }
      : undefined;

    return {
      projectId,
      categoryId: filters?.categoryId,
      isActive: filters?.isActive,
      markingStatus: filters?.markingStatus,
      AND: [readinessFilter, searchFilter].filter(
        (condition): condition is Prisma.ProductWhereInput => Boolean(condition)
      )
    };
  }

  static async createProduct(data: CreateProductInput) {
    try {
      const product = await db.product.create({ data });
      logger.info('Товар создан', {
        productId: product.id,
        projectId: data.projectId
      });
      return product;
    } catch (error) {
      logger.error('Ошибка создания товара', { error, data });
      throw error;
    }
  }

  static async getProducts(
    projectId: string,
    filters?: {
      categoryId?: string;
      isActive?: boolean;
      markingStatus?: ProductMarkingStatus;
      search?: string;
    }
  ) {
    try {
      return await db.product.findMany({
        where: this.buildWhere(projectId, filters),
        include: { category: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Ошибка получения товаров', { error, projectId });
      throw error;
    }
  }

  static async getProductsPage(
    projectId: string,
    options: {
      page: number;
      pageSize: number;
      categoryId?: string;
      isActive?: boolean;
      markingStatus?: ProductMarkingStatus;
      needsSetup?: boolean;
      search?: string;
    }
  ) {
    const { page, pageSize, ...filters } = options;
    const where = this.buildWhere(projectId, filters);
    const needsSetupWhere = this.buildWhere(projectId, { needsSetup: true });

    try {
      const [products, total, catalogTotal, needsSetup, stock] =
        await db.$transaction([
          db.product.findMany({
            where,
            include: { category: true },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize
          }),
          db.product.count({ where }),
          db.product.count({ where: { projectId } }),
          db.product.count({ where: needsSetupWhere }),
          db.product.aggregate({
            where: { projectId },
            _sum: { stockOnHand: true, stockReserved: true }
          })
        ]);

      return {
        products,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        },
        summary: {
          total: catalogTotal,
          needsSetup,
          availableUnits: Math.max(
            0,
            (stock._sum.stockOnHand ?? 0) - (stock._sum.stockReserved ?? 0)
          )
        }
      };
    } catch (error) {
      logger.error('Ошибка постраничной загрузки товаров', {
        error,
        projectId,
        page,
        pageSize
      });
      throw error;
    }
  }

  static async setStock(params: {
    projectId: string;
    productId: string;
    quantity: number;
    reason?: string;
    createdBy?: string;
  }) {
    const { projectId, productId, quantity, reason, createdBy } = params;
    return db.$transaction(async (tx) => {
      const current = await tx.product.findFirstOrThrow({
        where: { id: productId, projectId }
      });
      const delta = quantity - current.stockOnHand;
      const product = await tx.product.update({
        where: { id: productId },
        data: { stockOnHand: quantity }
      });
      if (delta !== 0) {
        await tx.inventoryMovement.create({
          data: {
            projectId,
            productId,
            type: 'ADJUSTMENT',
            quantity: delta,
            balanceAfter: quantity,
            reason,
            createdBy
          }
        });
      }
      return product;
    });
  }

  static async importCatalog(
    projectId: string,
    rows: Array<
      Omit<CreateProductInput, 'projectId' | 'price' | 'name'> & {
        name: string;
        price: number;
      }
    >,
    createdBy?: string
  ) {
    const result = { created: 0, updated: 0, errors: [] as string[] };

    for (const [index, row] of rows.entries()) {
      try {
        const existing = await db.product.findFirst({
          where: {
            projectId,
            OR: [
              ...(row.externalId ? [{ externalId: row.externalId }] : []),
              ...(row.sku ? [{ sku: row.sku }] : [])
            ]
          }
        });
        const stockOnHand = row.stockOnHand;
        const data = {
          name: row.name,
          sku: row.sku,
          externalId: row.externalId,
          gtin: row.gtin,
          markingStatus: row.markingStatus ?? 'UNKNOWN',
          vatCode: row.vatCode,
          paymentSubject: row.paymentSubject,
          measure: row.measure ?? 'piece',
          price: row.price,
          description: row.description,
          isActive: row.isActive ?? true
        } as const;

        if (existing) {
          await db.product.update({ where: { id: existing.id }, data });
          if (typeof stockOnHand === 'number') {
            await this.setStock({
              projectId,
              productId: existing.id,
              quantity: stockOnHand,
              reason: 'Импорт каталога',
              createdBy
            });
          }
          result.updated += 1;
        } else {
          const product = await db.product.create({
            data: { projectId, ...data, stockOnHand: stockOnHand ?? 0 }
          });
          if ((stockOnHand ?? 0) !== 0) {
            await db.inventoryMovement.create({
              data: {
                projectId,
                productId: product.id,
                type: 'RECEIPT',
                quantity: stockOnHand ?? 0,
                balanceAfter: stockOnHand ?? 0,
                reason: 'Начальный остаток из импорта',
                createdBy
              }
            });
          }
          result.created += 1;
        }
      } catch (error) {
        result.errors.push(
          `Строка ${index + 2}: ${error instanceof Error ? error.message : 'ошибка импорта'}`
        );
      }
    }
    return result;
  }

  static async updateProduct(
    projectId: string,
    productId: string,
    data: Partial<CreateProductInput>
  ) {
    try {
      const product = await db.product.update({
        where: { id: productId, projectId },
        data
      });
      return product;
    } catch (error) {
      logger.error('Ошибка обновления товара', { error, productId });
      throw error;
    }
  }

  static async deleteProduct(projectId: string, productId: string) {
    try {
      await db.product.delete({ where: { id: productId, projectId } });
    } catch (error) {
      logger.error('Ошибка удаления товара', { error, productId });
      throw error;
    }
  }
}
