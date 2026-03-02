/**
 * @file: types.ts
 * @description: TypeScript types for МойСклад API entities
 * @project: SaaS Bonus System
 * @dependencies: None
 * @created: 2026-03-01
 * @author: AI Assistant + User
 */

// МойСклад API Configuration
export interface MoySkladClientConfig {
  accountId: string;
  apiToken: string;
  bonusProgramId: string;
  baseUrl?: string; // Default: https://api.moysklad.ru/api/remap/1.0
  timeout?: number; // Default: 30000ms
}

// МойСклад Meta Object (common structure)
export interface MoySkladMeta {
  href: string;
  type: string;
  mediaType?: string;
}

// Counterparty (Контрагент)
export interface Counterparty {
  id: string;
  meta: MoySkladMeta;
  name: string;
  phone?: string;
  email?: string;
  bonusPoints?: number;
  description?: string;
  externalCode?: string;
}

// Bonus Transaction Types
export type TransactionType = 'EARNING' | 'SPENDING';
export type TransactionStatus = 'COMPLETED' | 'WAIT_PROCESSING';

// Bonus Transaction
export interface BonusTransaction {
  id: string;
  meta: MoySkladMeta;
  agent: {
    meta: MoySkladMeta;
  };
  bonusValue: number;
  transactionType: TransactionType;
  transactionStatus: TransactionStatus;
  moment: Date; // ISO 8601 timestamp converted to Date
  comment?: string;
  bonusProgram?: {
    meta: MoySkladMeta;
  };
}

// Webhook Payload
export interface WebhookPayload {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  events: WebhookEvent[];
}

export interface WebhookEvent {
  meta: MoySkladMeta;
  action: string;
  accountId: string;
}

// API Request Parameters
export interface AccrueBonusParams {
  counterpartyId: string;
  amount: number;
  comment: string;
  timestamp?: Date;
}

export interface SpendBonusParams {
  counterpartyId: string;
  amount: number;
  comment: string;
  timestamp?: Date;
}

// API Error
export class MoySkladApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'MoySkladApiError';
    Object.setPrototypeOf(this, MoySkladApiError.prototype);
  }
}

// Sync Service Types
export interface BalanceVerificationResult {
  bonusSystemBalance: number;
  moySkladBalance: number;
  isMatch: boolean;
  difference: number;
  lastBonusSystemTransaction?: Date;
  lastMoySkladTransaction?: Date;
}

export interface SyncResult {
  success: boolean;
  userId: string;
  operation: string;
  error?: string;
}

export interface BulkSyncResult {
  totalUsers: number;
  successCount: number;
  errorCount: number;
  conflictsResolved: number;
  errors: Array<{ userId: string; error: string }>;
}

// Raw JSON types for parsing
export interface RawBonusTransaction {
  id: string;
  meta: {
    href: string;
    type: string;
  };
  agent: {
    meta: {
      href: string;
      type: string;
    };
  };
  bonusValue: number;
  transactionType: string;
  transactionStatus: string;
  moment: string; // ISO 8601 string
  comment?: string;
  bonusProgram?: {
    meta: {
      href: string;
      type: string;
    };
  };
}

export interface RawCounterparty {
  id: string;
  meta: {
    href: string;
    type: string;
  };
  name: string;
  phone?: string;
  email?: string;
  bonusPoints?: number;
  description?: string;
  externalCode?: string;
}
