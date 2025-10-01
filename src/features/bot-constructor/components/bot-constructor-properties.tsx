/**
 * @file: src/features/bot-constructor/components/bot-constructor-properties.tsx
 * @description: Панель свойств для редактирования нод конструктора
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { MessageEditor } from './editors/message-editor';
import { KeyboardBuilder } from './editors/keyboard-builder';
import { ConditionEditor } from './editors/condition-editor';
import { BotfatherHelper } from './editors/botfather-helper';

import type { BotNode } from '@/types/bot-constructor';

interface BotConstructorPropertiesProps {
  node: BotNode;
  onNodeUpdate: (updatedNode: BotNode) => void;
  onClose: () => void;
}

export function BotConstructorProperties({
  node,
  onNodeUpdate,
  onClose
}: BotConstructorPropertiesProps) {
  const [localNode, setLocalNode] = useState<BotNode>(node);

  // Update local state
  const updateNode = (updates: Partial<BotNode>) => {
    const updatedNode = { ...localNode, ...updates };
    setLocalNode(updatedNode);
    onNodeUpdate(updatedNode);
  };

  // Update node data
  const updateNodeData = (dataUpdates: any) => {
    updateNode({
      data: {
        ...localNode.data,
        ...dataUpdates
      }
    });
  };

  // Render different property panels based on node type
  const renderProperties = () => {
    switch (node.type) {
      case 'start':
        return renderStartProperties();
      case 'message':
        return renderMessageProperties();
      case 'command':
        return renderCommandProperties();
      case 'callback':
        return renderCallbackProperties();
      case 'input':
        return renderInputProperties();
      case 'condition':
        return renderConditionProperties();
      case 'action':
        return renderActionProperties();
      case 'middleware':
        return renderMiddlewareProperties();
      case 'session':
        return renderSessionProperties();
      case 'end':
        return renderEndProperties();
      default:
        return <div>Свойства для этого типа ноды пока не реализованы</div>;
    }
  };

  const renderStartProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Название ноды</Label>
        <Input
          value={localNode.data.label}
          onChange={(e) => updateNodeData({ label: e.target.value })}
          placeholder='Точка входа'
        />
      </div>
      <div>
        <Label>Описание</Label>
        <Textarea
          value={localNode.data.description || ''}
          onChange={(e) => updateNodeData({ description: e.target.value })}
          placeholder='Описание точки входа в диалог'
        />
      </div>
    </div>
  );

  const renderMessageProperties = () => (
    <Tabs defaultValue='message' className='w-full'>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger value='message'>Сообщение</TabsTrigger>
        <TabsTrigger value='keyboard'>Клавиатура</TabsTrigger>
      </TabsList>

      <TabsContent value='message' className='mt-4 space-y-4'>
        <MessageEditor
          config={localNode.data.config.message || {}}
          onChange={(messageConfig) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                message: messageConfig
              }
            })
          }
        />
      </TabsContent>

      <TabsContent value='keyboard' className='mt-4 space-y-4'>
        <KeyboardBuilder
          config={
            localNode.data.config.message?.keyboard || {
              type: 'inline',
              buttons: [[]]
            }
          }
          onChange={(keyboardConfig) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                message: {
                  ...localNode.data.config.message,
                  keyboard: keyboardConfig
                }
              }
            })
          }
        />
      </TabsContent>
    </Tabs>
  );

  const renderCommandProperties = () => (
    <Tabs defaultValue='settings' className='w-full'>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger value='settings'>Настройки</TabsTrigger>
        <TabsTrigger value='botfather'>Bot Father</TabsTrigger>
      </TabsList>

      <TabsContent value='settings' className='mt-4 space-y-4'>
        <div>
          <Label>Команда (без /)</Label>
          <Input
            value={localNode.data.config.command?.command || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...localNode.data.config,
                  command: {
                    ...localNode.data.config.command,
                    command: e.target.value
                  }
                }
              })
            }
            placeholder='start'
          />
        </div>

        <div>
          <Label>Описание</Label>
          <Input
            value={localNode.data.config.command?.description || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...localNode.data.config,
                  command: {
                    ...localNode.data.config.command,
                    description: e.target.value
                  }
                }
              })
            }
            placeholder='Описание команды для /help'
          />
        </div>

        <div>
          <Label>Альтернативные имена</Label>
          <Input
            value={localNode.data.config.command?.aliases?.join(', ') || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...localNode.data.config,
                  command: {
                    ...localNode.data.config.command,
                    aliases: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  }
                }
              })
            }
            placeholder='go, begin (через запятую)'
          />
        </div>
      </TabsContent>

      <TabsContent value='botfather' className='mt-4'>
        <BotfatherHelper
          config={
            localNode.data.config.command || {
              command: '',
              description: ''
            }
          }
          onChange={(commandConfig) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                command: commandConfig
              }
            })
          }
          botUsername='your_bot_username' // This would come from project settings
        />
      </TabsContent>
    </Tabs>
  );

  const renderCallbackProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Callback data</Label>
        <Input
          value={localNode.data.config.callback?.data || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                callback: {
                  ...localNode.data.config.callback,
                  data: e.target.value
                }
              }
            })
          }
          placeholder='action_name'
        />
      </div>

      <div>
        <Label>Регулярное выражение (опционально)</Label>
        <Input
          value={localNode.data.config.callback?.pattern || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                callback: {
                  ...localNode.data.config.callback,
                  pattern: e.target.value
                }
              }
            })
          }
          placeholder='^action_.*'
        />
      </div>

      <div className='flex items-center space-x-2'>
        <Switch
          checked={localNode.data.config.callback?.hideKeyboard || false}
          onCheckedChange={(checked) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                callback: {
                  ...localNode.data.config.callback,
                  hideKeyboard: checked
                }
              }
            })
          }
        />
        <Label className='text-sm'>Скрыть клавиатуру после нажатия</Label>
      </div>
    </div>
  );

  // Заглушки для остальных типов нод
  const renderInputProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Текст запроса</Label>
        <Textarea
          value={localNode.data.config.input?.prompt || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                input: {
                  ...localNode.data.config.input,
                  prompt: e.target.value
                }
              }
            })
          }
          placeholder='Пожалуйста, введите ваше имя...'
        />
      </div>
      <div>
        <Label>Таймаут (секунды)</Label>
        <Input
          type='number'
          value={localNode.data.config.input?.timeout || 300}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                input: {
                  ...localNode.data.config.input,
                  timeout: parseInt(e.target.value)
                }
              }
            })
          }
        />
      </div>
    </div>
  );

  const renderConditionProperties = () => (
    <ConditionEditor
      config={
        localNode.data.config.condition || {
          variable: '',
          operator: 'equals',
          value: '',
          trueNodeId: '',
          falseNodeId: ''
        }
      }
      onChange={(conditionConfig) =>
        updateNodeData({
          config: {
            ...localNode.data.config,
            condition: conditionConfig
          }
        })
      }
    />
  );

  const renderActionProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Тип действия</Label>
        <Select
          value={localNode.data.config.action?.type || 'grammy_api'}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                action: {
                  ...localNode.data.config.action,
                  type: value as any
                }
              }
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='grammy_api'>Grammy API</SelectItem>
            <SelectItem value='external_api'>Внешний API</SelectItem>
            <SelectItem value='database'>База данных</SelectItem>
            <SelectItem value='variable'>Переменная</SelectItem>
            <SelectItem value='notification'>Уведомление</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderMiddlewareProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Тип middleware</Label>
        <Select
          value={localNode.data.config.middleware?.type || 'logging'}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                middleware: {
                  ...localNode.data.config.middleware,
                  type: value as any
                }
              }
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='logging'>Логирование</SelectItem>
            <SelectItem value='auth'>Аутентификация</SelectItem>
            <SelectItem value='rate_limit'>Ограничение запросов</SelectItem>
            <SelectItem value='validation'>Валидация</SelectItem>
            <SelectItem value='custom'>Пользовательский</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderSessionProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Ключ переменной</Label>
        <Input
          value={localNode.data.config.session?.key || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                session: {
                  ...localNode.data.config.session,
                  key: e.target.value
                }
              }
            })
          }
          placeholder='userName'
        />
      </div>

      <div>
        <Label>Операция</Label>
        <Select
          value={localNode.data.config.session?.operation || 'set'}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                session: {
                  ...localNode.data.config.session,
                  operation: value as any
                }
              }
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='set'>Установить</SelectItem>
            <SelectItem value='get'>Получить</SelectItem>
            <SelectItem value='delete'>Удалить</SelectItem>
            <SelectItem value='increment'>Увеличить</SelectItem>
            <SelectItem value='decrement'>Уменьшить</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderEndProperties = () => (
    <div className='space-y-4'>
      <div>
        <Label>Название ноды</Label>
        <Input
          value={localNode.data.label}
          onChange={(e) => updateNodeData({ label: e.target.value })}
          placeholder='Завершение диалога'
        />
      </div>

      <div>
        <Label>Прощальное сообщение (опционально)</Label>
        <Textarea
          value={localNode.data.description || ''}
          onChange={(e) => updateNodeData({ description: e.target.value })}
          placeholder='Спасибо за использование нашего бота!'
        />
      </div>
    </div>
  );

  return (
    <div className='bg-background flex w-80 flex-col border-l'>
      {/* Header */}
      <div className='flex items-center justify-between border-b p-4'>
        <h3 className='text-sm font-semibold'>Свойства ноды</h3>
        <Button variant='ghost' size='sm' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4'>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm'>{localNode.data.label}</CardTitle>
          </CardHeader>
          <CardContent>{renderProperties()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
