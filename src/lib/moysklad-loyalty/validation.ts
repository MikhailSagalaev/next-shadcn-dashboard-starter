/**
 * @file: validation.ts
 * @description: Zod схемы для валидации запросов МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

const MetaSchema = z.object({
  id: z.string(),
  href: z.string().optional(),
  type: z.string().optional()
});

const AgentSchema = z.object({
  meta: MetaSchema,
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  cardNumber: z.string().optional()
});

const PositionSchema = z.object({
  id: z.string().optional(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  assortment: z
    .object({
      meta: MetaSchema,
      name: z.string()
    })
    .optional()
});

const TransactionTypeSchema = z.enum(['EARNING', 'SPENDING']);

// ============================================================================
// Phone Number Validation
// ============================================================================

// Поддерживаемые форматы: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX
export const PhoneNumberSchema = z.string().refine(
  (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return (
      cleaned.length === 11 &&
      (cleaned.startsWith('7') || cleaned.startsWith('8'))
    );
  },
  {
    message:
      'Неверный формат номера телефона. Ожидается: +7XXXXXXXXXX, 8XXXXXXXXXX или 7XXXXXXXXXX'
  }
);

// ============================================================================
// Request Schemas
// ============================================================================

// POST /counterparty - Create customer
export const CreateCounterpartyRequestSchema = z
  .object({
    name: z.string().min(1, 'Имя обязательно'),
    phone: PhoneNumberSchema.optional(),
    email: z.string().email('Неверный формат email').optional(),
    cardNumber: z.string().optional()
  })
  .refine((data) => data.phone || data.email || data.cardNumber, {
    message: 'Необходимо указать хотя бы один из: phone, email, cardNumber'
  });

// GET /counterparty - Search customer
export const SearchCounterpartyRequestSchema = z.object({
  search: z.string().min(1, 'Параметр search обязателен'),
  retailStoreId: z.string().optional()
});

// POST /counterparty/detail - Get balance
export const GetBalanceRequestSchema = z.object({
  meta: MetaSchema
});

// POST /counterparty/verify - Request verification code
export const RequestVerificationCodeRequestSchema = z.object({
  meta: MetaSchema,
  operationType: z.literal('SPENDING')
});

// POST /retaildemand/recalc - Calculate discounts
export const RecalcRequestSchema = z.object({
  agent: AgentSchema,
  positions: z.array(PositionSchema).min(1, 'Необходима хотя бы одна позиция'),
  transactionType: TransactionTypeSchema,
  bonusProgram: z
    .object({
      spentBonus: z.number().nonnegative().optional()
    })
    .optional()
});

// POST /retaildemand/verify - Verify spending
export const VerifySpendingRequestSchema = z.object({
  meta: MetaSchema,
  bonusAmount: z.number().positive('Сумма бонусов должна быть положительной'),
  verificationCode: z
    .string()
    .length(6, 'Код верификации должен содержать 6 цифр')
});

// POST /retaildemand - Create sale
export const CreateSaleRequestSchema = z.object({
  agent: AgentSchema,
  positions: z.array(PositionSchema).min(1, 'Необходима хотя бы одна позиция'),
  sum: z.number().positive('Сумма должна быть положительной'),
  transactionType: TransactionTypeSchema,
  bonusProgram: z
    .object({
      earnedBonus: z.number().nonnegative().optional(),
      spentBonus: z.number().nonnegative().optional()
    })
    .optional(),
  meta: MetaSchema.optional()
});

// POST /retailsalesreturn - Create return
export const CreateReturnRequestSchema = z.object({
  agent: AgentSchema,
  positions: z.array(PositionSchema).min(1, 'Необходима хотя бы одна позиция'),
  sum: z.number().positive('Сумма должна быть положительной'),
  demand: z
    .object({
      meta: MetaSchema
    })
    .optional()
});

// GET /giftcard - Search gift card
export const SearchGiftCardRequestSchema = z.object({
  name: z.string().min(1, 'Код подарочной карты обязателен')
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}
