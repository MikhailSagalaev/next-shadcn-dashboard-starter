/**
 * @file: src/components/ui/keyboard-editor.tsx
 * @description: Визуальный редактор клавиатур для Telegram бота
 * @project: SaaS Bonus System
 * @created: 2025-10-21
 * @author: AI Assistant + User
 */

'use client';

import React, { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Keyboard,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Phone,
  MapPin,
  Link as LinkIcon,
  MousePointer
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  url?: string;
  callback_data?: string;
  hide_after_click?: boolean; // ✨ НОВОЕ: скрывать кнопку после нажатия
}

export interface KeyboardConfig {
  type: 'reply' | 'inline';
  buttons: KeyboardButton[][];
}

interface KeyboardEditorProps {
  value: KeyboardConfig | null;
  onChange: (config: KeyboardConfig | null) => void;
  className?: string;
}

export function KeyboardEditor({
  value,
  onChange,
  className
}: KeyboardEditorProps) {
  const [showEditor, setShowEditor] = useState(!!value);
  // ✅ ИСПРАВЛЕНО: Гарантируем что buttons всегда массив
  const keyboard = value
    ? { ...value, buttons: Array.isArray(value.buttons) ? value.buttons : [] }
    : { type: 'reply' as const, buttons: [] };

  const handleAddKeyboard = () => {
    onChange({ type: 'reply', buttons: [[{ text: 'Кнопка 1' }]] });
    setShowEditor(true);
  };

  const handleRemoveKeyboard = () => {
    onChange(null);
    setShowEditor(false);
  };

  const handleTypeChange = (type: 'reply' | 'inline') => {
    onChange({ ...keyboard, type });
  };

  const handleAddRow = () => {
    onChange({
      ...keyboard,
      buttons: [
        ...keyboard.buttons,
        [{ text: `Кнопка ${keyboard.buttons.length + 1}` }]
      ]
    });
  };

  const handleAddButton = (rowIndex: number) => {
    const newButtons = [...keyboard.buttons];
    newButtons[rowIndex] = [
      ...newButtons[rowIndex],
      { text: `Кнопка ${newButtons[rowIndex].length + 1}` }
    ];
    onChange({ ...keyboard, buttons: newButtons });
  };

  const handleRemoveRow = (rowIndex: number) => {
    const newButtons = keyboard.buttons.filter((_, i) => i !== rowIndex);
    onChange({ ...keyboard, buttons: newButtons });
  };

  const handleRemoveButton = (rowIndex: number, buttonIndex: number) => {
    const newButtons = [...keyboard.buttons];
    newButtons[rowIndex] = newButtons[rowIndex].filter(
      (_, i) => i !== buttonIndex
    );

    // Удаляем пустые ряды
    const filteredButtons = newButtons.filter((row) => row.length > 0);
    onChange({ ...keyboard, buttons: filteredButtons });
  };

  const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
    const newButtons = [...keyboard.buttons];
    const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;

    if (targetIndex >= 0 && targetIndex < newButtons.length) {
      [newButtons[rowIndex], newButtons[targetIndex]] = [
        newButtons[targetIndex],
        newButtons[rowIndex]
      ];
      onChange({ ...keyboard, buttons: newButtons });
    }
  };

  const handleButtonChange = (
    rowIndex: number,
    buttonIndex: number,
    field: keyof KeyboardButton,
    value: any
  ) => {
    const newButtons = [...keyboard.buttons];
    const button = { ...newButtons[rowIndex][buttonIndex] };

    // Сбрасываем другие специальные поля при изменении типа кнопки
    if (field === 'request_contact' && value) {
      delete button.request_location;
      delete button.url;
      delete button.callback_data;
    } else if (field === 'request_location' && value) {
      delete button.request_contact;
      delete button.url;
      delete button.callback_data;
    } else if (field === 'url' && value) {
      delete button.request_contact;
      delete button.request_location;
      delete button.callback_data;
    } else if (field === 'callback_data' && value) {
      delete button.request_contact;
      delete button.request_location;
      delete button.url;
    }

    (button as any)[field] = value;
    newButtons[rowIndex][buttonIndex] = button;
    onChange({ ...keyboard, buttons: newButtons });
  };

  const getButtonType = (button: KeyboardButton): string => {
    if (button.request_contact) return 'contact';
    if (button.request_location) return 'location';
    if (button.url) return 'url';
    if (button.callback_data) return 'callback';
    return 'text';
  };

  // ✨ НОВОЕ: Функция для переключения hide_after_click
  const toggleHideAfterClick = (rowIndex: number, buttonIndex: number) => {
    const newButtons = [...keyboard.buttons];
    const button = { ...newButtons[rowIndex][buttonIndex] };
    button.hide_after_click = !button.hide_after_click;
    newButtons[rowIndex][buttonIndex] = button;
    onChange({ ...keyboard, buttons: newButtons });
  };

  if (!showEditor) {
    return (
      <div className={cn('space-y-2', className)}>
        <Label>Клавиатура</Label>
        <Button
          type='button'
          variant='outline'
          onClick={handleAddKeyboard}
          className='w-full'
        >
          <Keyboard className='mr-2 h-4 w-4' />
          Добавить клавиатуру
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Заголовок */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Keyboard className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Клавиатура</span>
          <Badge variant='outline' className='text-xs'>
            {keyboard.buttons.length} рядов
          </Badge>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={handleRemoveKeyboard}
          className='text-destructive hover:bg-destructive/10 hover:text-destructive'
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      </div>

      {/* Тип клавиатуры */}
      <div className='space-y-2'>
        <Label>Тип клавиатуры</Label>
        <Select
          value={keyboard.type}
          onValueChange={(v) => handleTypeChange(v as 'reply' | 'inline')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='reply'>
              <div className='flex items-center gap-2'>
                <Keyboard className='h-4 w-4' />
                <span>Reply - постоянная клавиатура</span>
              </div>
            </SelectItem>
            <SelectItem value='inline'>
              <div className='flex items-center gap-2'>
                <MousePointer className='h-4 w-4' />
                <span>Inline - кнопки под сообщением</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className='text-muted-foreground text-xs'>
          {keyboard.type === 'reply'
            ? 'Постоянная клавиатура заменяет системную клавиатуру пользователя'
            : 'Кнопки отображаются под сообщением и не занимают место клавиатуры'}
        </p>
      </div>

      {/* Ряды кнопок */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Label className='text-sm font-medium'>Кнопки</Label>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleAddRow}
            className='h-8 px-3 text-xs'
          >
            <Plus className='mr-1 h-3 w-3' />
            Добавить ряд
          </Button>
        </div>

        {keyboard.buttons.length === 0 && (
          <div className='bg-muted/50 rounded-lg border-2 border-dashed py-8 text-center'>
            <Keyboard className='text-muted-foreground mx-auto mb-2 h-8 w-8' />
            <p className='text-muted-foreground text-sm'>
              Нет кнопок. Добавьте первый ряд.
            </p>
          </div>
        )}

        {keyboard.buttons.map((row, rowIndex) => (
          <Card
            key={rowIndex}
            className='hover:border-primary/50 relative border transition-colors'
          >
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <CardTitle className='text-sm font-medium'>
                    Ряд {rowIndex + 1}
                  </CardTitle>
                  <Badge variant='secondary' className='text-xs'>
                    {row.length} кнопок
                  </Badge>
                </div>
                <div className='flex items-center gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => handleMoveRow(rowIndex, 'up')}
                    disabled={rowIndex === 0}
                    className='h-7 w-7 p-0'
                  >
                    <ArrowUp className='h-3 w-3' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => handleMoveRow(rowIndex, 'down')}
                    disabled={rowIndex === keyboard.buttons.length - 1}
                    className='h-7 w-7 p-0'
                  >
                    <ArrowDown className='h-3 w-3' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => handleRemoveRow(rowIndex)}
                    className='text-destructive hover:bg-destructive/10 hover:text-destructive h-7 w-7 p-0'
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              {row.map((button, buttonIndex) => (
                <div
                  key={buttonIndex}
                  className='bg-muted/50 space-y-3 rounded-lg border p-3'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='text-xs font-medium'>
                        Кнопка {buttonIndex + 1}
                      </Badge>
                      {button.hide_after_click && (
                        <Badge
                          variant='secondary'
                          className='bg-orange-500/20 px-1.5 py-0.5 text-[9px] text-orange-600 dark:text-orange-400'
                        >
                          Исчезнет
                        </Badge>
                      )}
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => handleRemoveButton(rowIndex, buttonIndex)}
                      className='text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6 p-0'
                    >
                      <Trash2 className='h-3 w-3' />
                    </Button>
                  </div>

                  {/* Текст кнопки */}
                  <div className='space-y-1'>
                    <Label className='text-xs'>Текст</Label>
                    <Input
                      value={button.text}
                      onChange={(e) =>
                        handleButtonChange(
                          rowIndex,
                          buttonIndex,
                          'text',
                          e.target.value
                        )
                      }
                      placeholder='Текст кнопки'
                    />
                  </div>

                  {/* Тип действия */}
                  <div className='space-y-1'>
                    <Label className='text-xs'>Действие</Label>
                    <Select
                      value={getButtonType(button)}
                      onValueChange={(type) => {
                        // Сбрасываем все поля действия
                        const newButton: KeyboardButton = { text: button.text };

                        if (type === 'contact') {
                          newButton.request_contact = true;
                        } else if (type === 'location') {
                          newButton.request_location = true;
                        } else if (type === 'url') {
                          newButton.url = '';
                        } else if (type === 'callback') {
                          newButton.callback_data = '';
                        }

                        const newButtons = [...keyboard.buttons];
                        newButtons[rowIndex][buttonIndex] = newButton;
                        onChange({ ...keyboard, buttons: newButtons });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='text'>
                          <div className='flex items-center gap-2'>
                            <span>Обычный текст</span>
                          </div>
                        </SelectItem>
                        {keyboard.type === 'reply' && (
                          <>
                            <SelectItem value='contact'>
                              <div className='flex items-center gap-2'>
                                <Phone className='h-3 w-3' />
                                <span>Запросить контакт</span>
                              </div>
                            </SelectItem>
                            <SelectItem value='location'>
                              <div className='flex items-center gap-2'>
                                <MapPin className='h-3 w-3' />
                                <span>Запросить геолокацию</span>
                              </div>
                            </SelectItem>
                          </>
                        )}
                        {keyboard.type === 'inline' && (
                          <>
                            <SelectItem value='url'>
                              <div className='flex items-center gap-2'>
                                <LinkIcon className='h-3 w-3' />
                                <span>Ссылка (URL)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value='callback'>
                              <div className='flex items-center gap-2'>
                                <MousePointer className='h-3 w-3' />
                                <span>Callback действие</span>
                              </div>
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Дополнительные поля в зависимости от типа */}
                  {button.url !== undefined && (
                    <div className='space-y-1'>
                      <Label className='text-xs'>URL</Label>
                      <Input
                        value={button.url}
                        onChange={(e) =>
                          handleButtonChange(
                            rowIndex,
                            buttonIndex,
                            'url',
                            e.target.value
                          )
                        }
                        placeholder='https://example.com'
                      />
                    </div>
                  )}

                  {button.callback_data !== undefined && (
                    <div className='space-y-1'>
                      <Label className='text-xs'>Callback Data</Label>
                      <Input
                        value={button.callback_data}
                        onChange={(e) =>
                          handleButtonChange(
                            rowIndex,
                            buttonIndex,
                            'callback_data',
                            e.target.value
                          )
                        }
                        placeholder='button_action'
                      />
                      <p className='text-muted-foreground text-xs'>
                        Данные, которые будут отправлены при нажатии
                      </p>
                    </div>
                  )}

                  {button.request_contact && (
                    <div className='flex items-center gap-2 rounded bg-emerald-50 p-2 text-xs text-emerald-600'>
                      <Phone className='h-3 w-3' />
                      <span>Пользователь поделится своим контактом</span>
                    </div>
                  )}

                  {button.request_location && (
                    <div className='flex items-center gap-2 rounded bg-blue-50 p-2 text-xs text-blue-600'>
                      <MapPin className='h-3 w-3' />
                      <span>Пользователь поделится своей геолокацией</span>
                    </div>
                  )}

                  {/* ✨ НОВОЕ: Настройка скрытия кнопки после нажатия */}
                  <div className='bg-muted flex items-center justify-between rounded border p-2'>
                    <div className='flex items-center gap-2'>
                      <input
                        type='checkbox'
                        id={`hide-${rowIndex}-${buttonIndex}`}
                        checked={button.hide_after_click || false}
                        onChange={() =>
                          toggleHideAfterClick(rowIndex, buttonIndex)
                        }
                        className='border-border text-primary focus:ring-primary h-3 w-3 rounded'
                      />
                      <Label
                        htmlFor={`hide-${rowIndex}-${buttonIndex}`}
                        className='text-foreground cursor-pointer text-xs'
                      >
                        Скрыть кнопку после нажатия
                      </Label>
                    </div>
                    {button.hide_after_click && (
                      <Badge
                        variant='secondary'
                        className='bg-orange-500/20 px-1.5 py-0.5 text-[9px] text-orange-600 dark:text-orange-400'
                      >
                        Исчезнет
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleAddButton(rowIndex)}
                className='h-8 w-full text-xs'
              >
                <Plus className='mr-1 h-3 w-3' />
                Добавить кнопку в ряд
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
