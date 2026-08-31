import { Prisma } from '@prisma/client';

const CASH_PAYMENT_METHODS = ['cash', 'наличные'] as const;

function normalizeForComparison(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLocaleLowerCase('ru-RU')
    : '';
}

/** Cash orders are offline/unpaid and must not be treated as purchases. */
export function isCashPaymentMethod(value: unknown): boolean {
  const normalized = normalizeForComparison(value);
  return CASH_PAYMENT_METHODS.some((method) => method === normalized);
}

/** Store one canonical value so new records are filtered consistently. */
export function normalizePaymentMethod(
  value: string | null | undefined
): string | null | undefined {
  if (value === null || value === undefined) return value;
  const trimmed = value.normalize('NFKC').trim();
  if (!trimmed) return null;
  return isCashPaymentMethod(trimmed) ? 'cash' : trimmed;
}

/** Reusable Prisma condition for statistics. */
export function nonCashOrderWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { paymentMethod: null },
      {
        AND: CASH_PAYMENT_METHODS.map((method) => ({
          NOT: {
            paymentMethod: {
              equals: method,
              mode: 'insensitive' as const
            }
          }
        }))
      }
    ]
  };
}

/** Same rule for analytics endpoints that use raw SQL. */
export const NON_CASH_ORDER_SQL = Prisma.sql`
  COALESCE(LOWER(BTRIM(payment_method)), '') NOT IN ('cash', 'наличные')
`;
