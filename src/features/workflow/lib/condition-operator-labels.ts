/**
 * @file: src/features/workflow/lib/condition-operator-labels.ts
 * @description: Человекочитаемые подписи операторов условия — единый
 *   источник для выпадающего списка в редакторе свойств
 *   (workflow-properties.tsx) и для текста на самой ноде (condition-node.tsx).
 *   Раньше эти два места держали текст порознь, и нода в итоге показывала
 *   admin'у сырой код (`equals`, `is_not_empty`) вместо готовых подписей.
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */
import type { ConditionConfig } from '@/types/workflow';

type Operator = NonNullable<ConditionConfig['operator']>;

/**
 * Подписи для операторов, которые реально предлагает выпадающий список в
 * workflow-properties.tsx. Символьные алиасы (`==`, `!==`, `>=`, ...)
 * из ConditionConfig не выбираемы через UI сегодня, но могут прийти из
 * старых/импортированных сценариев — тоже покрыты, чтобы не показывать
 * голый код и для них.
 */
export const CONDITION_OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'Равно (===)',
  not_equals: 'Не равно (!==)',
  contains: 'Содержит',
  not_contains: 'Не содержит',
  greater: 'Больше (>)',
  less: 'Меньше (<)',
  is_empty: 'Пустое',
  is_not_empty: 'Не пустое',
  '==': 'Равно (==)',
  '!=': 'Не равно (!=)',
  '===': 'Равно (===)',
  '!==': 'Не равно (!==)',
  '>': 'Больше (>)',
  '<': 'Меньше (<)',
  '>=': 'Больше или равно (>=)',
  '<=': 'Меньше или равно (<=)'
};

/** Порядок и подмножество, которое реально показывается в `<select>`. */
export const CONDITION_OPERATOR_SELECT_OPTIONS: Array<{
  value: Operator;
  label: string;
}> = (
  [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater',
    'less',
    'is_empty',
    'is_not_empty'
  ] as const
).map((value) => ({ value, label: CONDITION_OPERATOR_LABELS[value] }));

export function formatConditionOperator(operator?: string): string {
  if (!operator) return operator ?? '';
  return CONDITION_OPERATOR_LABELS[operator as Operator] ?? operator;
}
