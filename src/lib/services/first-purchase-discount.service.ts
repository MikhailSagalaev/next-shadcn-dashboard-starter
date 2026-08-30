import { db } from '@/lib/db';

export type FirstPurchaseDiscountSource = 'ORGANIZATION' | 'PROJECT';

export interface FirstPurchaseDiscountEligibility {
  available: boolean;
  discountPercent: number;
  source: FirstPurchaseDiscountSource | null;
}

export interface FirstPurchaseDiscountSubject {
  totalPurchases: number;
  firstPurchaseDiscountRedeemedAt: Date | null;
  organization: {
    isActive: boolean;
    firstPurchaseDiscountPercent: number;
  } | null;
  project: {
    enablePartnerRoles: boolean;
    welcomeRewardType: 'BONUS' | 'DISCOUNT';
    firstPurchaseDiscountPercent: number;
  };
}

const unavailable = (): FirstPurchaseDiscountEligibility => ({
  available: false,
  discountPercent: 0,
  source: null
});

function validPercent(value: number): number {
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : 0;
}

export function resolveFirstPurchaseDiscount(
  subject: FirstPurchaseDiscountSubject | null
): FirstPurchaseDiscountEligibility {
  if (
    !subject ||
    subject.totalPurchases > 0 ||
    subject.firstPurchaseDiscountRedeemedAt
  ) {
    return unavailable();
  }

  const organizationPercent =
    subject.organization?.isActive === true
      ? validPercent(subject.organization.firstPurchaseDiscountPercent)
      : 0;
  if (organizationPercent > 0) {
    return {
      available: true,
      discountPercent: organizationPercent,
      source: 'ORGANIZATION'
    };
  }

  const projectPercent =
    !subject.project.enablePartnerRoles &&
    subject.project.welcomeRewardType === 'DISCOUNT'
      ? validPercent(subject.project.firstPurchaseDiscountPercent)
      : 0;
  if (projectPercent > 0) {
    return {
      available: true,
      discountPercent: projectPercent,
      source: 'PROJECT'
    };
  }

  return unavailable();
}

export class FirstPurchaseDiscountService {
  static async getEligibility(
    projectId: string,
    userId: string
  ): Promise<FirstPurchaseDiscountEligibility> {
    const user = await db.user.findFirst({
      where: { id: userId, projectId },
      select: {
        totalPurchases: true,
        firstPurchaseDiscountRedeemedAt: true,
        organization: {
          select: {
            isActive: true,
            firstPurchaseDiscountPercent: true
          }
        },
        project: {
          select: {
            enablePartnerRoles: true,
            welcomeRewardType: true,
            firstPurchaseDiscountPercent: true
          }
        }
      }
    });

    return resolveFirstPurchaseDiscount(
      user
        ? {
            totalPurchases: Number(user.totalPurchases),
            firstPurchaseDiscountRedeemedAt:
              user.firstPurchaseDiscountRedeemedAt,
            organization: user.organization
              ? {
                  isActive: user.organization.isActive,
                  firstPurchaseDiscountPercent:
                    user.organization.firstPurchaseDiscountPercent
                }
              : null,
            project: {
              enablePartnerRoles: user.project.enablePartnerRoles,
              welcomeRewardType: user.project.welcomeRewardType,
              firstPurchaseDiscountPercent:
                user.project.firstPurchaseDiscountPercent
            }
          }
        : null
    );
  }
}
