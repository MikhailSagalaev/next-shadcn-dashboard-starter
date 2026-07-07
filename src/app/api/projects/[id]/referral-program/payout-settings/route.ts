/**
 * @file: src/app/api/projects/[id]/referral-program/payout-settings/route.ts
 * @description: Настройки вывода b2b-комиссии (мин. сумма, период удержания) —
 *   отдельно от общего PUT /referral-program, потому что тот требует
 *   referrerBonus/refereeBonus (c2c-поля) и не подходит для точечного
 *   обновления только этих двух полей из вкладки «Выплаты».
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { withProjectAccess } from '@/lib/with-project-access';

const PayoutSettingsSchema = z.object({
  payoutMinAmount: z
    .number()
    .min(0, 'Минимальная сумма вывода не может быть отрицательной')
    .optional(),
  payoutHoldDays: z
    .number()
    .int()
    .min(0, 'Период удержания не может быть отрицательным')
    .max(365, 'Период удержания не может быть больше года')
    .optional()
});

export const PATCH = withProjectAccess(async (request, { projectId }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PayoutSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { payoutMinAmount, payoutHoldDays } = parsed.data;

  const updated = await db.referralProgram.upsert({
    where: { projectId },
    update: {
      ...(payoutMinAmount !== undefined ? { payoutMinAmount } : {}),
      ...(payoutHoldDays !== undefined ? { payoutHoldDays } : {})
    },
    create: {
      projectId,
      payoutMinAmount: payoutMinAmount ?? 0,
      payoutHoldDays: payoutHoldDays ?? 0
    }
  });

  return NextResponse.json({
    success: true,
    payoutMinAmount: Number(updated.payoutMinAmount),
    payoutHoldDays: updated.payoutHoldDays
  });
});
