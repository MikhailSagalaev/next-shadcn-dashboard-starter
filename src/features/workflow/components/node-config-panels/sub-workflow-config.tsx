/**
 * @file: src/features/workflow/components/node-config-panels/sub-workflow-config.tsx
 * @description: Компонент конфигурации для ноды flow.sub_workflow
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, lucide-react
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Workflow,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SubWorkflowFlowConfig } from '@/types/workflow';

interface WorkflowOption {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  versions: {
    version: number;
    isActive: boolean;
  }[];
}

interface SubWorkflowConfigProps {
  config: SubWorkflowFlowConfig | undefined;
  onChange: (config: SubWorkflowFlowConfig) => void;
  projectId: string;
  currentWorkflowId?: string;
}

interface MappingEntry {
  key: string;
  value: string;
}

export function SubWorkflowConfig({
  config,
  onChange,
  projectId,
  currentWorkflowId
}: SubWorkflowConfigProps) {
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputMappingOpen, setInputMappingOpen] = useState(true);
  const [outputMappingOpen, setOutputMappingOpen] = useState(true);

  // Локальное состояние для маппингов
  const [inputMappings, setInputMappings] = useState<MappingEntry[]>([]);
  const [outputMappings, setOutputMappings] = useState<MappingEntry[]>([]);

  // Загрузка списка workflow
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/${projectId}/workflows`);
        if (!response.ok) {
          throw new Error('Failed to fetch workflows');
        }

        const data = await response.json();

        // Фильтруем текущий workflow, чтобы избежать рекурсии
        const filteredWorkflows = (data.workflows || [])
          .filter((w: WorkflowOption) => w.id !== currentWorkflowId)
          .map((w: any) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            isActive: w.isActive,
            versions: w.versions || []
          }));

        setWorkflows(filteredWorkflows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchWorkflows();
    }
  }, [projectId, currentWorkflowId]);

  // Инициализация маппингов из config
  useEffect(() => {
    if (config?.inputMapping) {
      setInputMappings(
        Object.entries(config.inputMapping).map(([key, value]) => ({
          key,
          value
        }))
      );
    } else {
      setInputMappings([]);
    }

    if (config?.outputMapping) {
      setOutputMappings(
        Object.entries(config.outputMapping).map(([key, value]) => ({
          key,
          value
        }))
      );
    } else {
      setOutputMappings([]);
    }
  }, [config?.inputMapping, config?.outputMapping]);

  // Обработчик изменения workflow
  const handleWorkflowChange = useCallback(
    (workflowId: string) => {
      onChange({
        ...config,
        workflowId,
        version: undefined // Сбрасываем версию при смене workflow
      });
    },
    [config, onChange]
  );

  // Обработчик изменения версии
  const handleVersionChange = useCallback(
    (version: string) => {
      onChange({
        ...config,
        workflowId: config?.workflowId || '',
        version: version === 'active' ? undefined : parseInt(version)
      });
    },
    [config, onChange]
  );

  // Обработчики для input mapping
  const addInputMapping = useCallback(() => {
    setInputMappings((prev) => [...prev, { key: '', value: '' }]);
  }, []);

  const updateInputMapping = useCallback(
    (index: number, field: 'key' | 'value', newValue: string) => {
      setInputMappings((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: newValue };

        // Обновляем config
        const mapping: Record<string, string> = {};
        updated.forEach((m) => {
          if (m.key && m.value) {
            mapping[m.key] = m.value;
          }
        });

        onChange({
          ...config,
          workflowId: config?.workflowId || '',
          inputMapping: Object.keys(mapping).length > 0 ? mapping : undefined
        });

        return updated;
      });
    },
    [config, onChange]
  );

  const removeInputMapping = useCallback(
    (index: number) => {
      setInputMappings((prev) => {
        const updated = prev.filter((_, i) => i !== index);

        // Обновляем config
        const mapping: Record<string, string> = {};
        updated.forEach((m) => {
          if (m.key && m.value) {
            mapping[m.key] = m.value;
          }
        });

        onChange({
          ...config,
          workflowId: config?.workflowId || '',
          inputMapping: Object.keys(mapping).length > 0 ? mapping : undefined
        });

        return updated;
      });
    },
    [config, onChange]
  );

  // Обработчики для output mapping
  const addOutputMapping = useCallback(() => {
    setOutputMappings((prev) => [...prev, { key: '', value: '' }]);
  }, []);

  const updateOutputMapping = useCallback(
    (index: number, field: 'key' | 'value', newValue: string) => {
      setOutputMappings((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: newValue };

        // Обновляем config
        const mapping: Record<string, string> = {};
        updated.forEach((m) => {
          if (m.key && m.value) {
            mapping[m.key] = m.value;
          }
        });

        onChange({
          ...config,
          workflowId: config?.workflowId || '',
          outputMapping: Object.keys(mapping).length > 0 ? mapping : undefined
        });

        return updated;
      });
    },
    [config, onChange]
  );

  const removeOutputMapping = useCallback(
    (index: number) => {
      setOutputMappings((prev) => {
        const updated = prev.filter((_, i) => i !== index);

        // Обновляем config
        const mapping: Record<string, string> = {};
        updated.forEach((m) => {
          if (m.key && m.value) {
            mapping[m.key] = m.value;
          }
        });

        onChange({
          ...config,
          workflowId: config?.workflowId || '',
          outputMapping: Object.keys(mapping).length > 0 ? mapping : undefined
        });

        return updated;
      });
    },
    [config, onChange]
  );

  // Получаем выбранный workflow
  const selectedWorkflow = workflows.find((w) => w.id === config?.workflowId);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        <span className='text-muted-foreground ml-2'>Загрузка workflow...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>Ошибка загрузки workflow: {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Выбор workflow */}
      <div className='space-y-2'>
        <Label htmlFor='subWorkflowId'>Sub-Workflow</Label>
        <Select
          value={config?.workflowId || ''}
          onValueChange={handleWorkflowChange}
        >
          <SelectTrigger id='subWorkflowId'>
            <SelectValue placeholder='Выберите workflow...' />
          </SelectTrigger>
          <SelectContent>
            {workflows.length === 0 ? (
              <div className='text-muted-foreground px-2 py-4 text-center text-sm'>
                Нет доступных workflow
              </div>
            ) : (
              workflows.map((workflow) => (
                <SelectItem key={workflow.id} value={workflow.id}>
                  <div className='flex items-center gap-2'>
                    <Workflow className='h-4 w-4' />
                    <span>{workflow.name}</span>
                    {workflow.isActive && (
                      <Badge variant='secondary' className='ml-1 text-xs'>
                        Активен
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedWorkflow?.description && (
          <p className='text-muted-foreground text-xs'>
            {selectedWorkflow.description}
          </p>
        )}
      </div>

      {/* Выбор версии */}
      {selectedWorkflow && selectedWorkflow.versions.length > 0 && (
        <div className='space-y-2'>
          <Label htmlFor='subWorkflowVersion'>Версия</Label>
          <Select
            value={config?.version?.toString() || 'active'}
            onValueChange={handleVersionChange}
          >
            <SelectTrigger id='subWorkflowVersion'>
              <SelectValue placeholder='Активная версия' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='active'>
                <div className='flex items-center gap-2'>
                  <span>Активная версия</span>
                  <Badge variant='outline' className='text-xs'>
                    Рекомендуется
                  </Badge>
                </div>
              </SelectItem>
              {selectedWorkflow.versions.map((v) => (
                <SelectItem key={v.version} value={v.version.toString()}>
                  <div className='flex items-center gap-2'>
                    <span>Версия {v.version}</span>
                    {v.isActive && (
                      <Badge variant='secondary' className='text-xs'>
                        Активная
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>
            Если выбрана &quot;Активная версия&quot;, будет использоваться
            текущая активная версия workflow
          </p>
        </div>
      )}

      <Separator />

      {/* Input Mapping */}
      <Collapsible open={inputMappingOpen} onOpenChange={setInputMappingOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant='ghost'
            className='flex w-full items-center justify-between p-0 hover:bg-transparent'
          >
            <div className='flex items-center gap-2'>
              <ArrowRight className='h-4 w-4 text-blue-500' />
              <span className='font-medium'>Input Mapping</span>
              {inputMappings.length > 0 && (
                <Badge variant='secondary' className='text-xs'>
                  {inputMappings.length}
                </Badge>
              )}
            </div>
            {inputMappingOpen ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='mt-3 space-y-3'>
          <p className='text-muted-foreground text-xs'>
            Передача переменных из родительского workflow в sub-workflow
          </p>

          {inputMappings.map((mapping, index) => (
            <div key={index} className='flex items-center gap-2'>
              <Input
                placeholder='Переменная в sub-workflow'
                value={mapping.key}
                onChange={(e) =>
                  updateInputMapping(index, 'key', e.target.value)
                }
                className='flex-1'
              />
              <ArrowLeft className='text-muted-foreground h-4 w-4 flex-shrink-0' />
              <Input
                placeholder='Переменная из родителя'
                value={mapping.value}
                onChange={(e) =>
                  updateInputMapping(index, 'value', e.target.value)
                }
                className='flex-1'
              />
              <Button
                variant='ghost'
                size='icon'
                onClick={() => removeInputMapping(index)}
                className='h-8 w-8 flex-shrink-0'
              >
                <Trash2 className='h-4 w-4 text-red-500' />
              </Button>
            </div>
          ))}

          <Button
            variant='outline'
            size='sm'
            onClick={addInputMapping}
            className='w-full'
          >
            <Plus className='mr-2 h-4 w-4' />
            Добавить маппинг
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Output Mapping */}
      <Collapsible open={outputMappingOpen} onOpenChange={setOutputMappingOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant='ghost'
            className='flex w-full items-center justify-between p-0 hover:bg-transparent'
          >
            <div className='flex items-center gap-2'>
              <ArrowLeft className='h-4 w-4 text-green-500' />
              <span className='font-medium'>Output Mapping</span>
              {outputMappings.length > 0 && (
                <Badge variant='secondary' className='text-xs'>
                  {outputMappings.length}
                </Badge>
              )}
            </div>
            {outputMappingOpen ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='mt-3 space-y-3'>
          <p className='text-muted-foreground text-xs'>
            Получение переменных из sub-workflow обратно в родительский
          </p>

          {outputMappings.map((mapping, index) => (
            <div key={index} className='flex items-center gap-2'>
              <Input
                placeholder='Переменная в родителе'
                value={mapping.key}
                onChange={(e) =>
                  updateOutputMapping(index, 'key', e.target.value)
                }
                className='flex-1'
              />
              <ArrowLeft className='text-muted-foreground h-4 w-4 flex-shrink-0' />
              <Input
                placeholder='Переменная из sub-workflow'
                value={mapping.value}
                onChange={(e) =>
                  updateOutputMapping(index, 'value', e.target.value)
                }
                className='flex-1'
              />
              <Button
                variant='ghost'
                size='icon'
                onClick={() => removeOutputMapping(index)}
                className='h-8 w-8 flex-shrink-0'
              >
                <Trash2 className='h-4 w-4 text-red-500' />
              </Button>
            </div>
          ))}

          <Button
            variant='outline'
            size='sm'
            onClick={addOutputMapping}
            className='w-full'
          >
            <Plus className='mr-2 h-4 w-4' />
            Добавить маппинг
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Предупреждение о вложенности */}
      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription className='text-xs'>
          Sub-workflow поддерживает до 5 уровней вложенности. Sub-workflow не
          может переходить в состояние ожидания ввода пользователя.
        </AlertDescription>
      </Alert>
    </div>
  );
}
