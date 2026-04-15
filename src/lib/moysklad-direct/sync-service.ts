/**
 * @file: sync-service.ts
 * @description: Bidirectional bonus synchronization service for МойСклад Direct integration
 * @project: SaaS Bonus System
 * @dependencies: MoySkladClient, BonusService, Prisma
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { MoySkladClient, normalizePhone } from './client';
import {
  SyncBonusAccrualParams,
  SyncBonusSpendingParams,
  SyncFromMoySkladParams,
  BalanceCheckResult,
  MoySkladBonusTransaction
} from './types';
import { BonusType, TransactionType, SyncDirection } from '@prisma/client';
import { UserService } from '../services/user.service';

// Global memory lock to prevent race conditions during parallel syncs
const syncLocks = new Set<string>();

export class SyncService {
  /**
   * Sync bonus accrual from our system to МойСклад (online → offline)
   */
  async syncBonusAccrualToMoySklad(
    params: SyncBonusAccrualParams
  ): Promise<void> {
    const { userId, amount, source } = params;

    try {
      // Load user with project and integration
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          project: {
            include: {
              moySkladDirectIntegration: true
            }
          }
        }
      });

      if (!user) {
        logger.warn(
          'User not found for МойСклад sync',
          { userId },
          'moysklad-direct-sync'
        );
        return;
      }

      const integration = user.project.moySkladDirectIntegration;

      // Check if integration is active and allows outgoing sync
      if (!integration || !integration.isActive) {
        logger.debug(
          'МойСклад integration not active, skipping sync',
          {
            userId,
            projectId: user.projectId
          },
          'moysklad-direct-sync'
        );
        return;
      }

      if (integration.syncDirection === SyncDirection.MOYSKLAD_TO_US) {
        logger.debug(
          'Sync direction does not allow outgoing sync',
          {
            userId,
            syncDirection: integration.syncDirection
          },
          'moysklad-direct-sync'
        );
        return;
      }

      if (!integration.autoSync) {
        logger.debug(
          'Auto sync is disabled',
          { userId },
          'moysklad-direct-sync'
        );
        return;
      }

      // Get or find counterparty ID
      let counterpartyId = user.moySkladDirectCounterpartyId;

      if (!counterpartyId) {
        // Try to find and link counterparty by phone
        const linked = await this.findAndLinkCounterparty(userId);
        if (!linked) {
          logger.warn(
            'User not linked to МойСклад counterparty, skipping sync',
            {
              userId,
              phone: user.phone
            },
            'moysklad-direct-sync'
          );

          // Create sync log with error
          await db.moySkladDirectSyncLog.create({
            data: {
              integrationId: integration.id,
              operation: 'bonus_accrual',
              direction: 'outgoing',
              userId,
              amount,
              status: 'error',
              errorMessage: 'User not linked to МойСклад counterparty',
              requestData: { source, amount }
            }
          });

          return;
        }

        // Reload user to get updated counterpartyId
        const updatedUser = await db.user.findUnique({
          where: { id: userId },
          select: { moySkladDirectCounterpartyId: true }
        });

        counterpartyId = updatedUser?.moySkladDirectCounterpartyId;
      }

      if (!counterpartyId) {
        logger.error(
          'Failed to get counterparty ID after linking',
          { userId },
          'moysklad-direct-sync'
        );
        return;
      }

      // Create МойСклад client
      const client = new MoySkladClient({
        accountId: integration.accountId,
        apiToken: integration.apiToken,
        bonusProgramId: integration.bonusProgramId
      });

      // Accrue bonus in МойСклад
      const transaction = await client.accrueBonus({
        counterpartyId,
        amount: Number(amount),
        comment: `Начисление бонусов: ${source}`
      });

      // Create sync log
      await db.moySkladDirectSyncLog.create({
        data: {
          integrationId: integration.id,
          operation: 'bonus_accrual',
          direction: 'outgoing',
          moySkladTransactionId: transaction.id,
          userId,
          amount,
          requestData: { source, amount, counterpartyId } as any,
          responseData: transaction as any,
          status: 'success'
        }
      });

      // Update integration lastSyncAt
      await db.moySkladDirectIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastError: null
        }
      });

      logger.info(
        'Bonus accrual synced to МойСклад successfully',
        {
          userId,
          amount,
          transactionId: transaction.id
        },
        'moysklad-direct-sync'
      );
    } catch (error) {
      logger.error(
        'Error syncing bonus accrual to МойСклад',
        {
          error,
          userId,
          amount,
          source
        },
        'moysklad-direct-sync'
      );

      // Try to create error log (non-critical if fails)
      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: {
            project: {
              select: {
                moySkladDirectIntegration: {
                  select: { id: true }
                }
              }
            }
          }
        });

        if (user?.project.moySkladDirectIntegration) {
          await db.moySkladDirectSyncLog.create({
            data: {
              integrationId: user.project.moySkladDirectIntegration.id,
              operation: 'bonus_accrual',
              direction: 'outgoing',
              userId,
              amount,
              status: 'error',
              errorMessage: (error as Error).message,
              requestData: { source, amount }
            }
          });

          await db.moySkladDirectIntegration.update({
            where: { id: user.project.moySkladDirectIntegration.id },
            data: { lastError: (error as Error).message }
          });
        }
      } catch (logError) {
        logger.error(
          'Failed to create error log',
          { logError },
          'moysklad-direct-sync'
        );
      }

      // Don't throw - sync is non-critical operation
    }
  }

  /**
   * Sync bonus spending from our system to МойСклад (online → offline)
   */
  async syncBonusSpendingToMoySklad(
    params: SyncBonusSpendingParams
  ): Promise<void> {
    const { userId, amount, source } = params;

    try {
      // Load user with project and integration
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          project: {
            include: {
              moySkladDirectIntegration: true
            }
          }
        }
      });

      if (!user) {
        logger.warn(
          'User not found for МойСклад sync',
          { userId },
          'moysklad-direct-sync'
        );
        return;
      }

      const integration = user.project.moySkladDirectIntegration;

      // Check if integration is active and allows outgoing sync
      if (!integration || !integration.isActive) {
        logger.debug(
          'МойСклад integration not active, skipping sync',
          {
            userId,
            projectId: user.projectId
          },
          'moysklad-direct-sync'
        );
        return;
      }

      if (integration.syncDirection === SyncDirection.MOYSKLAD_TO_US) {
        logger.debug(
          'Sync direction does not allow outgoing sync',
          {
            userId,
            syncDirection: integration.syncDirection
          },
          'moysklad-direct-sync'
        );
        return;
      }

      if (!integration.autoSync) {
        logger.debug(
          'Auto sync is disabled',
          { userId },
          'moysklad-direct-sync'
        );
        return;
      }

      // Get counterparty ID
      const counterpartyId = user.moySkladDirectCounterpartyId;

      if (!counterpartyId) {
        logger.warn(
          'User not linked to МойСклад counterparty, skipping sync',
          {
            userId
          },
          'moysklad-direct-sync'
        );
        return;
      }

      // Create МойСклад client
      const client = new MoySkladClient({
        accountId: integration.accountId,
        apiToken: integration.apiToken,
        bonusProgramId: integration.bonusProgramId
      });

      // Spend bonus in МойСклад
      const transaction = await client.spendBonus({
        counterpartyId,
        amount: Number(amount),
        comment: `Списание бонусов: ${source}`
      });

      // Create sync log
      await db.moySkladDirectSyncLog.create({
        data: {
          integrationId: integration.id,
          operation: 'bonus_spending',
          direction: 'outgoing',
          moySkladTransactionId: transaction.id,
          userId,
          amount,
          requestData: { source, amount, counterpartyId } as any,
          responseData: transaction as any,
          status: 'success'
        }
      });

      // Update integration lastSyncAt
      await db.moySkladDirectIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastError: null
        }
      });

      logger.info(
        'Bonus spending synced to МойСклад successfully',
        {
          userId,
          amount,
          transactionId: transaction.id
        },
        'moysklad-direct-sync'
      );
    } catch (error) {
      logger.error(
        'Error syncing bonus spending to МойСклад',
        {
          error,
          userId,
          amount,
          source
        },
        'moysklad-direct-sync'
      );

      // Don't throw - sync is non-critical operation
    }
  }

  /**
   * Sync bonus transaction from МойСклад to our system (offline → online)
   */
  async syncFromMoySklad(params: SyncFromMoySkladParams): Promise<void> {
    const { integrationId, bonusTransaction } = params;

    try {
      // Load integration
      const integration = await db.moySkladDirectIntegration.findUnique({
        where: { id: integrationId },
        include: { project: true }
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Check sync direction
      if (integration.syncDirection === SyncDirection.US_TO_MOYSKLAD) {
        logger.debug(
          'Sync direction does not allow incoming sync',
          {
            integrationId,
            syncDirection: integration.syncDirection
          },
          'moysklad-direct-sync'
        );
        return;
      }

      // Extract counterparty ID from transaction
      const counterpartyHref = bonusTransaction.agent.meta.href;
      const counterpartyId = counterpartyHref.split('/').pop();

      if (!counterpartyId) {
        throw new Error('Failed to extract counterparty ID from transaction');
      }

      // Find user by counterparty ID
      let user = await db.user.findFirst({
        where: {
          moySkladDirectCounterpartyId: counterpartyId
        }
      });

      // If not found, try to find by phone
      if (!user) {
        const client = new MoySkladClient({
          accountId: integration.accountId,
          apiToken: integration.apiToken,
          bonusProgramId: integration.bonusProgramId
        });

        const counterparty = await client.getCounterparty(counterpartyId);

        if (counterparty.phone) {
          const normalizedPhone = normalizePhone(counterparty.phone);
          const phoneWithoutPlus = normalizedPhone.replace('+', '');
          const phoneWith8 = '8' + phoneWithoutPlus.substring(1);

          user = await db.user.findFirst({
            where: {
              projectId: integration.projectId,
              phone: {
                in: [
                  normalizedPhone,
                  phoneWithoutPlus,
                  phoneWith8,
                  counterparty.phone
                ]
              }
            }
          });

          // Link user to counterparty
          if (user) {
            await db.user.update({
              where: { id: user.id },
              data: { moySkladDirectCounterpartyId: counterpartyId }
            });

            logger.info(
              'User linked to МойСклад counterparty',
              {
                userId: user.id,
                counterpartyId
              },
              'moysklad-direct-sync'
            );
          }
        }
      }

      if (!user) {
        throw new Error(`User not found for counterparty ${counterpartyId}`);
      }

      // Check if this transaction has already been processed
      const existingBonus = await db.bonus.findUnique({
        where: { externalId: bonusTransaction.id }
      });

      if (existingBonus) {
        logger.info(
          'Bonus transaction already processed, skipping',
          {
            userId: user.id,
            moySkladTransactionId: bonusTransaction.id
          },
          'moysklad-direct-sync'
        );
        return;
      }

      const amount = bonusTransaction.bonusValue;
      const transactionType = bonusTransaction.transactionType;

      // Process based on transaction type
      if (transactionType === 'EARNING') {
        // Create bonus record
        const expiryDays = integration.project.bonusExpiryDays || 365;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        const bonus = await db.bonus.create({
          data: {
            userId: user.id,
            amount,
            type: BonusType.PURCHASE,
            description: `Офлайн покупка в МойСклад: ${bonusTransaction.description || ''}`,
            expiresAt,
            externalId: bonusTransaction.id,
            metadata: {
              source: 'moysklad_offline',
              moySkladTransactionId: bonusTransaction.id
            }
          }
        });

        // Create transaction record
        await db.transaction.create({
          data: {
            userId: user.id,
            bonusId: bonus.id,
            amount,
            type: TransactionType.EARN,
            description: 'Начисление бонусов за офлайн покупку',
            externalId: bonusTransaction.id,
            metadata: {
              source: 'moysklad_offline',
              moySkladTransactionId: bonusTransaction.id
            }
          }
        });

        logger.info(
          'Bonus accrual synced from МойСклад',
          {
            userId: user.id,
            amount,
            bonusId: bonus.id
          },
          'moysklad-direct-sync'
        );
      } else if (transactionType === 'SPENDING') {
        // Create transaction record for spending
        await db.transaction.create({
          data: {
            userId: user.id,
            amount,
            type: TransactionType.SPEND,
            description: 'Списание бонусов в офлайн покупке',
            externalId: bonusTransaction.id,
            metadata: {
              source: 'moysklad_offline',
              moySkladTransactionId: bonusTransaction.id
            }
          }
        });

        logger.info(
          'Bonus spending synced from МойСклад',
          {
            userId: user.id,
            amount
          },
          'moysklad-direct-sync'
        );
      }

      // Create sync log
      await db.moySkladDirectSyncLog.create({
        data: {
          integrationId,
          operation:
            transactionType === 'EARNING' ? 'bonus_accrual' : 'bonus_spending',
          direction: 'incoming',
          moySkladTransactionId: bonusTransaction.id,
          userId: user.id,
          amount,
          requestData: bonusTransaction as any,
          status: 'success'
        }
      });

      // Update integration lastSyncAt
      await db.moySkladDirectIntegration.update({
        where: { id: integrationId },
        data: {
          lastSyncAt: new Date(),
          lastError: null
        }
      });

      // Send Telegram notification if user has chat ID
      if (user.telegramId) {
        // TODO: Implement Telegram notification
        logger.info(
          'Telegram notification should be sent',
          {
            userId: user.id,
            telegramId: user.telegramId,
            amount,
            type: transactionType
          },
          'moysklad-direct-sync'
        );
      }
    } catch (error) {
      logger.error(
        'Error syncing from МойСклад',
        {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name
                }
              : error,
          integrationId,
          transactionId: bonusTransaction.id
        },
        'moysklad-direct-sync'
      );

      // Create error log
      await db.moySkladDirectSyncLog.create({
        data: {
          integrationId,
          operation:
            bonusTransaction.transactionType === 'EARNING'
              ? 'bonus_accrual'
              : 'bonus_spending',
          direction: 'incoming',
          moySkladTransactionId: bonusTransaction.id,
          amount: bonusTransaction.bonusValue,
          requestData: bonusTransaction as any,
          status: 'error',
          errorMessage: (error as Error).message
        }
      });

      await db.moySkladDirectIntegration.update({
        where: { id: integrationId },
        data: { lastError: (error as Error).message }
      });

      throw error;
    }
  }

  /**
   * Check and compare balances between our system and МойСклад
   */
  async checkAndSyncBalance(userId: string): Promise<BalanceCheckResult> {
    // Prevent concurrent syncs for the same user
    if (syncLocks.has(userId)) {
      logger.warn(
        'Sync already in progress for user',
        { userId },
        'moysklad-direct-sync'
      );
      return {
        ourBalance: 0,
        moySkladBalance: null,
        synced: false,
        error: 'Синхронизация уже выполняется'
      };
    }

    syncLocks.add(userId);
    try {
      // Load user with integration
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          project: {
            include: {
              moySkladDirectIntegration: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const integration = user.project.moySkladDirectIntegration;

      // Get our balance
      const ourBalance = await this.getAvailableBalance(userId);

      // If no integration or not active, return only our balance
      if (
        !integration ||
        !integration.isActive ||
        !user.moySkladDirectCounterpartyId
      ) {
        return {
          ourBalance,
          moySkladBalance: null,
          synced: false,
          error: 'МойСклад integration not active or user not linked'
        };
      }

      // Get МойСклад balance
      try {
        const client = new MoySkladClient({
          accountId: integration.accountId,
          apiToken: integration.apiToken,
          bonusProgramId: integration.bonusProgramId
        });

        const moySkladBalance = await client.getBalance({
          counterpartyId: user.moySkladDirectCounterpartyId
        });

        // Compare balances
        const difference = Math.abs(ourBalance - moySkladBalance);
        const synced = difference < 0.01;

        let finalOurBalance = ourBalance;
        let isSynced = synced;
        let correctionMessage = null;

        if (!synced) {
          logger.warn(
            'Balance mismatch detected, auto-correcting...',
            {
              userId,
              ourBalance,
              moySkladBalance,
              difference
            },
            'moysklad-direct-sync'
          );

          const expiryDays = user.project.bonusExpiryDays || 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiryDays);

          if (moySkladBalance > ourBalance) {
            const correctAmount = moySkladBalance - ourBalance;
            const bonus = await db.bonus.create({
              data: {
                userId: user.id,
                amount: correctAmount,
                type: BonusType.PURCHASE,
                description: 'Корректировка баланса из МойСклад',
                expiresAt,
                metadata: { source: 'moysklad_correction' }
              }
            });
            await db.transaction.create({
              data: {
                userId: user.id,
                bonusId: bonus.id,
                amount: correctAmount,
                type: TransactionType.EARN,
                description: 'Корректировка баланса (прибавка) из МойСклад',
                metadata: { source: 'moysklad_correction' }
              }
            });
            correctionMessage = `Авто-корректировка: начислено ${correctAmount}`;
          } else {
            const correctAmount = ourBalance - moySkladBalance;
            await db.transaction.create({
              data: {
                userId: user.id,
                amount: correctAmount,
                type: TransactionType.SPEND,
                description: 'Корректировка баланса (списание) из МойСклад',
                metadata: { source: 'moysklad_correction' }
              }
            });
            correctionMessage = `Авто-корректировка: списано ${correctAmount}`;
          }

          finalOurBalance = moySkladBalance;
          isSynced = true;
        }

        // Create sync log
        await db.moySkladDirectSyncLog.create({
          data: {
            integrationId: integration.id,
            operation: 'balance_sync',
            direction: 'incoming',
            userId,
            amount: difference > 0 ? difference : ourBalance,
            requestData: {
              oldOurBalance: ourBalance,
              newOurBalance: finalOurBalance,
              moySkladBalance
            },
            responseData: {
              message: correctionMessage || 'Изменений не требуется'
            },
            status: 'success',
            errorMessage: correctionMessage
          }
        });

        return {
          ourBalance: finalOurBalance,
          moySkladBalance,
          synced: isSynced
        };
      } catch (error) {
        logger.error(
          'Error getting МойСклад balance',
          {
            error,
            userId
          },
          'moysklad-direct-sync'
        );

        return {
          ourBalance,
          moySkladBalance: null,
          synced: false,
          error: (error as Error).message
        };
      }
    } catch (error) {
      logger.error(
        'Error checking balance',
        {
          error,
          userId
        },
        'moysklad-direct-sync'
      );

      throw error;
    } finally {
      syncLocks.delete(userId);
    }
  }

  /**
   * Find counterparty by phone and link to user
   */
  async findAndLinkCounterparty(userId: string): Promise<boolean> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          project: {
            include: {
              moySkladDirectIntegration: true
            }
          }
        }
      });

      if (!user || !user.phone) {
        logger.warn(
          'User not found or has no phone',
          { userId },
          'moysklad-direct-sync'
        );
        return false;
      }

      const integration = user.project.moySkladDirectIntegration;

      if (!integration || !integration.isActive) {
        return false;
      }

      const client = new MoySkladClient({
        accountId: integration.accountId,
        apiToken: integration.apiToken,
        bonusProgramId: integration.bonusProgramId
      });

      const counterparty = await client.findCounterpartyByPhone({
        phone: user.phone
      });

      if (counterparty) {
        await this.linkUserToCounterparty(userId, counterparty.id);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        'Error finding and linking counterparty',
        {
          error,
          userId
        },
        'moysklad-direct-sync'
      );
      return false;
    }
  }

  /**
   * Link user to МойСклад counterparty
   */
  async linkUserToCounterparty(
    userId: string,
    counterpartyId: string
  ): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { moySkladDirectCounterpartyId: counterpartyId }
    });

    logger.info(
      'User linked to МойСклад counterparty',
      {
        userId,
        counterpartyId
      },
      'moysklad-direct-sync'
    );
  }

  /**
   * Get available bonus balance for user
   */
  private async getAvailableBalance(userId: string): Promise<number> {
    const userBalance = await UserService.getUserBalance(userId);
    return userBalance.currentBalance;
  }
}
