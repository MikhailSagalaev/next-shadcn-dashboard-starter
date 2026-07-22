import { productNeedsSetup } from '@/features/products/components/product-catalog-types';

const baseProduct = {
  id: 'product-1',
  name: 'Крем',
  sku: 'SKU-1',
  externalId: 'tilda-1',
  gtin: '04601234567890',
  price: 1000,
  markingStatus: 'MARKED_REQUIRED' as const,
  vatCode: 4,
  paymentSubject: 'marked',
  measure: 'piece',
  stockOnHand: 10,
  stockReserved: 2
};

describe('productNeedsSetup', () => {
  it('accepts a fully configured marked product', () => {
    expect(productNeedsSetup(baseProduct)).toBe(false);
  });

  it('requires GTIN for a marked product', () => {
    expect(productNeedsSetup({ ...baseProduct, gtin: null })).toBe(true);
  });

  it('requires VAT even for a product not subject to marking', () => {
    expect(
      productNeedsSetup({
        ...baseProduct,
        markingStatus: 'NOT_SUBJECT',
        gtin: null,
        vatCode: null
      })
    ).toBe(true);
  });

  it('accepts a non-marked product without GTIN', () => {
    expect(
      productNeedsSetup({
        ...baseProduct,
        markingStatus: 'NOT_SUBJECT',
        gtin: null
      })
    ).toBe(false);
  });
});
