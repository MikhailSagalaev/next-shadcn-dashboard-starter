export type MarkingStatus =
  | 'UNKNOWN'
  | 'MARKED_REQUIRED'
  | 'LEGACY_UNMARKED_ALLOWED'
  | 'NOT_SUBJECT';

export interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  externalId: string | null;
  gtin: string | null;
  price: string | number;
  markingStatus: MarkingStatus;
  vatCode: number | null;
  paymentSubject: string | null;
  measure: string;
  stockOnHand: number;
  stockReserved: number;
}

export interface CatalogSummary {
  total: number;
  needsSetup: number;
  availableUnits: number;
}

export interface CatalogPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const MARKING_STATUS_LABELS: Record<MarkingStatus, string> = {
  UNKNOWN: 'Не определено',
  MARKED_REQUIRED: 'Требует маркировки',
  LEGACY_UNMARKED_ALLOWED: 'Старый немаркированный остаток',
  NOT_SUBJECT: 'Не подлежит маркировке'
};

export function productNeedsSetup(product: ProductRow) {
  return (
    product.markingStatus === 'UNKNOWN' ||
    !product.vatCode ||
    (product.markingStatus === 'MARKED_REQUIRED' && !product.gtin)
  );
}
