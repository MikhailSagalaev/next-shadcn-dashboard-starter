/**
 * @file: src/lib/services/product.service.ts
 * @description: Сервис для управления товарами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface CreateProductInput {
  projectId: string;
  name: string;
  sku?: string;
  price: number;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export class ProductService {
  static async createProduct(data: CreateProductInput) {
    try {
      const product = await db.product.create({ data });
      logger.info('Товар создан', { productId: product.id, projectId: data.projectId });
      return product;
    } catch (error) {
      logger.error('Ошибка создания товара', { error, data });
      throw error;
    }
  }

  static async getProducts(projectId: string, filters?: { categoryId?: string; isActive?: boolean }) {
    try {
      return await db.product.findMany({
        where: { projectId, ...filters },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Ошибка получения товаров', { error, projectId });
      throw error;
    }
  }

  static async updateProduct(projectId: string, productId: string, data: Partial<CreateProductInput>) {
    try {
      const product = await db.product.update({
        where: { id: productId, projectId },
        data,
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

