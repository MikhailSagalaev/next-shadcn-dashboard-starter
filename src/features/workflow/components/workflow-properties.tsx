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
import { TelegramRichEditor } from '@/components/ui/telegram-rich-editor';
import { KeyboardEditor } from '@/components/ui/keyboard-editor';
import { DatabaseQueryEditor } from '@/features/bot-constructor/components/editors/database-query-editor';
import { MessageNodeEditor } from './message-node-editor';
import { SubWorkflowConfig } from './node-config-panels/sub-workflow-config';
import { ScheduleTriggerConfigPanel } from './node-config-panels/schedule-trigger-config';
import type {
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeConfig
} from '@/types/workflow';
import type { MessageConfig } from '@/types/bot-constructor';

interface WorkflowPropertiesProps {
  node: WorkflowNode;
  onNodeUpdate: (node: WorkflowNode) => void;
  onClose: () => void;
  allNodes?: WorkflowNode[];
  projectId?: string;
  workflowId?: string;
}

export function WorkflowProperties({
  node,
  onNodeUpdate,
  onClose,
  allNodes = [],
  projectId,
  workflowId
}: WorkflowPropertiesProps) {
  const [nodeData, setNodeData] = useState<WorkflowNodeData>(node.data);
  const [nodeLabel, setNodeLabel] = useState(node.data.label);
  const [nodeDescription, setNodeDescription] = useState(
    node.data.description || ''
  );
  const [nodeConfig, setNodeConfig] = useState<WorkflowNodeConfig>(
    node.data.config
  );
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
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedNode: WorkflowNode = {
      ...node,
      data: {
        ...nodeData,
        label: nodeLabel,
        description: nodeDescription,
        config: nodeConfig
      }
    };
    onNodeUpdate(updatedNode);

    setIsSaving(false);
  }, [node, nodeData, nodeLabel, nodeDescription, nodeConfig, onNodeUpdate]);

  const handleConfigChange = useCallback(
    (key: string, value: any) => {
      setNodeConfig((prevConfig) => ({
        ...prevConfig,
        [node.type!]: {
          ...(prevConfig[node.type as keyof WorkflowNodeConfig] || {}),
          [key]: value
        }
      }));
    },
    [node.type]
  );

  const renderConfigEditor = useCallback(() => {
    switch (node.type) {
      case 'trigger.command':
        return (
          <div className='space-y-2'>
            <Label htmlFor='command'>Команда</Label>
            <Input
              id='command'
              value={nodeConfig['trigger.command']?.command || ''}
              onChange={(e) => handleConfigChange('command', e.target.value)}
              placeholder='/start'
            />
          </div>
        );
      case 'trigger.message':
        return (
          <div className='space-y-2'>
            <Label htmlFor='pattern'>
              Шаблон сообщения (регулярное выражение)
            </Label>
            <Input
              id='pattern'
              value={nodeConfig['trigger.message']?.pattern || ''}
              onChange={(e) => handleConfigChange('pattern', e.target.value)}
              placeholder='.*'
            />
          </div>
        );
      case 'trigger.callback':
        return (
          <div className='space-y-2'>
            <Label htmlFor='callbackData'>Callback данные</Label>
            <Input
              id='callbackData'
              value={nodeConfig['trigger.callback']?.callbackData || ''}
              onChange={(e) =>
                handleConfigChange('callbackData', e.target.value)
              }
              placeholder='btn_click'
            />
          </div>
        );
      case 'trigger.schedule':
        return (
          <ScheduleTriggerConfigPanel
            nodeConfig={nodeConfig}
            setNodeConfig={setNodeConfig}
            projectId={projectId}
          />
        );
      case 'message':
        return (
          <MessageNodeEditor
            nodeConfig={nodeConfig}
            setNodeConfig={setNodeConfig}
          />
        );
      case 'condition':
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='conditionExpression'>
                Выражение (опционально)
              </Label>
              <Textarea
                id='conditionExpression'
                value={nodeConfig.condition?.expression || ''}
                onChange={(e) =>
                  handleConfigChange('expression', e.target.value)
                }
                placeholder='get("balance") > 100 && notEmpty(get("user"))'
                rows={3}
              />
              <p className='text-muted-foreground text-xs'>
                JavaScript выражение. Доступны: get(), isEmpty(), notEmpty(),
                Math.*, etc.
              </p>
            </div>

            <div className='border-t pt-4'>
              <p className='text-muted-foreground mb-4 text-sm'>
                Или используйте простой формат:
              </p>

              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='conditionVariable'>Переменная</Label>
                  <Input
                    id='conditionVariable'
                    value={nodeConfig.condition?.variable || ''}
                    onChange={(e) =>
                      handleConfigChange('variable', e.target.value)
                    }
                    placeholder='balance'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='conditionOperator'>Оператор</Label>
                  <select
                    id='conditionOperator'
                    value={nodeConfig.condition?.operator || ''}
                    onChange={(e) =>
                      handleConfigChange('operator', e.target.value)
                    }
                    className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
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
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='conditionValue'>Значение</Label>
                  <Input
                    id='conditionValue'
                    value={nodeConfig.condition?.value || ''}
                    onChange={(e) =>
                      handleConfigChange('value', e.target.value)
                    }
                    placeholder='100'
                  />
                </div>
              </div>
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
                } as any
              }));
            }}
          />
        );
      case 'action.set_variable':
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='variableName'>Имя переменной</Label>
              <Input
                id='variableName'
                value={nodeConfig['action.set_variable']?.variableName || ''}
                onChange={(e) =>
                  handleConfigChange('variableName', e.target.value)
                }
                placeholder='myVar'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='variableValue'>Значение</Label>
              <Input
                id='variableValue'
                value={nodeConfig['action.set_variable']?.variableValue || ''}
                onChange={(e) =>
                  handleConfigChange('variableValue', e.target.value)
                }
                placeholder='value'
              />
            </div>
          </div>
        );
      case 'action.check_channel_subscription':
        return (
          <div className='space-y-4'>
            <div>
              <Label htmlFor='channelId'>ID канала</Label>
              <Input
                id='channelId'
                value={
                  nodeConfig['action.check_channel_subscription']?.channelId ||
                  ''
                }
                onChange={(e) =>
                  handleConfigChange('channelId', e.target.value)
                }
                className='mt-1'
                placeholder='@channelname или -1001234567890'
              />
              <p className='text-muted-foreground mt-1 text-xs'>
                ID канала Telegram (например, @channelname или -1001234567890).
                Можно использовать переменные: {'{{telegram.chatId}}'}
              </p>
            </div>
            <div>
              <Label htmlFor='userId'>ID пользователя (опционально)</Label>
              <Input
                id='userId'
                value={
                  nodeConfig['action.check_channel_subscription']?.userId || ''
                }
                onChange={(e) => handleConfigChange('userId', e.target.value)}
                className='mt-1'
                placeholder='{{telegram.userId}}'
              />
              <p className='text-muted-foreground mt-1 text-xs'>
                Если не указан, используется ID пользователя из контекста
                Telegram
              </p>
            </div>
            <div>
              <Label htmlFor='assignTo'>Имя переменной для результата</Label>
              <Input
                id='assignTo'
                value={
                  nodeConfig['action.check_channel_subscription']?.assignTo ||
                  'isChannelSubscribed'
                }
                onChange={(e) => handleConfigChange('assignTo', e.target.value)}
                className='mt-1'
                placeholder='isChannelSubscribed'
              />
              <p className='text-muted-foreground mt-1 text-xs'>
                Результат (true/false) будет сохранен в эту переменную. Также
                будет создана переменная {'{имя}_status'} со статусом подписки
              </p>
            </div>
          </div>
        );
      case 'flow.delay':
        return (
          <div className='space-y-2'>
            <Label htmlFor='delayMs'>Задержка (мс)</Label>
            <Input
              id='delayMs'
              type='number'
              value={nodeConfig['flow.delay']?.delayMs || 1000}
              onChange={(e) =>
                handleConfigChange('delayMs', parseInt(e.target.value))
              }
            />
          </div>
        );
      case 'flow.sub_workflow':
        return projectId ? (
          <SubWorkflowConfig
            config={nodeConfig['flow.sub_workflow']}
            onChange={(newConfig) => {
              setNodeConfig((prevConfig) => ({
                ...prevConfig,
                'flow.sub_workflow': newConfig
              }));
            }}
            projectId={projectId}
            currentWorkflowId={workflowId}
          />
        ) : (
          <p className='text-muted-foreground text-sm'>
            Для настройки sub-workflow необходим ID проекта.
          </p>
        );
      case 'flow.switch': {
        const sw = (nodeConfig['flow.switch'] as any) || {
          variable: '',
          cases: [],
          hasDefault: false
        };
        const cases: Array<{ value: any; label?: string }> = sw.cases || [];
        const updateCase = (i: number, value: string) =>
          handleConfigChange(
            'cases',
            cases.map((c, idx) => (idx === i ? { ...c, value } : c))
          );
        const addCase = () =>
          handleConfigChange('cases', [...cases, { value: '' }]);
        const removeCase = (i: number) =>
          handleConfigChange(
            'cases',
            cases.filter((_, idx) => idx !== i)
          );
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='switchVariable'>Переменная</Label>
              <Input
                id='switchVariable'
                value={sw.variable || ''}
                onChange={(e) => handleConfigChange('variable', e.target.value)}
                placeholder='choice'
              />
              <p className='text-muted-foreground text-xs'>
                Значение этой переменной сравнивается с кейсами по очереди.
              </p>
            </div>

            <div className='space-y-2'>
              <Label>Кейсы (ветки case_0, case_1, …)</Label>
              {cases.length === 0 && (
                <p className='text-muted-foreground text-xs'>
                  Пока нет кейсов. Добавьте хотя бы один.
                </p>
              )}
              {cases.map((c, i) => (
                <div key={i} className='flex items-center gap-2'>
                  <span className='text-muted-foreground w-16 text-xs'>
                    case_{i}
                  </span>
                  <Input
                    value={c.value ?? ''}
                    onChange={(e) => updateCase(i, e.target.value)}
                    placeholder={`Значение для case_${i}`}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label={`Удалить case_${i}`}
                    onClick={() => removeCase(i)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ))}
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={addCase}
              >
                + Добавить кейс
              </Button>
            </div>

            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={!!sw.hasDefault}
                onChange={(e) =>
                  handleConfigChange('hasDefault', e.target.checked)
                }
              />
              Ветка по умолчанию (default), если ни один кейс не совпал
            </label>
            <p className='text-muted-foreground text-xs'>
              На холсте соедините выходы ноды: case_0, case_1, … и default.
            </p>
          </div>
        );
      }
      case 'flow.jump': {
        const jump = (nodeConfig['flow.jump'] as any) || {};
        const targets = allNodes.filter((n) => n.id !== node.id);
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='jumpTarget'>Целевая нода</Label>
              <select
                id='jumpTarget'
                value={jump.targetNodeId || ''}
                onChange={(e) =>
                  handleConfigChange('targetNodeId', e.target.value)
                }
                className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
              >
                <option value=''>Выберите ноду</option>
                {targets.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label || n.id} ({n.type})
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='jumpCondition'>
                Условие перехода (опционально)
              </Label>
              <Input
                id='jumpCondition'
                value={jump.condition || ''}
                onChange={(e) =>
                  handleConfigChange('condition', e.target.value)
                }
                placeholder='get("balance") > 0'
              />
            </div>
          </div>
        );
      }
      case 'action.get_variable':
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='getVarName'>Имя переменной</Label>
              <Input
                id='getVarName'
                value={nodeConfig['action.get_variable']?.variableName || ''}
                onChange={(e) =>
                  handleConfigChange('variableName', e.target.value)
                }
                placeholder='myVar'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='getVarDefault'>Значение по умолчанию</Label>
              <Input
                id='getVarDefault'
                value={nodeConfig['action.get_variable']?.defaultValue ?? ''}
                onChange={(e) =>
                  handleConfigChange('defaultValue', e.target.value)
                }
                placeholder='—'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='getVarAssign'>Сохранить в переменную</Label>
              <Input
                id='getVarAssign'
                value={nodeConfig['action.get_variable']?.assignTo || ''}
                onChange={(e) => handleConfigChange('assignTo', e.target.value)}
                placeholder='result'
              />
            </div>
          </div>
        );
      case 'action.api_request':
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='apiUrl'>URL</Label>
              <Input
                id='apiUrl'
                value={nodeConfig['action.api_request']?.url || ''}
                onChange={(e) => handleConfigChange('url', e.target.value)}
                placeholder='https://api.example.com/endpoint'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='apiMethod'>Метод</Label>
              <select
                id='apiMethod'
                value={nodeConfig['action.api_request']?.method || 'GET'}
                onChange={(e) => handleConfigChange('method', e.target.value)}
                className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='apiTimeout'>Таймаут (мс)</Label>
              <Input
                id='apiTimeout'
                type='number'
                value={nodeConfig['action.api_request']?.timeout ?? 10000}
                onChange={(e) =>
                  handleConfigChange('timeout', parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='apiAssign'>Сохранить ответ в переменную</Label>
              <Input
                id='apiAssign'
                value={nodeConfig['action.api_request']?.assignTo || ''}
                onChange={(e) => handleConfigChange('assignTo', e.target.value)}
                placeholder='apiResponse'
              />
            </div>
          </div>
        );
      case 'message.photo':
      case 'message.video':
      case 'message.document': {
        const mediaKind =
          node.type === 'message.photo'
            ? 'photo'
            : node.type === 'message.video'
              ? 'video'
              : 'document';
        const mediaCfg = (nodeConfig[node.type] as any) || {};
        return (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='mediaUrl'>URL или file_id ({mediaKind})</Label>
              <Input
                id='mediaUrl'
                value={mediaCfg[mediaKind] || ''}
                onChange={(e) => handleConfigChange(mediaKind, e.target.value)}
                placeholder='https://… или file_id'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='mediaCaption'>Подпись (caption)</Label>
              <Textarea
                id='mediaCaption'
                value={mediaCfg.caption || ''}
                onChange={(e) => handleConfigChange('caption', e.target.value)}
                placeholder='Текст под медиа (опционально)'
              />
            </div>
          </div>
        );
      }
      case 'flow.end':
        return (
          <p className='text-muted-foreground text-sm'>
            Для этой ноды нет дополнительных настроек.
          </p>
        );
      default:
        return (
          <p className='text-muted-foreground text-sm'>
            Выберите тип ноды для настройки.
          </p>
        );
    }
  }, [
    node.type,
    node.id,
    nodeConfig,
    handleConfigChange,
    projectId,
    workflowId,
    allNodes
  ]);

  return (
    <div className='absolute top-4 right-4 z-20'>
      <div className='bg-background relative flex h-[calc(82vh)] w-[600px] max-w-[calc(100vw-100px)] flex-col rounded-md border shadow-lg'>
        <Button
          variant='ghost'
          size='icon'
          className='absolute top-2 right-2 z-10 h-8 w-8'
          onClick={onClose}
        >
          <X className='h-4 w-4' />
        </Button>

        {/* Scrollable content */}
        <div className='flex-1 overflow-y-auto p-6'>
          <h3 className='mb-6 text-lg font-semibold'>
            Свойства ноды: {node.type}
          </h3>

          <div className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='nodeLabel'>Название ноды</Label>
              <Input
                id='nodeLabel'
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='nodeDescription'>Описание</Label>
              <Textarea
                id='nodeDescription'
                value={nodeDescription}
                onChange={(e) => setNodeDescription(e.target.value)}
              />
            </div>

            <Separator />

            <h4 className='text-md font-semibold'>Конфигурация ноды</h4>
            <div className='space-y-4'>{renderConfigEditor()}</div>
          </div>
        </div>

        {/* Fixed save button at bottom */}
        <div className='bg-background flex-shrink-0 border-t p-4'>
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
