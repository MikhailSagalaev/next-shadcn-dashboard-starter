/**
 * @file: types.ts
 * @description: TypeScript типы для МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Архитектура: МЫ являемся API provider, МойСклад вызывает НАШИ endpoints
 */

// ============================================================================
// Common Types
// ============================================================================

export interface Meta {
  id: string;
  href?: string;
  type?: string;
}

export interface Agent {
  meta: Meta;
  name?: string;
  phone?: string;
  email?: string;
  cardNumber?: string;
}

export interface Position {
  id?: string;
  quantity: number;
  price: number;
  discount?: number;
  assortment?: {
    meta: Meta;
    name: string;
  };
}

export type TransactionType = 'EARNING' | 'SPENDING';

// ============================================================================
// Request Types
// ============================================================================

// POST /counterparty - Create customer
export interface CreateCounterpartyRequest {
  name: string;
  phone?: string;
  email?: string;
  cardNumber?: string;
}

// GET /counterparty - Search customer
export interface SearchCounterpartyRequest {
  search: string; // phone or card number
  retailStoreId?: string;
}

// POST /counterparty/detail - Get balance
export interface GetBalanceRequest {
  meta: Meta; // Counterparty ID
}

// POST /counterparty/verify - Request verification code
export interface RequestVerificationCodeRequest {
  meta: Meta; // Counterparty ID
  operationType: 'SPENDING';
}

// POST /retaildemand/recalc - Calculate discounts
export interface RecalcRequest {
  agent: Agent;
  positions: Position[];
  transactionType: TransactionType;
  bonusProgram?: {
    spentBonus?: number; // Сколько бонусов хочет потратить клиент
  };
}

// POST /retaildemand/verify - Verify spending
export interface VerifySpendingRequest {
  meta: Meta; // Counterparty ID
  bonusAmount: number;
  verificationCode: string;
}

// POST /retaildemand - Create sale
export interface CreateSaleRequest {
  agent: Agent;
  positions: Position[];
  sum: number; // Итоговая сумма продажи
  transactionType: TransactionType;
  bonusProgram?: {
    earnedBonus?: number;
    spentBonus?: number;
  };
  meta?: Meta; // ID продажи в МойСклад
}

// POST /retailsalesreturn - Create return
export interface CreateReturnRequest {
  agent: Agent;
  positions: Position[];
  sum: number;
  demand?: {
    meta: Meta; // Ссылка на оригинальную продажу
  };
}

// GET /giftcard - Search gift card
export interface SearchGiftCardRequest {
  name: string; // Gift card code
}

// ============================================================================
// Response Types
// ============================================================================

// POST /counterparty - Create customer response
export interface CreateCounterpartyResponse {
  meta: Meta;
  name: string;
  phone?: string;
  email?: string;
  cardNumber?: string;
  bonusProgram?: {
    agentBonusBalance: number;
  };
}

// GET /counterparty - Search customer response
export interface SearchCounterpartyResponse {
  rows: Array<{
    id: string;
    name: string;
    phone?: string;
    email?: string;
    cardNumber?: string;
  }>;
}

// POST /counterparty/detail - Get balance response
export interface GetBalanceResponse {
  bonusProgram: {
    agentBonusBalance: number;
  };
}

// POST /counterparty/verify - Request verification code response
export interface RequestVerificationCodeResponse {
  message: string;
}

// POST /retaildemand/recalc - Calculate discounts response
export interface RecalcResponse {
  positions: Position[];
  bonusProgram: {
    earnedBonus?: number;
    spentBonus?: number;
  };
}

// POST /retaildemand/verify - Verify spending response
export interface VerifySpendingResponse {
  success: boolean;
  message: string;
}

// POST /retaildemand - Create sale response
export interface CreateSaleResponse {
  meta: Meta;
  bonusProgram?: {
    earnedBonus?: number;
    spentBonus?: number;
  };
}

// POST /retailsalesreturn - Create return response
export interface CreateReturnResponse {
  meta: Meta;
  bonusProgram?: {
    returnedBonus?: number;
  };
}

// GET /giftcard - Search gift card response
export interface SearchGiftCardResponse {
  rows: Array<{
    id: string;
    name: string;
    balance: number;
    status: string;
  }>;
}

// ============================================================================
// Error Response Type
// ============================================================================

export interface LoyaltyApiError {
  error: {
    message: string;
    code: string;
  };
}

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_VERIFICATION_CODE: 'INVALID_VERIFICATION_CODE',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Custom Error Class
// ============================================================================

export class LoyaltyApiErrorClass extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'LoyaltyApiError';
  }

  toJSON(): LoyaltyApiError {
    return {
      error: {
        message: this.message,
        code: this.code
      }
    };
  }
}
