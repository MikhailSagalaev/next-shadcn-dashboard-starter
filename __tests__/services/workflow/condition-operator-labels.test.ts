/**
 * @file: __tests__/services/workflow/condition-operator-labels.test.ts
 * @description: Unit тесты для formatConditionOperator / CONDITION_OPERATOR_SELECT_OPTIONS
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

import {
  CONDITION_OPERATOR_LABELS,
  CONDITION_OPERATOR_SELECT_OPTIONS,
  formatConditionOperator
} from '@/features/workflow/lib/condition-operator-labels';

describe('formatConditionOperator', () => {
  it('translates every operator the property editor dropdown offers', () => {
    expect(formatConditionOperator('equals')).toBe('Равно (===)');
    expect(formatConditionOperator('not_equals')).toBe('Не равно (!==)');
    expect(formatConditionOperator('contains')).toBe('Содержит');
    expect(formatConditionOperator('not_contains')).toBe('Не содержит');
    expect(formatConditionOperator('greater')).toBe('Больше (>)');
    expect(formatConditionOperator('less')).toBe('Меньше (<)');
    expect(formatConditionOperator('is_empty')).toBe('Пустое');
    expect(formatConditionOperator('is_not_empty')).toBe('Не пустое');
  });

  it('falls back to the raw value for an unknown operator instead of throwing', () => {
    expect(formatConditionOperator('made_up_operator')).toBe(
      'made_up_operator'
    );
  });

  it('returns an empty string for undefined', () => {
    expect(formatConditionOperator(undefined)).toBe('');
  });
});

describe('CONDITION_OPERATOR_SELECT_OPTIONS', () => {
  it('matches the 8 options currently hardcoded in workflow-properties.tsx', () => {
    expect(CONDITION_OPERATOR_SELECT_OPTIONS.map((o) => o.value)).toEqual([
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'greater',
      'less',
      'is_empty',
      'is_not_empty'
    ]);
  });
});

describe('CONDITION_OPERATOR_LABELS', () => {
  it('has an entry for every operator declared in ConditionConfig', () => {
    // Compile-time enforcement lives in the Record<Operator, string> type;
    // this is a smoke check that the object was not hollowed out at runtime.
    expect(Object.keys(CONDITION_OPERATOR_LABELS).length).toBe(16);
  });
});
