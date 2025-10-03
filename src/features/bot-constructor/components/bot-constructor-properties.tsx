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

// HeroUI: импортируем из @heroui/react для совместимости бандла
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Divider,
  Tabs,
  Tab
} from '@heroui/react';

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
        <label className='text-sm font-medium'>Название ноды</label>
        <Input
          value={localNode.data.label}
          onValueChange={(value) => updateNodeData({ label: value })}
          placeholder='Точка входа'
        />
      </div>
      <div>
        <label className='text-sm font-medium'>Описание</label>
        <Textarea
          value={localNode.data.description || ''}
          onValueChange={(value) => updateNodeData({ description: value })}
          placeholder='Описание точки входа в диалог'
        />
      </div>
    </div>
  );

  const renderMessageProperties = () => (
    <Tabs defaultSelectedKey='message' aria-label='Message editor tabs'>
      <Tab key='message' title='Сообщение'>
        <div className='mt-4 space-y-4'>
          <MessageEditor
            config={localNode.data.config.message || { text: '' }}
            onChange={(messageConfig) =>
              updateNodeData({
                config: {
                  ...localNode.data.config,
                  message: messageConfig
                }
              })
            }
          />
        </div>
      </Tab>

      <Tab key='keyboard' title='Клавиатура'>
        <div className='mt-4 space-y-4'>
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
        </div>
      </Tab>
    </Tabs>
  );

  const renderCommandProperties = () => (
    <Tabs defaultSelectedKey='settings' aria-label='Command editor tabs'>
      <Tab key='settings' title='Настройки'>
        <div className='mt-4 space-y-4'>
          <div>
            <label className='text-sm font-medium'>Команда (без /)</label>
            <Input
              value={localNode.data.config.command?.command || ''}
              onValueChange={(value) =>
                updateNodeData({
                  config: {
                    ...localNode.data.config,
                    command: {
                      ...localNode.data.config.command,
                      command: value
                    }
                  }
                })
              }
              placeholder='start'
            />
          </div>

          <div>
            <label className='text-sm font-medium'>Описание</label>
            <Input
              value={localNode.data.config.command?.description || ''}
              onValueChange={(value) =>
                updateNodeData({
                  config: {
                    ...localNode.data.config,
                    command: {
                      ...localNode.data.config.command,
                      description: value
                    }
                  }
                })
              }
              placeholder='Описание команды для /help'
            />
          </div>

          <div>
            <label className='text-sm font-medium'>Альтернативные имена</label>
            <Input
              value={localNode.data.config.command?.aliases?.join(', ') || ''}
              onValueChange={(value) =>
                updateNodeData({
                  config: {
                    ...localNode.data.config,
                    command: {
                      ...localNode.data.config.command,
                      aliases: value
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
        </div>
      </Tab>

      <Tab key='botfather' title='Bot Father'>
        <div className='mt-4'>
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
        </div>
      </Tab>
    </Tabs>
  );

  const renderCallbackProperties = () => (
    <div className='space-y-4'>
      <div>
        <label className='text-sm font-medium'>Callback data</label>
        <Input
          value={localNode.data.config.callback?.data || ''}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                callback: {
                  ...localNode.data.config.callback,
                  data: value
                }
              }
            })
          }
          placeholder='action_name'
        />
      </div>

      <div>
        <label className='text-sm font-medium'>
          Регулярное выражение (опционально)
        </label>
        <Input
          value={localNode.data.config.callback?.pattern || ''}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                callback: {
                  ...localNode.data.config.callback,
                  pattern: value
                }
              }
            })
          }
          placeholder='^action_.*'
        />
      </div>

      <div className='flex items-center space-x-2'>
        <Switch
          isSelected={localNode.data.config.callback?.hideKeyboard || false}
          onValueChange={(isSelected) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                callback: {
                  ...localNode.data.config.callback,
                  hideKeyboard: isSelected
                }
              }
            })
          }
        />
        <label className='text-sm font-medium'>
          Скрыть клавиатуру после нажатия
        </label>
      </div>
    </div>
  );

  // Заглушки для остальных типов нод
  const renderInputProperties = () => (
    <div className='space-y-4'>
      <div>
        <label className='text-sm font-medium'>Текст запроса</label>
        <Textarea
          value={localNode.data.config.input?.prompt || ''}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                input: {
                  ...localNode.data.config.input,
                  prompt: value
                }
              }
            })
          }
          placeholder='Пожалуйста, введите ваше имя...'
        />
      </div>
      <div>
        <label className='text-sm font-medium'>Таймаут (секунды)</label>
        <Input
          type='number'
          value={localNode.data.config.input?.timeout || 300}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                input: {
                  ...localNode.data.config.input,
                  timeout: parseInt(value) || 300
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
        <label className='text-sm font-medium'>Тип действия</label>
        <Select
          selectedKeys={[localNode.data.config.action?.type || 'grammy_api']}
          onSelectionChange={(keys) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                action: {
                  ...localNode.data.config.action,
                  type: Array.from(keys)[0] as any
                }
              }
            })
          }
        >
          <SelectItem key='grammy_api'>Grammy API</SelectItem>
          <SelectItem key='external_api'>Внешний API</SelectItem>
          <SelectItem key='database'>База данных</SelectItem>
          <SelectItem key='variable'>Переменная</SelectItem>
          <SelectItem key='notification'>Уведомление</SelectItem>
        </Select>
      </div>
    </div>
  );

  const renderMiddlewareProperties = () => (
    <div className='space-y-4'>
      <div>
        <label className='text-sm font-medium'>Тип middleware</label>
        <Select
          selectedKeys={[localNode.data.config.middleware?.type || 'logging']}
          onSelectionChange={(keys) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                middleware: {
                  ...localNode.data.config.middleware,
                  type: Array.from(keys)[0] as any
                }
              }
            })
          }
        >
          <SelectItem key='logging'>Логирование</SelectItem>
          <SelectItem key='auth'>Аутентификация</SelectItem>
          <SelectItem key='rate_limit'>Ограничение запросов</SelectItem>
          <SelectItem key='validation'>Валидация</SelectItem>
          <SelectItem key='custom'>Пользовательский</SelectItem>
        </Select>
      </div>
    </div>
  );

  const renderSessionProperties = () => (
    <div className='space-y-4'>
      <div>
        <label className='text-sm font-medium'>Ключ переменной</label>
        <Input
          value={localNode.data.config.session?.key || ''}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                session: {
                  ...localNode.data.config.session,
                  key: value
                }
              }
            })
          }
          placeholder='userName'
        />
      </div>

      <div>
        <label className='text-sm font-medium'>Операция</label>
        <Select
          selectedKeys={[localNode.data.config.session?.operation || 'set']}
          onSelectionChange={(keys) =>
            updateNodeData({
              config: {
                ...localNode.data.config,
                session: {
                  ...localNode.data.config.session,
                  operation: Array.from(keys)[0] as any
                }
              }
            })
          }
        >
          <SelectItem key='set'>Установить</SelectItem>
          <SelectItem key='get'>Получить</SelectItem>
          <SelectItem key='delete'>Удалить</SelectItem>
          <SelectItem key='increment'>Увеличить</SelectItem>
          <SelectItem key='decrement'>Уменьшить</SelectItem>
        </Select>
      </div>
    </div>
  );

  const renderEndProperties = () => (
    <div className='space-y-4'>
      <div>
        <label className='text-sm font-medium'>Название ноды</label>
        <Input
          value={localNode.data.label}
          onValueChange={(value) => updateNodeData({ label: value })}
          placeholder='Завершение диалога'
        />
      </div>

      <div>
        <label className='text-sm font-medium'>
          Прощальное сообщение (опционально)
        </label>
        <Textarea
          value={localNode.data.description || ''}
          onValueChange={(value) => updateNodeData({ description: value })}
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
        <Button variant='light' size='sm' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4'>
        <Card>
          <CardHeader className='pb-3'>
            <h4 className='text-sm font-semibold'>{localNode.data.label}</h4>
          </CardHeader>
          <CardBody>{renderProperties()}</CardBody>
        </Card>
      </div>
    </div>
  );
}
