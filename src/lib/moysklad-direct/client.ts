/**
 * @file: client.ts
 * @description: МойСклад API client for Bonus Transaction API with retry logic, caching, and phone normalization
 * @project: SaaS Bonus System
 * @dependencies: МойСклад JSON API 1.2
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { decryptApiToken } from './encryption';
import {
  MoySkladClientConfig,
  MoySkladCounterparty,
  MoySkladBonusTransaction,
  CreateBonusTransactionRequest,
  MoySkladApiException,
  AccrueBonusParams,
  SpendBonusParams,
  FindCounterpartyParams,
  GetBalanceParams
} from './types';

// Balance cache (5 minutes TTL)
class BalanceCache {
  private cache = new Map<string, { balance: number; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(counterpartyId: string): number | null {
    const cached = this.cache.get(counterpartyId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(counterpartyId);
      return null;
    }

    return cached.balance;
  }

  set(counterpartyId: string, balance: number): void {
    this.cache.set(counterpartyId, {
      balance,
      timestamp: Date.now()
    });
  }

  invalidate(counterpartyId: string): void {
    this.cache.delete(counterpartyId);
  }
}

const balanceCache = new BalanceCache();

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle Russian phone numbers
  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.substring(1);
  } else if (digits.startsWith('7') && digits.length === 11) {
    // Already in correct format
  } else if (digits.length === 10) {
    // Assume Russian number without country code
    digits = '7' + digits;
  }

  return '+' + digits;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(statusCode: number): boolean {
  return [429, 500, 502, 503].includes(statusCode);
}

export class MoySkladClient {
  private baseUrl = 'https://api.moysklad.ru/api/remap/1.2';
  private accountId: string;
  private apiToken: string;
  private bonusProgramId: string;
  private timeout = 30000; // 30 seconds

  constructor(config: MoySkladClientConfig) {
    this.accountId = config.accountId;
    this.apiToken = decryptApiToken(config.apiToken);
    this.bonusProgramId = config.bonusProgramId;
  }

  /**
   * Make API request with retry logic
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);

          // Check if we should retry
          if (isRetryableError(response.status) && attempt < maxRetries) {
            const delay =
              response.status === 429
                ? 1000 * Math.pow(2, attempt - 1) // 1s, 2s, 4s for rate limits
                : 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s for server errors

            logger.warn(
              `МойСклад API error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
              {
                url,
                status: response.status
              },
              'moysklad-direct-client'
            );

            await sleep(delay);
            continue;
          }

          throw new MoySkladApiException(
            `МойСклад API error: ${response.statusText}`,
            response.status,
            errorData
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-retryable errors
        if (
          error instanceof MoySkladApiException &&
          !isRetryableError(error.statusCode)
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }

        // Retry on network errors
        logger.warn(
          `Network error, retrying (attempt ${attempt}/${maxRetries})`,
          {
            error: (error as Error).message
          },
          'moysklad-direct-client'
        );

        await sleep(2000 * Math.pow(2, attempt - 1));
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Accrue bonus to counterparty
   */
  async accrueBonus(
    params: AccrueBonusParams
  ): Promise<MoySkladBonusTransaction> {
    const { counterpartyId, amount, comment } = params;

    logger.info(
      'Accruing bonus in МойСклад',
      {
        counterpartyId,
        amount,
        comment
      },
      'moysklad-direct-client'
    );

    const requestBody: CreateBonusTransactionRequest = {
      bonusProgram: {
        meta: {
          href: `${this.baseUrl}/entity/bonusprogram/${this.bonusProgramId}`,
          type: 'bonusprogram',
          mediaType: 'application/json'
        }
      },
      agent: {
        meta: {
          href: `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
          type: 'counterparty',
          mediaType: 'application/json'
        }
      },
      bonusValue: amount,
      transactionType: 'EARNING',
      transactionStatus: 'COMPLETED',
      moment: new Date().toISOString(),
      description: comment
    };

    try {
      const transaction = await this.makeRequest<MoySkladBonusTransaction>(
        `${this.baseUrl}/entity/bonustransaction`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      // Invalidate balance cache
      balanceCache.invalidate(counterpartyId);

      logger.info(
        'Bonus accrued successfully in МойСклад',
        {
          transactionId: transaction.id,
          amount
        },
        'moysklad-direct-client'
      );

      return transaction;
    } catch (error) {
      logger.error(
        'Error accruing bonus in МойСклад',
        {
          error,
          counterpartyId,
          amount
        },
        'moysklad-direct-client'
      );
      throw error;
    }
  }

  /**
   * Spend bonus from counterparty
   */
  async spendBonus(
    params: SpendBonusParams
  ): Promise<MoySkladBonusTransaction> {
    const { counterpartyId, amount, comment } = params;

    logger.info(
      'Spending bonus in МойСклад',
      {
        counterpartyId,
        amount,
        comment
      },
      'moysklad-direct-client'
    );

    const requestBody: CreateBonusTransactionRequest = {
      bonusProgram: {
        meta: {
          href: `${this.baseUrl}/entity/bonusprogram/${this.bonusProgramId}`,
          type: 'bonusprogram',
          mediaType: 'application/json'
        }
      },
      agent: {
        meta: {
          href: `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
          type: 'counterparty',
          mediaType: 'application/json'
        }
      },
      bonusValue: amount,
      transactionType: 'SPENDING',
      transactionStatus: 'COMPLETED',
      moment: new Date().toISOString(),
      description: comment
    };

    try {
      const transaction = await this.makeRequest<MoySkladBonusTransaction>(
        `${this.baseUrl}/entity/bonustransaction`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      // Invalidate balance cache
      balanceCache.invalidate(counterpartyId);

      logger.info(
        'Bonus spent successfully in МойСклад',
        {
          transactionId: transaction.id,
          amount
        },
        'moysklad-direct-client'
      );

      return transaction;
    } catch (error) {
      logger.error(
        'Error spending bonus in МойСклад',
        {
          error,
          counterpartyId,
          amount
        },
        'moysklad-direct-client'
      );
      throw error;
    }
  }

  /**
   * Get counterparty bonus balance
   */
  async getBalance(params: GetBalanceParams): Promise<number> {
    const { counterpartyId } = params;

    // Check cache first
    const cachedBalance = balanceCache.get(counterpartyId);
    if (cachedBalance !== null) {
      logger.debug(
        'Balance retrieved from cache',
        {
          counterpartyId,
          balance: cachedBalance
        },
        'moysklad-direct-client'
      );
      return cachedBalance;
    }

    logger.info(
      'Getting balance from МойСклад',
      { counterpartyId },
      'moysklad-direct-client'
    );

    try {
      const counterparty = await this.makeRequest<MoySkladCounterparty>(
        `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          }
        }
      );

      const balance = counterparty.bonusPoints || 0;

      // Cache the balance
      balanceCache.set(counterpartyId, balance);

      logger.info(
        'Balance retrieved from МойСклад',
        {
          counterpartyId,
          balance
        },
        'moysklad-direct-client'
      );

      return balance;
    } catch (error) {
      logger.error(
        'Error getting balance from МойСклад',
        {
          error,
          counterpartyId
        },
        'moysklad-direct-client'
      );
      throw error;
    }
  }

  /**
   * Find counterparty by phone number
   */
  async findCounterpartyByPhone(
    params: FindCounterpartyParams
  ): Promise<MoySkladCounterparty | null> {
    const { phone } = params;
    const normalizedPhone = normalizePhone(phone);

    logger.info(
      'Finding counterparty by phone in МойСклад',
      {
        phone,
        normalizedPhone
      },
      'moysklad-direct-client'
    );

    try {
      const data = await this.makeRequest<{ rows: MoySkladCounterparty[] }>(
        `${this.baseUrl}/entity/counterparty?filter=phone=${encodeURIComponent(normalizedPhone)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          }
        }
      );

      const counterparty = data.rows[0] || null;

      if (counterparty) {
        logger.info(
          'Counterparty found in МойСклад',
          {
            counterpartyId: counterparty.id,
            phone: normalizedPhone
          },
          'moysklad-direct-client'
        );
      } else {
        logger.info(
          'Counterparty not found in МойСклад',
          {
            phone: normalizedPhone
          },
          'moysklad-direct-client'
        );
      }

      return counterparty;
    } catch (error) {
      logger.error(
        'Error finding counterparty in МойСклад',
        {
          error,
          phone: normalizedPhone
        },
        'moysklad-direct-client'
      );
      throw error;
    }
  }

  /**
   * Get counterparty by ID
   */
  async getCounterparty(counterpartyId: string): Promise<MoySkladCounterparty> {
    logger.info(
      'Getting counterparty from МойСклад',
      { counterpartyId },
      'moysklad-direct-client'
    );

    try {
      const counterparty = await this.makeRequest<MoySkladCounterparty>(
        `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          }
        }
      );

      logger.info(
        'Counterparty retrieved from МойСклад',
        {
          counterpartyId,
          name: counterparty.name
        },
        'moysklad-direct-client'
      );

      return counterparty;
    } catch (error) {
      logger.error(
        'Error getting counterparty from МойСклад',
        {
          error,
          counterpartyId
        },
        'moysklad-direct-client'
      );
      throw error;
    }
  }

  /**
   * Get bonus transaction by ID
   */
  async getBonusTransaction(
    transactionId: string
  ): Promise<MoySkladBonusTransaction> {
    logger.info(
      'Getting bonus transaction from МойСклад',
      { transactionId },
      'moysklad-direct-client'
    );

    try {
      const transaction = await this.makeRequest<MoySkladBonusTransaction>(
        `${this.baseUrl}/entity/bonustransaction/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          }
        }
      );

      logger.info(
        'Bonus transaction retrieved from МойСклад',
        {
          transactionId,
          type: transaction.transactionType,
          amount: transaction.bonusValue
        },
        'moysklad-direct-client'
      );

      return transaction;
    } catch (error) {
      logger.error(
        'Error getting bonus transaction from МойСклад',
        {
          error,
          transactionId
        },
        'moysklad-direct-client'
      );
      throw error;
    }
  }

  /**
   * Test connection to МойСклад API
   */
  async testConnection(): Promise<{
    success: boolean;
    details?: any;
    error?: string;
  }> {
    logger.info(
      'Testing connection to МойСклад API',
      {},
      'moysklad-direct-client'
    );

    try {
      const data = await this.makeRequest<any>(
        `${this.baseUrl}/entity/organization`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          }
        },
        1 // Only 1 attempt for connection test
      );

      logger.info(
        'Connection to МойСклад API successful',
        {},
        'moysklad-direct-client'
      );
      return {
        success: true,
        details: {
          accountId: this.accountId,
          organizationCount: data.rows?.length || 0
        }
      };
    } catch (error) {
      logger.error(
        'Connection to МойСклад API failed',
        { error },
        'moysklad-direct-client'
      );
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}

/**
 * Export phone normalization utility for testing
 */
export { normalizePhone };
