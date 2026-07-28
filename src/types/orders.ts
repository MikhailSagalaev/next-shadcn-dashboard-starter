/**
 * @file: src/types/orders.ts
 * @description: Типы для системы заказов
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import type {
  OrderStatus,
  OrderAccountingState,
  Order,
  OrderItem,
  OrderHistory,
  Product,
  ProductCategory,
  MarkedUnit,
  FiscalReceipt,
  ComplianceDocument,
  ComplianceOutbox
} from '@prisma/client';

export type {
  OrderStatus,
  OrderAccountingState,
  Order,
  OrderItem,
  OrderHistory,
  Product,
  ProductCategory
};

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
  metadata?: Record<string, unknown>;
  items: CreateOrderItemInput[];
}

export interface CreateOrderItemInput {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateOrderInput {
  totalAmount?: number;
  paidAmount?: number;
  bonusAmount?: number;
  deliveryAddress?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  metadata?: Record<string, unknown>;
}

export interface ChangeOrderStatusInput {
  status: OrderStatus;
  comment?: string;
  changedBy?: string;
}

export interface OrderWithRelations extends Order {
  accountingState: OrderAccountingState;
  reversalShortfall: Order['totalAmount'];
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  items: OrderItemWithProduct[];
  history: OrderHistory[];
  fiscalReceipts?: Array<
    Pick<
      FiscalReceipt,
      | 'id'
      | 'type'
      | 'status'
      | 'providerReceiptId'
      | 'lastError'
      | 'createdAt'
      | 'succeededAt'
    >
  >;
  complianceDocuments?: Array<
    Pick<
      ComplianceDocument,
      | 'id'
      | 'kind'
      | 'status'
      | 'documentNumber'
      | 'externalId'
      | 'lastError'
      | 'submittedAt'
      | 'succeededAt'
      | 'createdAt'
    > & {
      outboxEntries: Array<
        Pick<ComplianceOutbox, 'id' | 'status' | 'attemptCount' | 'lastError'>
      >;
    }
  >;
  project?: {
    id: string;
    name: string;
    complianceIntegration?: {
      provider: string;
      isActive: boolean;
      distanceSaleMode: string;
    } | null;
  };
}

export interface OrderItemWithProduct extends OrderItem {
  product?: Product | null;
  markedUnits?: Array<
    Pick<
      MarkedUnit,
      'id' | 'gtin' | 'serial' | 'status' | 'scannedBy' | 'scannedAt'
    >
  >;
}

export interface OrderFilters {
  projectId: string;
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  needsAttention?: boolean;
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
  summary?: {
    total: number;
    needsAttention: number;
    awaitingScanning: number;
    readyToShip: number;
  };
}

export interface CreateProductInput {
  projectId: string;
  name: string;
  sku?: string;
  price: number;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  price?: number;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateProductCategoryInput {
  projectId: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateProductCategoryInput {
  name?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}
