import {
  resolveFirstPurchaseDiscount,
  type FirstPurchaseDiscountSubject
} from '@/lib/services/first-purchase-discount.service';

const buildSubject = (
  overrides: Partial<FirstPurchaseDiscountSubject> = {}
): FirstPurchaseDiscountSubject => ({
  totalPurchases: 0,
  firstPurchaseDiscountRedeemedAt: null,
  organization: {
    isActive: true,
    firstPurchaseDiscountPercent: 10
  },
  project: {
    welcomeRewardType: 'BONUS' as const,
    firstPurchaseDiscountPercent: 0
  },
  ...overrides
});

describe('resolveFirstPurchaseDiscount', () => {
  it('uses the active B2B organization discount', () => {
    expect(resolveFirstPurchaseDiscount(buildSubject())).toEqual({
      available: true,
      discountPercent: 10,
      source: 'ORGANIZATION'
    });
  });

  it('falls back to the project discount when the organization has none', () => {
    expect(
      resolveFirstPurchaseDiscount(
        buildSubject({
          organization: {
            isActive: true,
            firstPurchaseDiscountPercent: 0
          },
          project: {
            welcomeRewardType: 'DISCOUNT',
            firstPurchaseDiscountPercent: 7
          }
        })
      )
    ).toEqual({
      available: true,
      discountPercent: 7,
      source: 'PROJECT'
    });
  });

  it('does not use a discount from an inactive organization', () => {
    expect(
      resolveFirstPurchaseDiscount(
        buildSubject({
          organization: {
            isActive: false,
            firstPurchaseDiscountPercent: 10
          }
        })
      )
    ).toEqual({
      available: false,
      discountPercent: 0,
      source: null
    });
  });

  it('does not offer the discount after a purchase', () => {
    expect(
      resolveFirstPurchaseDiscount(buildSubject({ totalPurchases: 1 }))
    ).toEqual({
      available: false,
      discountPercent: 0,
      source: null
    });
  });

  it('does not reopen a redeemed discount after a full refund', () => {
    expect(
      resolveFirstPurchaseDiscount(
        buildSubject({
          totalPurchases: 0,
          firstPurchaseDiscountRedeemedAt: new Date('2026-07-29T10:00:00Z')
        })
      )
    ).toEqual({
      available: false,
      discountPercent: 0,
      source: null
    });
  });
});
