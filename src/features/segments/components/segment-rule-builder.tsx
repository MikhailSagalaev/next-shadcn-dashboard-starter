/**
 * @file: src/features/segments/components/segment-rule-builder.tsx
 * @description: Визуальный конструктор условий сегментации
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface SegmentRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
  conditions?: SegmentRule[];
}

interface SegmentRuleBuilderProps {
  rules: SegmentRule | SegmentRule[];
  onChange: (rules: SegmentRule | SegmentRule[]) => void;
}

const AVAILABLE_FIELDS = [
  { value: 'user.email', label: 'Email' },
  { value: 'user.phone', label: 'Телефон' },
  { value: 'user.firstName', label: 'Имя' },
  { value: 'user.lastName', label: 'Фамилия' },
  { value: 'user.totalPurchases', label: 'Общая сумма покупок' },
  { value: 'user.activeBonuses', label: 'Активные бонусы' },
  { value: 'user.currentLevel', label: 'Текущий уровень' },
  { value: 'orders.count', label: 'Количество заказов' },
  { value: 'orders.totalAmount', label: 'Сумма заказов' },
];

const OPERATORS = {
  equals: { label: 'Равно', type: 'text' },
  not_equals: { label: 'Не равно', type: 'text' },
  contains: { label: 'Содержит', type: 'text' },
  greater_than: { label: 'Больше', type: 'number' },
  less_than: { label: 'Меньше', type: 'number' },
  in: { label: 'В списке', type: 'array' },
  not_in: { label: 'Не в списке', type: 'array' },
};

export function SegmentRuleBuilder({ rules, onChange }: SegmentRuleBuilderProps) {
  const [rulesArray, setRulesArray] = useState<SegmentRule[]>(
    Array.isArray(rules) ? rules : rules ? [rules] : []
  );
  const [logicalOperator, setLogicalOperator] = useState<'AND' | 'OR'>('AND');

  const updateRules = (newRules: SegmentRule[]) => {
    setRulesArray(newRules);
    if (newRules.length === 0) {
      onChange([]);
    } else if (newRules.length === 1) {
      onChange(newRules[0]);
    } else {
      onChange(newRules.map((r) => ({ ...r, logicalOperator })));
    }
  };

  const addRule = () => {
    const newRule: SegmentRule = {
      field: 'user.email',
      operator: 'equals',
      value: '',
    };
    updateRules([...rulesArray, newRule]);
  };

  const updateRule = (index: number, updates: Partial<SegmentRule>) => {
    const newRules = [...rulesArray];
    newRules[index] = { ...newRules[index], ...updates };
    updateRules(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = rulesArray.filter((_, i) => i !== index);
    updateRules(newRules);
  };

  const getOperatorType = (operator: string) => {
    return OPERATORS[operator as keyof typeof OPERATORS]?.type || 'text';
  };

  const renderValueInput = (rule: SegmentRule, index: number) => {
    const operatorType = getOperatorType(rule.operator);

    if (operatorType === 'array') {
      return (
        <Input
          placeholder='Введите значения через запятую'
          value={Array.isArray(rule.value) ? rule.value.join(', ') : rule.value || ''}
          onChange={(e) => {
            const values = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
            updateRule(index, { value: values });
          }}
        />
      );
    }

    if (operatorType === 'number') {
      return (
        <Input
          type='number'
          value={rule.value || ''}
          onChange={(e) => updateRule(index, { value: parseFloat(e.target.value) || 0 })}
        />
      );
    }

    return (
      <Input
        value={rule.value || ''}
        onChange={(e) => updateRule(index, { value: e.target.value })}
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Условия сегмента</CardTitle>
          <div className='flex items-center gap-2'>
            {rulesArray.length > 1 && (
              <Select
                value={logicalOperator}
                onValueChange={(value: 'AND' | 'OR') => {
                  setLogicalOperator(value);
                  updateRules(rulesArray.map((r) => ({ ...r, logicalOperator: value })));
                }}
              >
                <SelectTrigger className='w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='AND'>И (AND)</SelectItem>
                  <SelectItem value='OR'>ИЛИ (OR)</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={addRule} size='sm' variant='outline'>
              <Plus className='mr-2 h-4 w-4' />
              Добавить условие
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {rulesArray.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            <p>Нет условий. Нажмите &quot;Добавить условие&quot; чтобы начать.</p>
          </div>
        ) : (
          rulesArray.map((rule, index) => (
            <Card key={index} className='p-4'>
              <div className='flex items-start gap-4'>
                <div className='flex-1 grid grid-cols-4 gap-4'>
                  <div>
                    <Label>Поле</Label>
                    <Select
                      value={rule.field}
                      onValueChange={(value) => updateRule(index, { field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Оператор</Label>
                    <Select
                      value={rule.operator}
                      onValueChange={(value: SegmentRule['operator']) =>
                        updateRule(index, { operator: value, value: '' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(OPERATORS).map(([key, op]) => (
                          <SelectItem key={key} value={key}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='col-span-2'>
                    <Label>Значение</Label>
                    {renderValueInput(rule, index)}
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => removeRule(index)}
                  className='mt-8'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            </Card>
          ))
        )}
        {rulesArray.length > 1 && (
          <div className='flex items-center justify-center pt-2'>
            <Badge variant='secondary'>
              Все условия должны выполняться через &quot;{logicalOperator}&quot;
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

