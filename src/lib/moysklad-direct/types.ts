/**
 * @file: types.ts
 * @description: TypeScript типы для прямой интеграции с МойСклад через Bonus Transaction API
 * @project: SaaS Bonus System
 * @dependencies: МойСклад JSON API 1.2
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

// ============================================================================
// МойСклад API Types
// ============================================================================

export interface MoySkladConfig {
  accountId: string;
  apiToken: string; // Encrypted
  bonusProgramId: string;
}

export interface MoySkladMeta {
  href: string;
  type: string;
  mediaType?: string;
}

export interface MoySkladCounterparty {
  id: string;
  meta: MoySkladMeta;
  name: string;
  phone?: string;
  email?: string;
  bonusPoints?: number;
}

export interface MoySkladBonusTransaction {
  id: string;
  meta: MoySkladMeta;
  bonusProgram: {
    meta: MoySkladMeta;
  };
  agent: {
    meta: MoySkladMeta;
  };
  bonusValue: number;
  transactionType: 'EARNING' | 'SPENDING';
  transactionStatus: 'WAIT_PROCESSING' | 'COMPLETED' | 'CANCELED';
  moment: string; // ISO datetime
  description?: string;
}

export interface CreateBonusTransactionRequest {
  bonusProgram: {
    meta: MoySkladMeta;
  };
  agent: {
    meta: MoySkladMeta;
  };
  bonusValue: number;
  transactionType: 'EARNING' | 'SPENDING';
  transactionStatus: 'COMPLETED';
  moment: string;
  description?: string;
}

export interface MoySkladApiError {
  errors: Array<{
    error: string;
    code: number;
    moreInfo?: string;
  }>;
}

// ============================================================================
// Sync Service Types
// ============================================================================

export interface SyncBonusAccrualParams {
  userId: string;
  amount: number;
  source: string;
}

export interface SyncBonusSpendingParams {
  userId: string;
  amount: number;
  source: string;
}

export interface BalanceCheckResult {
  ourBalance: number;
  moySkladBalance: number | null;
  synced: boolean;
  error?: string;
}

export interface SyncFromMoySkladParams {
  integrationId: string;
  bonusTransaction: MoySkladBonusTransaction;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface MoySkladWebhookPayload {
  auditContext: {
    meta: MoySkladMeta;
    uid: string;
    moment: string;
  };
  events: Array<{
    meta: MoySkladMeta;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    accountId: string;
  }>;
}

// ============================================================================
// Client Types
// ============================================================================

export interface MoySkladClientConfig {
  accountId: string;
  apiToken: string;
  bonusProgramId: string;
}

export interface AccrueBonusParams {
  counterpartyId: string;
  amount: number;
  comment: string;
}

export interface SpendBonusParams {
  counterpartyId: string;
  amount: number;
  comment: string;
}

export interface FindCounterpartyParams {
  phone: string;
}

export interface GetBalanceParams {
  counterpartyId: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class MoySkladApiException extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'MoySkladApiException';
  }
}

export class MoySkladSyncException extends Error {
  constructor(
    message: string,
    public operation: string,
    public userId?: string
  ) {
    super(message);
    this.name = 'MoySkladSyncException';
  }
}

// ============================================================================
// Integration Settings Types
// ============================================================================

export interface MoySkladDirectIntegrationSettings {
  accountId: string;
  apiToken: string;
  bonusProgramId: string;
  syncDirection: 'MOYSKLAD_TO_US' | 'US_TO_MOYSKLAD' | 'BIDIRECTIONAL';
  autoSync: boolean;
  webhookSecret?: string;
  isActive: boolean;
}

export interface UpdateIntegrationSettingsParams {
  accountId?: string;
  apiToken?: string;
  bonusProgramId?: string;
  syncDirection?: 'MOYSKLAD_TO_US' | 'US_TO_MOYSKLAD' | 'BIDIRECTIONAL';
  autoSync?: boolean;
  isActive?: boolean;
}

// ============================================================================
// Sync Log Types
// ============================================================================

export interface SyncLogEntry {
  operation: 'bonus_accrual' | 'bonus_spending' | 'balance_sync';
  direction: 'incoming' | 'outgoing';
  moySkladTransactionId?: string;
  userId?: string;
  amount?: number;
  requestData?: any;
  responseData?: any;
  status: 'success' | 'error' | 'pending';
  errorMessage?: string;
}

export interface SyncLogFilters {
  operation?: string;
  direction?: string;
  status?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface IntegrationStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  lastSyncAt: Date | null;
  totalBonusAccrued: number;
  totalBonusSpent: number;
  syncsByOperation: Record<string, number>;
  syncsByDirection: Record<string, number>;
}
