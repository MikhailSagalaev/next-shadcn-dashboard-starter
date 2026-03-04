/**
 * @file: types.ts
 * @description: TypeScript типы для InSales API интеграции
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

// ============================================================================
// InSales API Types
// ============================================================================

export interface InSalesClient {
  id: number;
  email: string;
  phone?: string;
  name?: string;
  surname?: string;
  middlename?: string;
  created_at: string;
  updated_at: string;
  fields_values?: Record<string, any>;
}

export interface InSalesOrderItem {
  id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  price: string;
  full_sale_price: string;
  total_price: string;
  title: string;
  sku?: string;
}

export interface InSalesOrder {
  id: number;
  number: string;
  client: InSalesClient;
  items: InSalesOrderItem[];
  total_price: string;
  items_price: string;
  delivery_price: string;
  payment_status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  fulfillment_status: 'new' | 'accepted' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  custom_status?: {
    permalink: string;
    title: string;
  };
  fields_values?: Record<string, any>;
}

// ============================================================================
// Webhook Event Types
// ============================================================================

export type InSalesWebhookEvent =
  | 'orders/create'
  | 'orders/update'
  | 'orders/delete'
  | 'clients/create'
  | 'clients/update'
  | 'clients/delete';

export interface InSalesWebhookPayload {
  event: InSalesWebhookEvent;
  order?: InSalesOrder;
  client?: InSalesClient;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetBalanceRequest {
  email?: string;
  phone?: string;
}

export interface GetBalanceResponse {
  success: boolean;
  balance: number;
  currency: string;
  user?: {
    id: string;
    email?: string;
    phone?: string;
    level: string;
  };
  error?: string;
}

export interface ApplyBonusesRequest {
  email?: string;
  phone?: string;
  bonusAmount: number;
  orderId: string;
  orderTotal: number;
}

export interface ApplyBonusesResponse {
  success: boolean;
  applied: number;
  newBalance: number;
  discount: number;
  error?: string;
}

export interface WidgetSettingsResponse {
  success: boolean;
  settings: {
    projectId: string;
    bonusPercent: number;
    maxBonusSpend: number;
    widgetEnabled: boolean;
    showProductBadges: boolean;
    currency: string;
  };
  error?: string;
}

// ============================================================================
// Integration Settings Types
// ============================================================================

export interface InSalesIntegrationSettings {
  apiKey: string;
  apiPassword: string;
  shopDomain: string;
  webhookSecret: string;
  bonusPercent: number;
  maxBonusSpend: number;
  widgetEnabled: boolean;
  showProductBadges: boolean;
  isActive: boolean;
}

export interface CreateInSalesIntegrationRequest {
  apiKey: string;
  apiPassword: string;
  shopDomain: string;
  bonusPercent?: number;
  maxBonusSpend?: number;
}

export interface UpdateInSalesIntegrationRequest {
  apiKey?: string;
  apiPassword?: string;
  shopDomain?: string;
  bonusPercent?: number;
  maxBonusSpend?: number;
  widgetEnabled?: boolean;
  showProductBadges?: boolean;
  isActive?: boolean;
}

// ============================================================================
// Service Types
// ============================================================================

export interface ProcessOrderResult {
  success: boolean;
  userId?: string;
  orderId?: string;
  bonusAwarded?: number;
  bonusSpent?: number;
  error?: string;
}

export interface ProcessClientResult {
  success: boolean;
  userId?: string;
  welcomeBonusAwarded?: number;
  error?: string;
}

// ============================================================================
// InSales API Client Types
// ============================================================================

export interface InSalesApiClientConfig {
  apiKey: string;
  apiPassword: string;
  shopDomain: string;
}

export interface InSalesApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
