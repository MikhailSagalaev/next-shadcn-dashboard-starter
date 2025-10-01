/**
 * @file: src/features/bot-constructor/components/editors/condition-editor.tsx
 * @description: Продвинутый редактор условий с визуальным конструктором логики
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, Logic tree visualization
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  X,
  GitBranch,
  ArrowRight,
  CheckCircle,
  XCircle,
  Settings,
  Variable,
  Hash,
  Type,
  Calendar,
  DollarSign
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

import type { ConditionConfig } from '@/types/bot-constructor';

interface ConditionEditorProps {
  config: ConditionConfig;
  onChange: (config: ConditionConfig) => void;
  availableVariables?: string[];
}

interface LogicCondition {
  id: string;
  variable: string;
  operator: ConditionConfig['operator'];
  value: any;
  type: 'condition';
}

interface LogicGroup {
  id: string;
  operator: 'AND' | 'OR';
  conditions: (LogicCondition | LogicGroup)[];
  type: 'group';
}

type LogicNode = LogicCondition | LogicGroup;

// Predefined variable types for better UX
const variableTypes = [
  {
    label: 'Пользовательские данные',
    icon: Variable,
    color: 'text-blue-500',
    vars: ['userId', 'userName', 'firstName', 'lastName', 'languageCode']
  },
  {
    label: 'Сообщения',
    icon: Hash,
    color: 'text-green-500',
    vars: ['messageText', 'messageId', 'chatId', 'date', 'messageType']
  },
  {
    label: 'Бонусная система',
    icon: DollarSign,
    color: 'text-yellow-500',
    vars: ['bonusBalance', 'totalEarned', 'totalSpent', 'level', 'isActive']
  },
  {
    label: 'Время и дата',
    icon: Calendar,
    color: 'text-purple-500',
    vars: [
      'currentHour',
      'currentDay',
      'currentMonth',
      'currentYear',
      'timestamp'
    ]
  },
  {
    label: 'Технические',
    icon: Settings,
    color: 'text-gray-500',
    vars: ['platform', 'browser', 'ip', 'country', 'city']
  }
];

const operators = [
  {
    value: 'equals',
    label: 'Равно (=)',
    types: ['string', 'number', 'boolean']
  },
  {
    value: 'not_equals',
    label: 'Не равно (≠)',
    types: ['string', 'number', 'boolean']
  },
  { value: 'contains', label: 'Содержит', types: ['string'] },
  { value: 'not_contains', label: 'Не содержит', types: ['string'] },
  { value: 'greater', label: 'Больше (>)', types: ['number'] },
  { value: 'less', label: 'Меньше (<)', types: ['number'] },
  { value: 'greater_equal', label: 'Больше или равно (≥)', types: ['number'] },
  { value: 'less_equal', label: 'Меньше или равно (≤)', types: ['number'] },
  { value: 'regex', label: 'Регулярное выражение', types: ['string'] },
  { value: 'in_array', label: 'В массиве', types: ['string', 'number'] },
  { value: 'is_empty', label: 'Пустое', types: ['string'] },
  { value: 'is_not_empty', label: 'Не пустое', types: ['string'] }
];

export function ConditionEditor({
  config,
  onChange,
  availableVariables = []
}: ConditionEditorProps) {
  const [logicTree, setLogicTree] = useState<LogicNode>({
    id: 'root',
    operator: 'AND',
    conditions: [
      {
        id: 'cond-1',
        variable: config.variable || '',
        operator: config.operator || 'equals',
        value: config.value || '',
        type: 'condition'
      }
    ],
    type: 'group'
  });

  const [caseSensitive, setCaseSensitive] = useState(
    config.caseSensitive || false
  );

  // Update parent config
  const updateConfig = useCallback(() => {
    if (logicTree.type === 'group' && logicTree.conditions.length > 0) {
      const firstCondition = logicTree.conditions[0];
      if (firstCondition.type === 'condition') {
        onChange({
          variable: firstCondition.variable,
          operator: firstCondition.operator,
          value: firstCondition.value,
          trueNodeId: config.trueNodeId,
          falseNodeId: config.falseNodeId,
          caseSensitive
        });
      }
    }
  }, [
    logicTree,
    config.trueNodeId,
    config.falseNodeId,
    caseSensitive,
    onChange
  ]);

  // Add condition to group
  const addCondition = useCallback((groupId: string) => {
    const newCondition: LogicCondition = {
      id: `cond-${Date.now()}`,
      variable: '',
      operator: 'equals',
      value: '',
      type: 'condition'
    };

    setLogicTree((prev) =>
      updateNodeInTree(prev, groupId, (group) => {
        if (group.type === 'group') {
          return {
            ...group,
            conditions: [...group.conditions, newCondition]
          };
        }
        return group;
      })
    );
  }, []);

  // Update condition
  const updateCondition = useCallback(
    (conditionId: string, updates: Partial<LogicCondition>) => {
      setLogicTree((prev) =>
        updateNodeInTree(prev, conditionId, (node) => {
          if (node.type === 'condition') {
            return { ...node, ...updates };
          }
          return node;
        })
      );
    },
    []
  );

  // Remove condition
  const removeCondition = useCallback((conditionId: string) => {
    setLogicTree((prev) => removeNodeFromTree(prev, conditionId));
  }, []);

  // Helper functions for tree manipulation
  const updateNodeInTree = (
    node: LogicNode,
    targetId: string,
    updater: (node: LogicNode) => LogicNode
  ): LogicNode => {
    if (node.id === targetId) {
      return updater(node);
    }

    if (node.type === 'group') {
      return {
        ...node,
        conditions: node.conditions.map((cond) =>
          updateNodeInTree(cond, targetId, updater)
        )
      };
    }

    return node;
  };

  const removeNodeFromTree = (node: LogicNode, targetId: string): LogicNode => {
    if (node.type === 'group') {
      return {
        ...node,
        conditions: node.conditions
          .filter((cond) => cond.id !== targetId)
          .map((cond) => removeNodeFromTree(cond, targetId))
      };
    }

    return node;
  };

  // Render logic node
  const renderLogicNode = (node: LogicNode, depth = 0): React.ReactNode => {
    const indent = depth * 20;

    if (node.type === 'group') {
      return (
        <div key={node.id} style={{ marginLeft: indent }}>
          <Card className='mb-2'>
            <CardContent className='p-3'>
              <div className='mb-2 flex items-center space-x-2'>
                <GitBranch className='h-4 w-4 text-orange-500' />
                <Select
                  value={node.operator}
                  onValueChange={(value) =>
                    setLogicTree((prev) =>
                      updateNodeInTree(prev, node.id, (n) =>
                        n.type === 'group'
                          ? { ...n, operator: value as 'AND' | 'OR' }
                          : n
                      )
                    )
                  }
                >
                  <SelectTrigger className='w-20'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='AND'>И</SelectItem>
                    <SelectItem value='OR'>ИЛИ</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => addCondition(node.id)}
                >
                  <Plus className='mr-1 h-4 w-4' />
                  Условие
                </Button>
              </div>

              <div className='space-y-2'>
                {node.conditions.map((condition, index) => (
                  <div
                    key={condition.id}
                    className='flex items-center space-x-2'
                  >
                    {index > 0 && (
                      <Badge variant='outline' className='text-xs'>
                        {node.operator}
                      </Badge>
                    )}
                    <div className='flex-1'>
                      {renderLogicNode(condition, depth + 1)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Render condition
    return (
      <Card key={node.id} className='mb-2' style={{ marginLeft: indent }}>
        <CardContent className='p-3'>
          <div className='flex items-center space-x-2'>
            <div className='grid flex-1 grid-cols-3 gap-2'>
              {/* Variable selector */}
              <div>
                <Label className='text-xs'>Переменная</Label>
                <Select
                  value={node.variable}
                  onValueChange={(value) =>
                    updateCondition(node.id, { variable: value })
                  }
                >
                  <SelectTrigger className='h-8'>
                    <SelectValue placeholder='Выберите...' />
                  </SelectTrigger>
                  <SelectContent>
                    {variableTypes.map((type) => (
                      <optgroup key={type.label} label={type.label}>
                        {type.vars.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </optgroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operator selector */}
              <div>
                <Label className='text-xs'>Оператор</Label>
                <Select
                  value={node.operator}
                  onValueChange={(value) =>
                    updateCondition(node.id, { operator: value as any })
                  }
                >
                  <SelectTrigger className='h-8'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value input */}
              <div>
                <Label className='text-xs'>Значение</Label>
                <Input
                  value={node.value}
                  onChange={(e) =>
                    updateCondition(node.id, { value: e.target.value })
                  }
                  className='h-8'
                  placeholder='Значение...'
                />
              </div>
            </div>

            <Button
              variant='destructive'
              size='sm'
              onClick={() => removeCondition(node.id)}
              className='ml-2'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className='space-y-4'>
      {/* Logic Tree */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center justify-between text-sm'>
            Логика условия
            <Badge variant='outline'>Визуальный конструктор</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>{renderLogicNode(logicTree)}</CardContent>
      </Card>

      {/* Quick Variables */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Быстрый выбор переменных</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {variableTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div key={type.label} className='space-y-2'>
                  <div className='flex items-center space-x-2'>
                    <Icon className={`h-4 w-4 ${type.color}`} />
                    <span className='text-sm font-medium'>{type.label}</span>
                  </div>
                  <div className='grid grid-cols-2 gap-1'>
                    {type.vars.slice(0, 4).map((v) => (
                      <Button
                        key={v}
                        variant='outline'
                        size='sm'
                        className='h-6 justify-start text-xs'
                        onClick={() => {
                          if (
                            logicTree.type === 'group' &&
                            logicTree.conditions.length > 0
                          ) {
                            const firstCond = logicTree.conditions[0];
                            if (firstCond.type === 'condition') {
                              updateCondition(firstCond.id, { variable: v });
                            }
                          }
                        }}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Настройки</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center space-x-2'>
            <Switch
              checked={caseSensitive}
              onCheckedChange={setCaseSensitive}
            />
            <Label className='text-sm'>Учитывать регистр</Label>
          </div>

          <Separator />

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label className='text-sm'>При успехе перейти к ноде</Label>
              <Input
                value={config.trueNodeId || ''}
                onChange={(e) =>
                  onChange({ ...config, trueNodeId: e.target.value })
                }
                placeholder='ID ноды...'
              />
            </div>

            <div>
              <Label className='text-sm'>При неудаче перейти к ноде</Label>
              <Input
                value={config.falseNodeId || ''}
                onChange={(e) =>
                  onChange({ ...config, falseNodeId: e.target.value })
                }
                placeholder='ID ноды...'
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Превью условия</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg bg-gray-50 p-4 dark:bg-gray-800'>
            <div className='space-y-2 text-sm'>
              <div className='flex items-center space-x-2'>
                <span>Если</span>
                <Badge variant='outline'>
                  {logicTree.type === 'group' && logicTree.conditions.length > 0
                    ? (logicTree.conditions[0] as any).variable || 'переменная'
                    : 'переменная'}
                </Badge>
                <span>
                  {logicTree.type === 'group' && logicTree.conditions.length > 0
                    ? operators.find(
                        (op) =>
                          op.value === (logicTree.conditions[0] as any).operator
                      )?.label || '='
                    : '='}
                </span>
                <Badge variant='outline'>
                  {logicTree.type === 'group' && logicTree.conditions.length > 0
                    ? (logicTree.conditions[0] as any).value || 'значение'
                    : 'значение'}
                </Badge>
              </div>

              <div className='mt-4 flex items-center space-x-4'>
                <div className='flex items-center space-x-2'>
                  <CheckCircle className='h-4 w-4 text-green-500' />
                  <span className='text-sm'>
                    True → Нода {config.trueNodeId || 'не указана'}
                  </span>
                </div>

                <ArrowRight className='h-4 w-4 text-gray-400' />

                <div className='flex items-center space-x-2'>
                  <XCircle className='h-4 w-4 text-red-500' />
                  <span className='text-sm'>
                    False → Нода {config.falseNodeId || 'не указана'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className='flex justify-end'>
        <Button onClick={updateConfig}>Применить изменения</Button>
      </div>
    </div>
  );
}
