/**
 * @file: src/features/workflow/components/workflow-properties.tsx
 * @description: Панель свойств для редактирования выбранной ноды workflow
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, lucide-react
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { X, Save } from 'lucide-react';
import { MessageEditor } from '@/components/ui/message-editor';
import { DatabaseQueryEditor } from '@/features/bot-constructor/components/editors/database-query-editor';
import type { WorkflowNode, WorkflowNodeData, WorkflowNodeConfig } from '@/types/workflow';
import type { MessageConfig } from '@/types/bot-constructor';

interface WorkflowPropertiesProps {
  node: WorkflowNode;
  onNodeUpdate: (node: WorkflowNode) => void;
  onClose: () => void;
  allNodes?: WorkflowNode[];
}

export function WorkflowProperties({ node, onNodeUpdate, onClose, allNodes = [] }: WorkflowPropertiesProps) {
  const [nodeData, setNodeData] = useState<WorkflowNodeData>(node.data);
  const [nodeLabel, setNodeLabel] = useState(node.data.label);
  const [nodeDescription, setNodeDescription] = useState(node.data.description || '');
  const [nodeConfig, setNodeConfig] = useState<WorkflowNodeConfig>(node.data.config);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNodeData(node.data);
    setNodeLabel(node.data.label);
    setNodeDescription(node.data.description || '');
    setNodeConfig(node.data.config);
  }, [node]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    // Имитируем небольшую задержку для показа анимации
    await new Promise(resolve => setTimeout(resolve, 300));

    const updatedNode: WorkflowNode = {
      ...node,
      data: {
        ...nodeData,
        label: nodeLabel,
        description: nodeDescription,
        config: nodeConfig,
      },
    };
    onNodeUpdate(updatedNode);

    setIsSaving(false);
  }, [node, nodeData, nodeLabel, nodeDescription, nodeConfig, onNodeUpdate]);

  const handleConfigChange = useCallback((key: string, value: any) => {
    setNodeConfig((prevConfig) => ({
      ...prevConfig,
      [node.type!]: {
        ...(prevConfig[node.type as keyof WorkflowNodeConfig] || {}),
        [key]: value,
      },
    }));
  }, [node.type]);

  const renderConfigEditor = useCallback(() => {
    switch (node.type) {
      case 'trigger.command':
        return (
          <div>
            <Label htmlFor='command'>Команда</Label>
            <Input
              id='command'
              value={nodeConfig['trigger.command']?.command || ''}
              onChange={(e) => handleConfigChange('command', e.target.value)}
              className='mt-1'
              placeholder='/start'
            />
          </div>
        );
      case 'trigger.message':
        return (
          <div>
            <Label htmlFor='pattern'>Шаблон сообщения (регулярное выражение)</Label>
            <Input
              id='pattern'
              value={nodeConfig['trigger.message']?.pattern || ''}
              onChange={(e) => handleConfigChange('pattern', e.target.value)}
              className='mt-1'
              placeholder='.*'
            />
          </div>
        );
      case 'trigger.callback':
        return (
          <div>
            <Label htmlFor='callbackData'>Callback данные</Label>
            <Input
              id='callbackData'
              value={nodeConfig['trigger.callback']?.callbackData || ''}
              onChange={(e) => handleConfigChange('callbackData', e.target.value)}
              className='mt-1'
              placeholder='btn_click'
            />
          </div>
        );
        case 'message':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="messageText">Текст сообщения</Label>
                <MessageEditor
                  value={nodeConfig.message?.text || ''}
                  onChange={(text) => {
                    setNodeConfig((prevConfig) => ({
                      ...prevConfig,
                      message: {
                        ...prevConfig.message,
                        text,
                        parseMode: prevConfig.message?.parseMode || 'HTML'
                      },
                    }));
                  }}
                  keyboard={nodeConfig.message?.keyboard || null}
                  onKeyboardChange={(keyboard) => {
                    setNodeConfig((prevConfig) => ({
                      ...prevConfig,
                      message: {
                        ...prevConfig.message,
                        keyboard: keyboard || undefined
                      },
                    }));
                  }}
                  placeholder="Введите текст сообщения..."
                  showPreview={true}
                  showVariableHelper={true}
                />
              </div>
              
              <div>
                <Label htmlFor="parseMode">Режим парсинга</Label>
                <select
                  id="parseMode"
                  value={nodeConfig.message?.parseMode || 'HTML'}
                  onChange={(e) => {
                    setNodeConfig((prevConfig) => ({
                      ...prevConfig,
                      message: {
                        ...prevConfig.message,
                        parseMode: e.target.value as 'HTML' | 'Markdown' | 'MarkdownV2'
                      },
                    }));
                  }}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="HTML">HTML</option>
                  <option value="Markdown">Markdown</option>
                  <option value="MarkdownV2">MarkdownV2</option>
                </select>
              </div>
            </div>
          );
      case 'condition':
        return (
          <div className='space-y-4'>
            <div>
              <Label htmlFor='conditionExpression'>Выражение (опционально)</Label>
              <Textarea
                id='conditionExpression'
                value={nodeConfig.condition?.expression || ''}
                onChange={(e) => handleConfigChange('expression', e.target.value)}
                className='mt-1'
                placeholder='get("balance") > 100 && notEmpty(get("user"))'
                rows={3}
              />
              <p className='text-xs text-muted-foreground mt-1'>
                JavaScript выражение. Доступны: get(), isEmpty(), notEmpty(), Math.*, etc.
              </p>
            </div>

            <div className='border-t pt-4'>
              <p className='text-sm text-muted-foreground mb-3'>Или используйте простой формат:</p>

              <Label htmlFor='conditionVariable'>Переменная</Label>
              <Input
                id='conditionVariable'
                value={nodeConfig.condition?.variable || ''}
                onChange={(e) => handleConfigChange('variable', e.target.value)}
                className='mt-1'
                placeholder='balance'
              />

              <Label htmlFor='conditionOperator' className='mt-3 block'>Оператор</Label>
              <select
                id='conditionOperator'
                value={nodeConfig.condition?.operator || ''}
                onChange={(e) => handleConfigChange('operator', e.target.value)}
                className='w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm'
              >
                <option value=''>Выберите оператор</option>
                <option value='equals'>Равно (===)</option>
                <option value='not_equals'>Не равно (!==)</option>
                <option value='contains'>Содержит</option>
                <option value='not_contains'>Не содержит</option>
                <option value='greater'>Больше (&gt;)</option>
                <option value='less'>Меньше (&lt;)</option>
                <option value='is_empty'>Пустое</option>
                <option value='is_not_empty'>Не пустое</option>
              </select>

              <Label htmlFor='conditionValue' className='mt-3 block'>Значение</Label>
              <Input
                id='conditionValue'
                value={nodeConfig.condition?.value || ''}
                onChange={(e) => handleConfigChange('value', e.target.value)}
                className='mt-1'
                placeholder='100'
              />
            </div>
          </div>
        );
      case 'action.database_query':
        return (
          <DatabaseQueryEditor
            config={{
              query: nodeConfig['action.database_query']?.query || '',
              parameters: nodeConfig['action.database_query']?.parameters || {},
              assignTo: nodeConfig['action.database_query']?.assignTo,
              resultMapping: nodeConfig['action.database_query']?.resultMapping
            }}
            onChange={(newConfig) => {
              setNodeConfig((prevConfig) => ({
                ...prevConfig,
                'action.database_query': {
                  ...newConfig,
                  parameters: newConfig.parameters || {}
                } as any,
              }));
            }}
          />
        );
      case 'action.set_variable':
        return (
          <div>
            <Label htmlFor='variableName'>Имя переменной</Label>
            <Input
              id='variableName'
              value={nodeConfig['action.set_variable']?.variableName || ''}
              onChange={(e) => handleConfigChange('variableName', e.target.value)}
              className='mt-1'
              placeholder='myVar'
            />
            <Label htmlFor='variableValue' className='mt-3 block'>Значение</Label>
            <Input
              id='variableValue'
              value={nodeConfig['action.set_variable']?.variableValue || ''}
              onChange={(e) => handleConfigChange('variableValue', e.target.value)}
              className='mt-1'
              placeholder='value'
            />
          </div>
        );
      case 'flow.delay':
        return (
          <div>
            <Label htmlFor='delayMs'>Задержка (мс)</Label>
            <Input
              id='delayMs'
              type='number'
              value={nodeConfig['flow.delay']?.delayMs || 1000}
              onChange={(e) => handleConfigChange('delayMs', parseInt(e.target.value))}
              className='mt-1'
            />
          </div>
        );
      case 'flow.end':
        return <p className='text-sm text-muted-foreground'>Для этой ноды нет дополнительных настроек.</p>;
      default:
        return <p className='text-sm text-muted-foreground'>Выберите тип ноды для настройки.</p>;
    }
  }, [node.type, nodeConfig, handleConfigChange]);

  return (
    <div className='absolute right-4 top-4 z-20'>
      <div className='relative w-[600px] max-w-[calc(100vw-100px)] h-[calc(82vh)] flex flex-col rounded-md border bg-background shadow-lg'>
        <Button
          variant='ghost'
          size='icon'
          className='absolute right-2 top-2 h-8 w-8 z-10'
          onClick={onClose}
        >
          <X className='h-4 w-4' />
        </Button>
        
        {/* Scrollable content */}
        <div className='overflow-y-auto flex-1 p-4 pr-6'>
          <h3 className='mb-4 text-lg font-semibold'>Свойства ноды: {node.type}</h3>

          <div className='space-y-4'>
          <div>
            <Label htmlFor='nodeLabel'>Название ноды</Label>
            <Input
              id='nodeLabel'
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='nodeDescription'>Описание</Label>
            <Textarea
              id='nodeDescription'
              value={nodeDescription}
              onChange={(e) => setNodeDescription(e.target.value)}
              className='mt-1'
            />
          </div>

          <Separator />

          <h4 className='text-md font-semibold'>Конфигурация ноды</h4>
          {renderConfigEditor()}
          </div>
        </div>

        {/* Fixed save button at bottom */}
        <div className='flex-shrink-0 border-t bg-background p-4'>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full transition-all duration-300 ${
              isSaving ? 'animate-pulse bg-green-600 hover:bg-green-600' : ''
            }`}
          >
            {isSaving ? (
              <>
                <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                Сохранение...
              </>
            ) : (
              <>
                <Save className='mr-2 h-4 w-4' /> Сохранить изменения
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
