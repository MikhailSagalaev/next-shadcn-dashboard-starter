/**
 * @file: src/lib/services/workflow/user-variables.service.ts
 * @description: Сервис для работы с переменными пользователя в workflow
 * @project: SaaS Bonus System
 * @dependencies: Prisma, QueryExecutor
 * @created: 2025-10-15
 * @author: AI Assistant + User
 */

import { PrismaClient } from '@prisma/client';
import { QueryExecutor } from './query-executor';
import { logger } from '@/lib/logger';

export interface UserProfileData {
  // Основная информация
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  telegramId?: string;
  telegramUsername?: string;
  
  // Финансовая информация
  balance: number;
  totalEarned: number;
  totalSpent: number;
  totalPurchases: number;
  
  // Уровень и рефералы
  currentLevel: string;
  referralCode?: string;
  referredBy?: string;
  referrerName?: string;
  
  // Даты
  registeredAt: Date;
  updatedAt: Date;
  
  // История
  transactionHistory: any[];
  activeBonuses: any[];
  transactionCount: number;
  bonusCount: number;
}

export interface ReferralLinkData {
  referralCode: string;
  referralLink: string;
  projectName: string;
}

/**
 * Сервис для работы с переменными пользователя
 */
export class UserVariablesService {
  /**
   * Получить все переменные пользователя для использования в сообщениях
   */
  static async getUserVariables(
    db: PrismaClient,
    userId: string,
    projectId: string
  ): Promise<Record<string, any>> {
    try {
      // Получаем полный профиль пользователя
      const profile = await QueryExecutor.execute(db, 'get_user_profile', { userId });
      
      if (!profile) {
        logger.warn('User profile not found', { userId });
        return {};
      }

      // Получаем реферальную ссылку
      const referralData = await QueryExecutor.execute(db, 'get_referral_link', { 
        userId, 
        projectId 
      });

      // Форматируем даты для отображения
      const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('ru-RU', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(date));
      };

      // Форматируем историю транзакций для отображения
      const formatTransactionHistory = (transactions: any[]) => {
        return transactions.slice(0, 5).map(t => {
          const amount = Number(t.amount);
          const sign = t.type === 'EARN' ? '+' : '-';
          const date = formatDate(t.createdAt);
          return `${sign}${amount} бонусов - ${t.description || 'Операция'} (${date})`;
        }).join('\n');
      };

      // Форматируем активные бонусы для отображения
      const formatActiveBonuses = (bonuses: any[]) => {
        return bonuses.slice(0, 3).map(b => {
          const amount = Number(b.amount);
          const expires = b.expiresAt ? 
            ` (до ${formatDate(b.expiresAt)})` : 
            ' (без срока)';
          return `${amount} бонусов${expires}`;
        }).join('\n');
      };

      return {
        // Основная информация
        'user.id': profile.userId,
        'user.firstName': profile.firstName || 'Не указано',
        'user.lastName': profile.lastName || 'Не указано',
        'user.fullName': `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Не указано',
        'user.email': profile.email || 'Не указано',
        'user.phone': profile.phone || 'Не указано',
        'user.telegramId': profile.telegramId || 'Не указано',
        'user.telegramUsername': profile.telegramUsername || 'Не указано',
        
        // Финансовая информация
        'user.balance': profile.balance,
        'user.balanceFormatted': `${profile.balance} бонусов`,
        'user.totalEarned': profile.totalEarned,
        'user.totalEarnedFormatted': `${profile.totalEarned} бонусов`,
        'user.totalSpent': profile.totalSpent,
        'user.totalSpentFormatted': `${profile.totalSpent} бонусов`,
        'user.totalPurchases': profile.totalPurchases,
        'user.totalPurchasesFormatted': `${profile.totalPurchases} руб.`,
        
        // Уровень и рефералы
        'user.currentLevel': profile.currentLevel,
        'user.referralCode': profile.referralCode || 'Не сгенерирован',
        'user.referredBy': profile.referredBy || 'Нет',
        'user.referrerName': profile.referrerName || 'Нет',
        
        // Даты
        'user.registeredAt': formatDate(profile.registeredAt),
        'user.updatedAt': formatDate(profile.updatedAt),
        
        // История и статистика
        'user.transactionCount': profile.transactionCount,
        'user.bonusCount': profile.bonusCount,
        'user.transactionHistory': formatTransactionHistory(profile.transactionHistory),
        'user.activeBonuses': formatActiveBonuses(profile.activeBonuses),
        
        // Реферальная ссылка
        'user.referralLink': referralData?.referralLink || 'Недоступно',
        'user.referralCodeShort': referralData?.referralCode || 'Нет',
        'user.projectName': referralData?.projectName || 'Бонусная система',
        
        // Дополнительные переменные для удобства
        'user.hasReferralCode': profile.referralCode ? 'Да' : 'Нет',
        'user.hasTransactions': profile.transactionCount > 0 ? 'Да' : 'Нет',
        'user.hasBonuses': profile.bonusCount > 0 ? 'Да' : 'Нет',
        'user.isNewUser': profile.transactionCount === 0 ? 'Да' : 'Нет',
        
        // Статистика для отображения
        'user.stats': {
          balance: profile.balance,
          totalEarned: profile.totalEarned,
          totalSpent: profile.totalSpent,
          transactionCount: profile.transactionCount,
          bonusCount: profile.bonusCount
        }
      };

    } catch (error) {
      logger.error('Failed to get user variables', { userId, error });
      
      // Возвращаем базовые переменные в случае ошибки
      return {
        'user.firstName': 'Пользователь',
        'user.balanceFormatted': '0 бонусов',
        'user.currentLevel': 'Базовый',
        'user.referralCode': 'Недоступно',
        'user.referralLink': 'Недоступно',
        'user.totalEarnedFormatted': '0 бонусов',
        'user.totalSpentFormatted': '0 бонусов',
        'user.totalPurchasesFormatted': '0 руб.'
      };
    }
  }

  /**
   * Получить только основные переменные пользователя (для быстрого доступа)
   */
  static async getBasicUserVariables(
    db: PrismaClient,
    userId: string
  ): Promise<Record<string, any>> {
    try {
      const profile = await QueryExecutor.execute(db, 'get_user_profile', { userId });
      
      if (!profile) {
        return {};
      }

      return {
        'user.firstName': profile.firstName || 'Пользователь',
        'user.balance': profile.balance,
        'user.balanceFormatted': `${profile.balance} бонусов`,
        'user.currentLevel': profile.currentLevel,
        'user.referralCode': profile.referralCode || 'Нет'
      };

    } catch (error) {
      logger.error('Failed to get basic user variables', { userId, error });
      return {};
    }
  }

  /**
   * Получить переменные для отображения истории транзакций
   */
  static async getTransactionHistoryVariables(
    db: PrismaClient,
    userId: string,
    limit: number = 10
  ): Promise<Record<string, any>> {
    try {
      const transactions = await QueryExecutor.execute(db, 'get_transactions', { 
        userId, 
        limit 
      });

      if (!transactions || transactions.length === 0) {
        return {
          'user.transactionHistory': 'История транзакций пуста',
          'user.transactionCount': 0
        };
      }

      const formatTransaction = (t: any) => {
        const amount = Number(t.amount);
        const sign = t.type === 'EARN' ? '+' : '-';
        const date = new Intl.DateTimeFormat('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(t.createdAt));
        
        return `${sign}${amount} бонусов - ${t.description || 'Операция'} (${date})`;
      };

      return {
        'user.transactionHistory': transactions.map(formatTransaction).join('\n'),
        'user.transactionCount': transactions.length,
        'user.lastTransaction': transactions[0] ? formatTransaction(transactions[0]) : 'Нет'
      };

    } catch (error) {
      logger.error('Failed to get transaction history variables', { userId, error });
      return {};
    }
  }

  /**
   * Получить переменные для отображения реферальной информации
   */
  static async getReferralVariables(
    db: PrismaClient,
    userId: string,
    projectId: string
  ): Promise<Record<string, any>> {
    try {
      const referralData = await QueryExecutor.execute(db, 'get_referral_link', { 
        userId, 
        projectId 
      });

      if (!referralData) {
        return {
          'user.referralCode': 'Недоступно',
          'user.referralLink': 'Недоступно',
          'user.hasReferralCode': 'Нет'
        };
      }

      return {
        'user.referralCode': referralData.referralCode,
        'user.referralLink': referralData.referralLink,
        'user.projectName': referralData.projectName,
        'user.hasReferralCode': 'Да'
      };

    } catch (error) {
      logger.error('Failed to get referral variables', { userId, error });
      return {};
    }
  }
}

export default UserVariablesService;
