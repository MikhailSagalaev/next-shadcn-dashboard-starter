/**
 * @file: src/types/orders.ts
 * @description: Типы для системы заказов
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import type { OrderStatus, Order, OrderItem, OrderHistory, Product, ProductCategory } from '@prisma/client';

export type { OrderStatus, Order, OrderItem, OrderHistory, Product, ProductCategory };

export interface CreateOrderInput {
  projectId: string;
  userId?: string;
  orderNumber: string;
  status?: OrderStatus;
  totalAmount: number;
  paidAmount?: number;
  bonusAmount?: number;
  deliveryAddress?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  metadata?: Record<string, any>;
  items: CreateOrderItemInput[];
}

export interface CreateOrderItemInput {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  metadata?: Record<string, any>;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  totalAmount?: number;
  paidAmount?: number;
  bonusAmount?: number;
  deliveryAddress?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  metadata?: Record<string, any>;
}

export interface ChangeOrderStatusInput {
  status: OrderStatus;
  comment?: string;
  changedBy?: string;
  metadata?: Record<string, any>;
}

export interface OrderWithRelations extends Order {
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  items: OrderItemWithProduct[];
  history: OrderHistory[];
  project?: {
    id: string;
    name: string;
  };
}

export interface OrderItemWithProduct extends OrderItem {
  product?: Product | null;
}

export interface OrderFilters {
  projectId: string;
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'totalAmount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderListResponse {
  orders: OrderWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  price?: number;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface CreateProductCategoryInput {
  projectId: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateProductCategoryInput {
  name?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

