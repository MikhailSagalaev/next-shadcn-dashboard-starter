/**
 * @file: src/features/bot-constructor/components/editors/database-query-editor.tsx
 * @description: Редактор для настройки action.database_query ноды
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, API
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Plus, Trash2, Info } from 'lucide-react';

interface DatabaseQuery {
  id: string;
  name: string;
  description: string;
  parameters: string[];
}

interface DatabaseQueryConfig {
  query: string;
  parameters: Record<string, any>;
  assignTo?: string;
  resultMapping?: Record<string, string>;
}

interface DatabaseQueryEditorProps {
  config: DatabaseQueryConfig;
  onChange: (config: DatabaseQueryConfig) => void;
}

export function DatabaseQueryEditor({ config, onChange }: DatabaseQueryEditorProps) {
  const [availableQueries, setAvailableQueries] = useState<DatabaseQuery[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<DatabaseQuery | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>(config.parameters || {});
  const [assignTo, setAssignTo] = useState(config.assignTo || '');
  const [resultMapping, setResultMapping] = useState<Record<string, string>>(config.resultMapping || {});

  // Загружаем доступные запросы
  useEffect(() => {
    const fetchQueries = async () => {
      try {
        const response = await fetch('/api/workflow/database-queries');
        const data = await response.json();
        setAvailableQueries(data.queries);
        
        // Находим выбранный запрос
        if (config.query) {
          const query = data.queries.find((q: DatabaseQuery) => q.id === config.query);
          setSelectedQuery(query || null);
        }
      } catch (error) {
        console.error('Failed to fetch database queries:', error);
      }
    };

    fetchQueries();
  }, [config.query]);

  // Обновляем параметры при изменении выбранного запроса
  useEffect(() => {
    if (selectedQuery) {
      const newParameters: Record<string, string> = {};
      selectedQuery.parameters.forEach(param => {
        newParameters[param] = parameters[param] || '';
      });
      setParameters(newParameters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuery]);

  // Обновляем родительский компонент при изменениях
  useEffect(() => {
    onChange({
      query: selectedQuery?.id || '',
      parameters,
      assignTo,
      resultMapping
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuery, parameters, assignTo, resultMapping]);

  const handleParameterChange = (key: string, value: string) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const addResultMapping = () => {
    setResultMapping(prev => ({
      ...prev,
      '': ''
    }));
  };

  const updateResultMapping = (oldKey: string, newKey: string, value: string) => {
    setResultMapping(prev => {
      const newMapping = { ...prev };
      if (oldKey !== newKey) {
        delete newMapping[oldKey];
      }
      if (newKey && value) {
        newMapping[newKey] = value;
      }
      return newMapping;
    });
  };

  const removeResultMapping = (key: string) => {
    setResultMapping(prev => {
      const newMapping = { ...prev };
      delete newMapping[key];
      return newMapping;
    });
  };

  return (
    <div className='space-y-4'>
      {/* Выбор запроса */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm flex items-center gap-2'>
            <Info className='h-4 w-4' />
            Выбор запроса
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 pt-2'>
          <div>
            <Label>Тип запроса</Label>
            <Select
              value={selectedQuery?.id || ''}
              onValueChange={(value) => {
                const query = availableQueries.find(q => q.id === value);
                setSelectedQuery(query || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип запроса..." />
              </SelectTrigger>
              <SelectContent>
                {availableQueries.map(query => (
                  <SelectItem key={query.id} value={query.id}>
                    <div className='flex flex-col'>
                      <span className='font-medium'>{query.name}</span>
                      <span className='text-xs text-muted-foreground'>{query.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedQuery && (
            <div className='rounded-lg bg-muted p-3'>
              <div className='flex items-start gap-2'>
                <Info className='h-4 w-4 mt-0.5 text-muted-foreground' />
                <div className='flex-1'>
                  <p className='text-sm font-medium'>{selectedQuery.description}</p>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {selectedQuery.parameters.map(param => (
                      <Badge key={param} variant='secondary' className='text-xs'>
                        {param}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Параметры запроса */}
      {selectedQuery && selectedQuery.parameters.length > 0 && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Параметры запроса</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 pt-2'>
            {selectedQuery.parameters.map(param => (
              <div key={param}>
                <Label htmlFor={`param-${param}`}>
                  {param}
                  {param === 'projectId' && (
                    <Badge variant='outline' className='ml-2 text-xs'>Автоматически</Badge>
                  )}
                </Label>
                <Input
                  id={`param-${param}`}
                  value={parameters[param] || ''}
                  onChange={(e) => handleParameterChange(param, e.target.value)}
                  placeholder={param === 'projectId' ? 'Добавляется автоматически' : `Введите ${param}`}
                  disabled={param === 'projectId'}
                  className='mt-1'
                />
                {param !== 'projectId' && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Используйте переменные: {`{{telegram.userId}}`, `{{user.id}}`, `{{telegram.contact.phone}}`}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Сохранение результата */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm'>Сохранение результата</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 pt-2'>
          <div>
            <Label htmlFor='assignTo'>Сохранить результат в переменную</Label>
            <Input
              id='assignTo'
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              placeholder='user'
              className='mt-1'
            />
            <p className='text-xs text-muted-foreground mt-1'>
              Результат запроса будет сохранен в переменную с указанным именем
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Маппинг результатов */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm flex items-center justify-between'>
            Маппинг результатов
            <Button
              size='sm'
              variant='outline'
              onClick={addResultMapping}
            >
              <Plus className='h-3 w-3 mr-1' />
              Добавить
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 pt-2'>
          {Object.entries(resultMapping).map(([key, value]) => (
            <div key={key} className='flex items-center gap-2'>
              <Input
                placeholder='Поле результата'
                value={key}
                onChange={(e) => updateResultMapping(key, e.target.value, value)}
                className='flex-1'
              />
              <span className='text-muted-foreground'>→</span>
              <Input
                placeholder='Имя переменной'
                value={value}
                onChange={(e) => updateResultMapping(key, key, e.target.value)}
                className='flex-1'
              />
              <Button
                size='sm'
                variant='ghost'
                onClick={() => removeResultMapping(key)}
              >
                <Trash2 className='h-3 w-3' />
              </Button>
            </div>
          ))}
          {Object.keys(resultMapping).length === 0 && (
            <p className='text-sm text-muted-foreground'>
              Маппинг позволяет сохранить отдельные поля результата в разные переменные
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
