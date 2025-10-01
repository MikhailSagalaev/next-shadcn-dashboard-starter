/**
 * @file: src/features/bot-constructor/components/editors/keyboard-builder.tsx
 * @description: Визуальный конструктор клавиатур Telegram
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, Drag & drop
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  X,
  GripVertical,
  Link,
  MessageCircle,
  Webhook,
  User,
  Phone,
  Mail,
  CreditCard,
  Settings,
  Eye,
  ArrowRight
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import type { KeyboardConfig, ButtonConfig } from '@/types/bot-constructor';

interface KeyboardBuilderProps {
  config: KeyboardConfig;
  onChange: (config: KeyboardConfig) => void;
}

interface QuickButton {
  label: string;
  callbackData?: string;
  url?: string;
  icon: React.ComponentType<any>;
  category: string;
}

const quickButtons: QuickButton[] = [
  // Actions
  {
    label: 'Подтвердить',
    callbackData: 'confirm',
    icon: MessageCircle,
    category: 'actions'
  },
  { label: 'Отменить', callbackData: 'cancel', icon: X, category: 'actions' },
  {
    label: 'Назад',
    callbackData: 'back',
    icon: GripVertical,
    category: 'actions'
  },
  {
    label: 'Далее',
    callbackData: 'next',
    icon: ArrowRight,
    category: 'actions'
  },

  // User data
  {
    label: 'Ввести имя',
    callbackData: 'enter_name',
    icon: User,
    category: 'user'
  },
  {
    label: 'Ввести email',
    callbackData: 'enter_email',
    icon: Mail,
    category: 'user'
  },
  {
    label: 'Ввести телефон',
    callbackData: 'enter_phone',
    icon: Phone,
    category: 'user'
  },

  // Payment
  {
    label: 'Оплатить',
    callbackData: 'pay',
    icon: CreditCard,
    category: 'payment'
  },

  // Settings
  {
    label: 'Настройки',
    callbackData: 'settings',
    icon: Settings,
    category: 'settings'
  },
  { label: 'Помощь', callbackData: 'help', icon: Eye, category: 'settings' }
];

export function KeyboardBuilder({ config, onChange }: KeyboardBuilderProps) {
  const [keyboardType, setKeyboardType] = useState<'inline' | 'reply'>(
    config.type || 'inline'
  );
  const [buttons, setButtons] = useState<ButtonConfig[][]>(
    config.buttons || [[]]
  );
  const [showButtonDialog, setShowButtonDialog] = useState(false);
  const [editingButton, setEditingButton] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [buttonForm, setButtonForm] = useState<Partial<ButtonConfig>>({});

  // Update parent when config changes
  const updateConfig = useCallback(
    (updates: Partial<KeyboardConfig>) => {
      onChange({
        ...config,
        ...updates,
        buttons: buttons
      });
    },
    [config, buttons, onChange]
  );

  // Handle keyboard type change
  const handleTypeChange = useCallback(
    (type: 'inline' | 'reply') => {
      setKeyboardType(type);
      updateConfig({ type });

      // Reset incompatible settings
      if (type === 'inline') {
        updateConfig({ resizeKeyboard: undefined, oneTimeKeyboard: undefined });
      }
    },
    [updateConfig]
  );

  // Add new row
  const addRow = useCallback(() => {
    setButtons((prev) => [...prev, []]);
  }, []);

  // Remove row
  const removeRow = useCallback((rowIndex: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== rowIndex));
  }, []);

  // Add button to row
  const addButton = useCallback(
    (rowIndex: number) => {
      setEditingButton({ row: rowIndex, col: buttons[rowIndex].length });
      setButtonForm({});
      setShowButtonDialog(true);
    },
    [buttons]
  );

  // Edit button
  const editButton = useCallback(
    (rowIndex: number, colIndex: number) => {
      const button = buttons[rowIndex][colIndex];
      setEditingButton({ row: rowIndex, col: colIndex });
      setButtonForm(button);
      setShowButtonDialog(true);
    },
    [buttons]
  );

  // Remove button
  const removeButton = useCallback((rowIndex: number, colIndex: number) => {
    setButtons((prev) => {
      const newButtons = [...prev];
      newButtons[rowIndex] = newButtons[rowIndex].filter(
        (_, i) => i !== colIndex
      );
      return newButtons;
    });
  }, []);

  // Save button
  const saveButton = useCallback(() => {
    if (!editingButton) return;

    const { row, col } = editingButton;
    const newButton: ButtonConfig = {
      text: buttonForm.text || '',
      callbackData: buttonForm.callbackData,
      url: buttonForm.url,
      webApp: buttonForm.webApp,
      ...buttonForm
    };

    setButtons((prev) => {
      const newButtons = [...prev];
      if (!newButtons[row]) newButtons[row] = [];
      newButtons[row][col] = newButton;
      return newButtons;
    });

    setShowButtonDialog(false);
    setEditingButton(null);
    setButtonForm({});
  }, [editingButton, buttonForm]);

  // Quick add button
  const quickAddButton = useCallback(
    (quickButton: QuickButton, rowIndex: number) => {
      const newButton: ButtonConfig = {
        text: quickButton.label,
        callbackData: quickButton.callbackData,
        url: quickButton.url
      };

      setButtons((prev) => {
        const newButtons = [...prev];
        if (!newButtons[rowIndex]) newButtons[rowIndex] = [];
        newButtons[rowIndex] = [...newButtons[rowIndex], newButton];
        return newButtons;
      });
    },
    []
  );

  return (
    <div className='space-y-4'>
      {/* Keyboard Type */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Тип клавиатуры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <input
                type='radio'
                id='inline'
                checked={keyboardType === 'inline'}
                onChange={() => handleTypeChange('inline')}
              />
              <Label htmlFor='inline'>Inline клавиатура</Label>
            </div>

            <div className='flex items-center space-x-2'>
              <input
                type='radio'
                id='reply'
                checked={keyboardType === 'reply'}
                onChange={() => handleTypeChange('reply')}
              />
              <Label htmlFor='reply'>Reply клавиатура</Label>
            </div>
          </div>

          {keyboardType === 'reply' && (
            <div className='mt-4 space-y-2'>
              <div className='flex items-center space-x-2'>
                <Switch
                  checked={config.resizeKeyboard || false}
                  onCheckedChange={(checked) =>
                    updateConfig({ resizeKeyboard: checked })
                  }
                />
                <Label className='text-sm'>Адаптивный размер</Label>
              </div>

              <div className='flex items-center space-x-2'>
                <Switch
                  checked={config.oneTimeKeyboard || false}
                  onCheckedChange={(checked) =>
                    updateConfig({ oneTimeKeyboard: checked })
                  }
                />
                <Label className='text-sm'>Одноразовая клавиатура</Label>
              </div>

              <div className='flex items-center space-x-2'>
                <Switch
                  checked={config.selective || false}
                  onCheckedChange={(checked) =>
                    updateConfig({ selective: checked })
                  }
                />
                <Label className='text-sm'>Селективная клавиатура</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Buttons */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Быстрые кнопки</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='actions'>
            <TabsList className='grid w-full grid-cols-4'>
              <TabsTrigger value='actions'>Действия</TabsTrigger>
              <TabsTrigger value='user'>Пользователь</TabsTrigger>
              <TabsTrigger value='payment'>Оплата</TabsTrigger>
              <TabsTrigger value='settings'>Настройки</TabsTrigger>
            </TabsList>

            {['actions', 'user', 'payment', 'settings'].map((category) => (
              <TabsContent key={category} value={category} className='mt-4'>
                <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
                  {quickButtons
                    .filter((btn) => btn.category === category)
                    .map((btn, index) => {
                      const Icon = btn.icon;
                      return (
                        <div key={index} className='flex flex-col space-y-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            className='flex h-auto flex-col items-center space-y-1 p-3'
                            onClick={() =>
                              quickAddButton(btn, buttons.length - 1)
                            }
                          >
                            <Icon className='h-4 w-4' />
                            <span className='text-xs'>{btn.label}</span>
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Keyboard Builder */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center justify-between text-sm'>
            Конструктор клавиатуры
            <Button variant='outline' size='sm' onClick={addRow}>
              <Plus className='mr-2 h-4 w-4' />
              Добавить ряд
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {buttons.map((row, rowIndex) => (
              <div key={rowIndex} className='flex items-center space-x-2'>
                <div className='flex-1'>
                  <div className='flex flex-wrap gap-2'>
                    {row.map((button, colIndex) => (
                      <div key={colIndex} className='group relative'>
                        <Button
                          variant='outline'
                          size='sm'
                          className='h-8 min-w-[80px]'
                          onClick={() => editButton(rowIndex, colIndex)}
                        >
                          {button.text || 'Кнопка'}
                        </Button>

                        <Button
                          variant='destructive'
                          size='sm'
                          className='absolute -top-1 -right-1 h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100'
                          onClick={() => removeButton(rowIndex, colIndex)}
                        >
                          <X className='h-3 w-3' />
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant='dashed'
                      size='sm'
                      onClick={() => addButton(rowIndex)}
                      className='h-8 min-w-[80px]'
                    >
                      <Plus className='h-4 w-4' />
                    </Button>
                  </div>
                </div>

                {buttons.length > 1 && (
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => removeRow(rowIndex)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Превью клавиатуры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='mx-auto max-w-sm rounded-lg bg-gray-100 p-4 dark:bg-gray-800'>
            <div className='rounded-lg bg-white p-3 shadow-sm dark:bg-gray-700'>
              <div className='mb-3 text-sm text-gray-900 dark:text-gray-100'>
                Пример сообщения с клавиатурой
              </div>

              <div className='space-y-2'>
                {buttons.map((row, rowIndex) => (
                  <div key={rowIndex} className='flex flex-wrap gap-2'>
                    {row.map((button, colIndex) => (
                      <Button
                        key={colIndex}
                        variant='outline'
                        size='sm'
                        className='text-xs'
                        disabled
                      >
                        {button.text || 'Кнопка'}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button Edit Dialog */}
      <Dialog open={showButtonDialog} onOpenChange={setShowButtonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingButton ? 'Редактировать кнопку' : 'Создать кнопку'}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры кнопки клавиатуры
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div>
              <Label>Текст кнопки</Label>
              <Input
                value={buttonForm.text || ''}
                onChange={(e) =>
                  setButtonForm((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder='Текст на кнопке'
              />
            </div>

            {keyboardType === 'inline' && (
              <>
                <div>
                  <Label>Callback Data (опционально)</Label>
                  <Input
                    value={buttonForm.callbackData || ''}
                    onChange={(e) =>
                      setButtonForm((prev) => ({
                        ...prev,
                        callbackData: e.target.value
                      }))
                    }
                    placeholder='callback_data'
                  />
                </div>

                <div>
                  <Label>URL (опционально)</Label>
                  <Input
                    value={buttonForm.url || ''}
                    onChange={(e) =>
                      setButtonForm((prev) => ({
                        ...prev,
                        url: e.target.value
                      }))
                    }
                    placeholder='https://example.com'
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowButtonDialog(false)}
            >
              Отмена
            </Button>
            <Button onClick={saveButton}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
