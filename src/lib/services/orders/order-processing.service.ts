import { db } from '@/lib/db';
import { NormalizedOrder } from '../integration/tilda-parser.service';
import { UserService, BonusService } from '@/lib/services/user.service';
import { BonusLevelService } from '@/lib/services/bonus-level.service';
import { logger } from '@/lib/logger';

export interface OrderProcessingResult {
  success: boolean;
  message: string;
  data?: any;
}

export class OrderProcessingService {
  static async processOrder(
    projectId: string,
    order: NormalizedOrder
  ): Promise<OrderProcessingResult> {
    logger.info('Processing Order', { projectId, orderId: order.orderId });

    // 1. Get Project Settings
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const bonusBehavior = (project.bonusBehavior || 'SPEND_AND_EARN') as
      | 'SPEND_AND_EARN'
      | 'SPEND_ONLY'
      | 'EARN_ONLY';

    // 2. Find or Create User
    let user = await UserService.findUserByContact(
      projectId,
      order.email,
      order.phone
    );

    // Handle Email/Phone Conflict
    // If we found a user by phone, but they provided a DIFFERENT email:
    if (
      user &&
      order.email &&
      user.email &&
      user.email.toLowerCase() !== order.email.toLowerCase()
    ) {
      // Check if the NEW email is taken
      const emailOwner = await db.user.findFirst({
        where: {
          projectId,
          email: { equals: order.email, mode: 'insensitive' }
        }
      });

      if (emailOwner && emailOwner.id !== user.id) {
        logger.warn('Email conflict detected', {
          existingUserId: user.id,
          emailOwnerId: emailOwner.id,
          conflictEmail: order.email
        });
        // We DO NOT update user email to avoid account takeover/merging confusion
        // We proceed with the user found by phone (assuming phone is primary identifier)
      } else {
        // Safe to update email
        user = (await db.user.update({
          where: { id: user.id },
          data: { email: order.email },
          include: { project: true, bonuses: true, transactions: true }
        })) as any;
      }
    }

    if (!user) {
      const nameParts = order.name ? order.name.trim().split(' ') : ['', ''];
      user = await UserService.createUser({
        projectId,
        email: order.email || '',
        phone: order.phone || '',
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        utmSource: order.utmSource || ''
      });
    }

    // 3. Process Bonuses
    // Determine Logic
    // Legacy "GUPIL" promo code check replaced with generalized check or just appliedBonuses
    // We trust 'appliedBonuses' from TildaParserService which normalizes widget behavior

    const totalAmount = order.amount;
    const appliedRequested = order.appliedBonuses;

    const shouldSpend =
      appliedRequested > 0 &&
      (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

    let spentAmount = 0;
    let actuallySpent = false;

    if (shouldSpend) {
      const balance = await UserService.getUserBalance(user.id);
      const canSpend = Math.min(
        appliedRequested,
        Number(balance.currentBalance),
        totalAmount
      );

      if (canSpend > 0) {
        const transactions = await BonusService.spendBonuses(
          user.id,
          canSpend,
          `Order ${order.orderId}`,
          { orderId: order.orderId, source: 'tilda' }
        );
        spentAmount = transactions.reduce(
          (sum, t) => sum + Number(t.amount),
          0
        );
        actuallySpent = true;
      }
    }

    // 4. Earn Bonuses
    let shouldEarn = true;
    let earnBase = totalAmount;

    if (actuallySpent) {
      if (bonusBehavior === 'SPEND_ONLY') {
        shouldEarn = false;
      } else {
        earnBase = totalAmount - spentAmount;
      }
    }

    let earnedBonusAmount = 0;
    if (shouldEarn && earnBase > 0) {
      const result = await BonusService.awardPurchaseBonus(
        user.id,
        earnBase,
        order.orderId,
        `Order #${order.orderId}`
      );
      earnedBonusAmount = Number(result.bonus.amount);
    }

    return {
      success: true,
      message: 'Order processed',
      data: {
        spent: spentAmount,
        earned: earnedBonusAmount,
        userId: user.id
      }
    };
  }
}
