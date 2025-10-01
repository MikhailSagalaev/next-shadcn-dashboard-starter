/**
 * @file: src/features/bot-constructor/components/editors/advanced/session-editor.tsx
 * @description: Продвинутый редактор операций с сессией
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, Monaco Editor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Database,
  Plus,
  Trash2,
  Copy,
  Settings,
  Code
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { SessionConfig } from '@/types/bot-constructor';

interface SessionEditorProps {
  config: SessionConfig;
  onChange: (config: SessionConfig) => void;
  availableVariables: string[];
}

interface SessionOperation {
  id: string;
  type:
    | 'get'
    | 'set'
    | 'delete'
    | 'increment'
    | 'decrement'
    | 'merge'
    | 'clear'
    | 'exists'
    | 'custom';
  key: string;
  value?: any;
  source: 'literal' | 'variable' | 'expression' | 'function';
  condition?: string;
  description?: string;
}

const operationTypes = [
  { value: 'get', label: 'Получить значение', icon: Database, color: 'blue' },
  {
    value: 'set',
    label: 'Установить значение',
    icon: Settings,
    color: 'green'
  },
  { value: 'delete', label: 'Удалить значение', icon: Trash2, color: 'red' },
  { value: 'increment', label: 'Увеличить число', icon: Plus, color: 'purple' },
  {
    value: 'decrement',
    label: 'Уменьшить число',
    icon: Trash2,
    color: 'purple'
  },
  { value: 'merge', label: 'Объединить объекты', icon: Copy, color: 'orange' },
  { value: 'clear', label: 'Очистить сессию', icon: Trash2, color: 'red' },
  {
    value: 'exists',
    label: 'Проверить существование',
    icon: AlertCircle,
    color: 'yellow'
  },
  {
    value: 'custom',
    label: 'Пользовательская операция',
    icon: Code,
    color: 'gray'
  }
];

const sourceTypes = [
  { value: 'literal', label: 'Литерал' },
  { value: 'variable', label: 'Переменная' },
  { value: 'expression', label: 'Выражение' },
  { value: 'function', label: 'Функция' }
];

export const SessionEditor: React.FC<SessionEditorProps> = ({
  config,
  onChange,
  availableVariables
}) => {
  const [operations, setOperations] = useState<SessionOperation[]>(
    config.operations || []
  );
  const [selectedOperation, setSelectedOperation] =
    useState<SessionOperation | null>(null);

  useEffect(() => {
    onChange({
      ...config,
      operations
    });
  }, [operations]);

  const addOperation = () => {
    const newOperation: SessionOperation = {
      id: `op_${Date.now()}`,
      type: 'set',
      key: '',
      source: 'literal',
      description: ''
    };

    setOperations([...operations, newOperation]);
    setSelectedOperation(newOperation);
  };

  const updateOperation = (id: string, updates: Partial<SessionOperation>) => {
    setOperations(
      operations.map((op) => (op.id === id ? { ...op, ...updates } : op))
    );
  };

  const deleteOperation = (id: string) => {
    setOperations(operations.filter((op) => op.id !== id));
    if (selectedOperation?.id === id) {
      setSelectedOperation(null);
    }
  };

  const duplicateOperation = (operation: SessionOperation) => {
    const duplicate: SessionOperation = {
      ...operation,
      id: `op_${Date.now()}`,
      description: `${operation.description} (копия)`
    };

    setOperations([...operations, duplicate]);
    setSelectedOperation(duplicate);
  };

  const getOperationTypeInfo = (type: string) => {
    return operationTypes.find((t) => t.value === type) || operationTypes[0];
  };

  const renderOperationCard = (operation: SessionOperation) => {
    const typeInfo = getOperationTypeInfo(operation.type);
    const Icon = typeInfo.icon;

    return (
      <Card
        key={operation.id}
        className={`cursor-pointer transition-all ${
          selectedOperation?.id === operation.id ? 'ring-primary ring-2' : ''
        }`}
        onClick={() => setSelectedOperation(operation)}
      >
        <CardContent className='p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className={`rounded-lg p-2 bg-${typeInfo.color}-100`}>
                <Icon className={`h-4 w-4 text-${typeInfo.color}-600`} />
              </div>
              <div className='flex-1'>
                <h4 className='text-sm font-medium'>{typeInfo.label}</h4>
                <p className='text-muted-foreground text-xs'>
                  {operation.key || 'Ключ не указан'}
                </p>
                {operation.description && (
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {operation.description}
                  </p>
                )}
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateOperation(operation);
                }}
              >
                <Copy className='h-3 w-3' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={(e) => {
                  e.stopPropagation();
                  deleteOperation(operation.id);
                }}
              >
                <Trash2 className='h-3 w-3' />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOperationEditor = () => {
    if (!selectedOperation) {
      return (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Выберите операцию для редактирования или создайте новую
          </AlertDescription>
        </Alert>
      );
    }

    const operation = selectedOperation;

    return (
      <div className='space-y-6'>
        {/* Основные настройки */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Настройки операции</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>Тип операции</Label>
                <Select
                  value={operation.type}
                  onValueChange={(value: any) =>
                    updateOperation(operation.id, { type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operationTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Источник значения</Label>
                <Select
                  value={operation.source}
                  onValueChange={(value: any) =>
                    updateOperation(operation.id, { source: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypes.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Ключ в сессии</Label>
              <Input
                placeholder='user.name'
                value={operation.key}
                onChange={(e) =>
                  updateOperation(operation.id, { key: e.target.value })
                }
              />
            </div>

            <div className='space-y-2'>
              <Label>Описание</Label>
              <Input
                placeholder='Краткое описание операции'
                value={operation.description || ''}
                onChange={(e) =>
                  updateOperation(operation.id, { description: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Настройки значения */}
        {operation.type !== 'delete' &&
          operation.type !== 'clear' &&
          operation.type !== 'exists' && (
            <ValueEditor
              operation={operation}
              onChange={(updates) => updateOperation(operation.id, updates)}
              availableVariables={availableVariables}
            />
          )}

        {/* Условное выполнение */}
        <ConditionalExecutionEditor
          operation={operation}
          onChange={(updates) => updateOperation(operation.id, updates)}
          availableVariables={availableVariables}
        />

        {/* Специфические настройки для типов операций */}
        {renderTypeSpecificSettings(operation)}
      </div>
    );
  };

  const renderTypeSpecificSettings = (operation: SessionOperation) => {
    switch (operation.type) {
      case 'increment':
      case 'decrement':
        return (
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Настройки числа</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Шаг изменения</Label>
                <Input
                  type='number'
                  placeholder='1'
                  value={operation.value || 1}
                  onChange={(e) =>
                    updateOperation(operation.id, {
                      value: parseInt(e.target.value) || 1
                    })
                  }
                />
              </div>
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  Если значение не является числом, операция будет
                  проигнорирована.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );

      case 'merge':
        return (
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Настройки объединения</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center space-x-2'>
                <Switch
                  checked={operation.deepMerge || false}
                  onCheckedChange={(checked) =>
                    updateOperation(operation.id, { deepMerge: checked })
                  }
                />
                <Label>Глубокое объединение объектов</Label>
              </div>
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  Новые значения перезапишут существующие. Используйте глубокое
                  объединение для вложенных объектов.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );

      case 'custom':
        return (
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Пользовательский код</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>JavaScript код операции</Label>
                <Textarea
                  placeholder={`// Пример:
// const current = session.get('counter') || 0;
// session.set('counter', current + 1);
// return true;`}
                  value={operation.customCode || ''}
                  onChange={(e) =>
                    updateOperation(operation.id, {
                      customCode: e.target.value
                    })
                  }
                  rows={8}
                  className='font-mono text-sm'
                />
              </div>
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  Код выполняется в контексте операции с доступом к session и
                  переменным.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className='space-y-4'>
      <Tabs defaultValue='operations'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='operations'>Операции</TabsTrigger>
          <TabsTrigger value='editor'>Редактор</TabsTrigger>
        </TabsList>

        <TabsContent value='operations' className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-medium'>Операции с сессией</h3>
            <Button onClick={addOperation}>
              <Plus className='mr-2 h-4 w-4' />
              Добавить операцию
            </Button>
          </div>

          {operations.length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <Database className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
                <h4 className='mb-2 font-medium'>Операции не добавлены</h4>
                <p className='text-muted-foreground mb-4 text-sm'>
                  Добавьте операции для работы с данными сессии пользователя
                </p>
                <Button onClick={addOperation}>
                  <Plus className='mr-2 h-4 w-4' />
                  Добавить первую операцию
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-3'>
              {operations.map(renderOperationCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value='editor' className='space-y-4'>
          {renderOperationEditor()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Компонент для редактирования значения
const ValueEditor: React.FC<{
  operation: SessionOperation;
  onChange: (updates: Partial<SessionOperation>) => void;
  availableVariables: string[];
}> = ({ operation, onChange, availableVariables }) => (
  <Card>
    <CardHeader>
      <CardTitle className='text-lg'>Значение</CardTitle>
    </CardHeader>
    <CardContent className='space-y-4'>
      {operation.source === 'literal' && (
        <div className='space-y-2'>
          <Label>Литеральное значение</Label>
          <Input
            placeholder='Введите значение'
            value={operation.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
      )}

      {operation.source === 'variable' && (
        <div className='space-y-2'>
          <Label>Переменная</Label>
          <Select
            value={operation.value || ''}
            onValueChange={(value) => onChange({ value })}
          >
            <SelectTrigger>
              <SelectValue placeholder='Выберите переменную' />
            </SelectTrigger>
            <SelectContent>
              {availableVariables.map((variable) => (
                <SelectItem key={variable} value={variable}>
                  {variable}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {operation.source === 'expression' && (
        <div className='space-y-2'>
          <Label>Выражение JavaScript</Label>
          <Textarea
            placeholder='new Date().toISOString()'
            value={operation.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            rows={3}
            className='font-mono text-sm'
          />
        </div>
      )}

      {operation.source === 'function' && (
        <div className='space-y-2'>
          <Label>Функция JavaScript</Label>
          <Textarea
            placeholder={`(ctx, session) => {
  return ctx.from?.username || 'unknown';
}`}
            value={operation.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            rows={5}
            className='font-mono text-sm'
          />
        </div>
      )}
    </CardContent>
  </Card>
);

// Компонент для условного выполнения
const ConditionalExecutionEditor: React.FC<{
  operation: SessionOperation;
  onChange: (updates: Partial<SessionOperation>) => void;
  availableVariables: string[];
}> = ({ operation, onChange, availableVariables }) => (
  <Card>
    <CardHeader>
      <CardTitle className='text-lg'>Условное выполнение</CardTitle>
    </CardHeader>
    <CardContent className='space-y-4'>
      <div className='flex items-center space-x-2'>
        <Switch
          checked={!!operation.condition}
          onCheckedChange={(checked) =>
            onChange({ condition: checked ? '' : undefined })
          }
        />
        <Label>Выполнять только при условии</Label>
      </div>

      {operation.condition !== undefined && (
        <div className='space-y-2'>
          <Label>Условие JavaScript</Label>
          <Textarea
            placeholder={`// Примеры:
// session.get('user.authenticated') === true
// ctx.from?.id === 123456789
// variables.step > 3`}
            value={operation.condition || ''}
            onChange={(e) => onChange({ condition: e.target.value })}
            rows={3}
            className='font-mono text-sm'
          />

          <div className='text-muted-foreground text-sm'>
            <p>Доступные переменные:</p>
            <div className='mt-1 flex flex-wrap gap-1'>
              {['ctx', 'session', 'variables', ...availableVariables].map(
                (variable) => (
                  <Badge key={variable} variant='secondary' className='text-xs'>
                    {variable}
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);
