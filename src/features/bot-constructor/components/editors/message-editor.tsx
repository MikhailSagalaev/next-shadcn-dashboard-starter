/**
 * @file: src/features/bot-constructor/components/editors/message-editor.tsx
 * @description: WYSIWYG редактор сообщений с превью в стиле Telegram
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, Telegram-style preview
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bold, Italic, Link, List, Code, Eye, EyeOff, Plus, Trash2, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { MessageConfig } from '@/types/bot-constructor';

interface MessageEditorProps {
  config: MessageConfig;
  onChange: (config: MessageConfig) => void;
  availableNodes?: Array<{ id: string; data: { label: string } }>;
}

export function MessageEditor({ config, onChange, availableNodes = [] }: MessageEditorProps) {
  const [text, setText] = useState(config.text || '');
  const [parseMode, setParseMode] = useState(config.parseMode || 'Markdown');
  const [showPreview, setShowPreview] = useState(true);

  // Update parent when text changes
  useEffect(() => {
    onChange({
      ...config,
      text,
      parseMode: parseMode as 'Markdown' | 'HTML' | 'MarkdownV2'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, parseMode]);

  // Format text helpers
  const insertFormat = useCallback(
    (before: string, after: string = '') => {
      const textarea = document.querySelector(
        'textarea'
      ) as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = text.substring(start, end);
      const newText =
        text.substring(0, start) +
        before +
        selectedText +
        after +
        text.substring(end);

      setText(newText);

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, end + before.length);
      }, 0);
    },
    [text]
  );

  // Render preview based on parse mode
  const renderPreview = useCallback(() => {
    if (!text.trim()) {
      return (
        <div className='text-muted-foreground italic'>
          Текст сообщения будет отображаться здесь...
        </div>
      );
    }

    try {
      switch (parseMode) {
        case 'Markdown':
        case 'MarkdownV2':
          return renderMarkdownPreview(text);
        case 'HTML':
          return renderHTMLPreview(text);
        default:
          return <div className='whitespace-pre-wrap'>{text}</div>;
      }
    } catch (error) {
      return (
        <div className='text-destructive'>
          Ошибка в разметке:{' '}
          {error instanceof Error ? error.message : 'Неизвестная ошибка'}
        </div>
      );
    }
  }, [text, parseMode]);

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='bg-muted flex items-center space-x-2 rounded-lg p-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => insertFormat('**', '**')}
          title='Жирный'
        >
          <Bold className='h-4 w-4' />
        </Button>

        <Button
          variant='ghost'
          size='sm'
          onClick={() => insertFormat('*', '*')}
          title='Курсив'
        >
          <Italic className='h-4 w-4' />
        </Button>

        <Button
          variant='ghost'
          size='sm'
          onClick={() => insertFormat('[', '](url)')}
          title='Ссылка'
        >
          <Link className='h-4 w-4' />
        </Button>

        <Button
          variant='ghost'
          size='sm'
          onClick={() => insertFormat('- ', '')}
          title='Список'
        >
          <List className='h-4 w-4' />
        </Button>

        <Button
          variant='ghost'
          size='sm'
          onClick={() => insertFormat('`', '`')}
          title='Код'
        >
          <Code className='h-4 w-4' />
        </Button>

        <Separator orientation='vertical' className='h-6' />

        <Select value={parseMode} onValueChange={(value) => setParseMode(value as "Markdown" | "HTML" | "MarkdownV2")}>
          <SelectTrigger className='w-32'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='Markdown'>Markdown</SelectItem>
            <SelectItem value='HTML'>HTML</SelectItem>
            <SelectItem value='MarkdownV2'>MarkdownV2</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant='ghost'
          size='sm'
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? (
            <EyeOff className='h-4 w-4' />
          ) : (
            <Eye className='h-4 w-4' />
          )}
        </Button>
      </div>

      {/* Editor and Preview */}
      <div className='grid grid-cols-1 gap-4'>
        {/* Editor */}
        <Card className='w-full'>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center justify-between text-sm'>
              Редактор
              <Badge variant='outline' className='text-xs'>
                {parseMode}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className='pt-2'>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Введите текст сообщения...'
              className='min-h-[200px] w-full font-mono text-sm'
              style={{ fontFamily: 'monospace' }}
            />
          </CardContent>
        </Card>

        {/* Preview */}
        {showPreview && (
          <Card className='w-full'>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center justify-between text-sm'>
                Превью в Telegram
                <Badge variant='secondary' className='text-xs'>
                  {parseMode}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className='pt-2'>
              <div className='min-h-[200px] w-full rounded-lg bg-gray-100 p-3 dark:bg-gray-800'>
                <div className='max-w-sm rounded-lg bg-white p-3 shadow-sm dark:bg-gray-700'>
                  {/* Telegram-style message bubble */}
                  <div className='flex items-start space-x-2'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white'>
                      Б
                    </div>
                    <div className='flex-1'>
                      <div className='mb-1 flex items-center space-x-2'>
                        <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                          Bot
                        </span>
                        <span className='text-xs text-gray-500'>сейчас</span>
                      </div>
                      <div className='text-sm leading-relaxed text-gray-900 dark:text-gray-100'>
                        {renderPreview()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Message Options */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm'>Опции сообщения</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 pt-2'>
          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='disablePreview'
              checked={config.disablePreview || false}
              onChange={(e) =>
                onChange({ ...config, disablePreview: e.target.checked })
              }
            />
            <label htmlFor='disablePreview' className='text-sm'>
              Отключить превью ссылок
            </label>
          </div>

          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='protectContent'
              checked={config.protectContent || false}
              onChange={(e) =>
                onChange({ ...config, protectContent: e.target.checked })
              }
            />
            <label htmlFor='protectContent' className='text-sm'>
              Защитить контент (запрет пересылки)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ✨ НОВОЕ: Настройка кнопок */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm flex items-center justify-between'>
            Кнопки
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                const keyboard = config.keyboard || { type: 'inline', buttons: [] };
                onChange({
                  ...config,
                  keyboard: keyboard.buttons.length > 0 ? undefined : { type: 'inline', buttons: [[]] }
                });
              }}
            >
              {config.keyboard ? 'Удалить клавиатуру' : 'Добавить кнопки'}
            </Button>
          </CardTitle>
        </CardHeader>
        {config.keyboard && (
          <CardContent className='space-y-3 pt-2'>
            {/* Тип клавиатуры */}
            <div className='space-y-2'>
              <Label>Тип клавиатуры</Label>
              <Select
                value={config.keyboard.type || 'inline'}
                onValueChange={(value) =>
                  onChange({
                    ...config,
                    keyboard: { ...config.keyboard, type: value as 'inline' | 'reply', buttons: config.keyboard?.buttons || [[]] }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='inline'>Inline (под сообщением)</SelectItem>
                  <SelectItem value='reply'>Reply (заменяет клавиатуру)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Кнопки */}
            <div className='space-y-3'>
              <Label>Кнопки (по рядам)</Label>
              {(config.keyboard.buttons || [[]]).map((row, rowIndex) => (
                <div key={rowIndex} className='space-y-2 rounded-lg border p-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>Ряд {rowIndex + 1}</span>
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => {
                          const newButtons = [...(config.keyboard?.buttons || [])];
                          newButtons[rowIndex] = [...(newButtons[rowIndex] || []), { text: 'Кнопка' }];
                          onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                        }}
                      >
                        <Plus className='h-3 w-3' />
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => {
                          const newButtons = (config.keyboard?.buttons || []).filter((_, i) => i !== rowIndex);
                          onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                        }}
                      >
                        <Trash2 className='h-3 w-3' />
                      </Button>
                    </div>
                  </div>

                  {row.map((button, btnIndex) => (
                    <div key={btnIndex} className='flex items-start gap-2 rounded border p-2'>
                      <div className='flex-1 space-y-2'>
                        <Input
                          placeholder='Текст кнопки'
                          value={button.text || ''}
                          onChange={(e) => {
                            const newButtons = [...(config.keyboard?.buttons || [])];
                            newButtons[rowIndex][btnIndex] = { ...button, text: e.target.value };
                            onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                          }}
                        />

                            {config.keyboard?.type === 'inline' && (
                              <div className='space-y-3'>
                                {/* Тип действия */}
                                <div>
                                  <Label className='text-xs text-muted-foreground mb-2 block'>Тип действия кнопки</Label>
                                  <Select
                                    value={
                                      (button as any).callbackData ? 'callback' :
                                      (button as any).url ? 'url' :
                                      (button as any).goto_node ? 'goto' : 'none'
                                    }
                                    onValueChange={(actionType) => {
                                      const newButtons = [...(config.keyboard?.buttons || [])];
                                      const updated = { ...button };

                                      // Очищаем все поля действия
                                      delete (updated as any).callbackData;
                                      delete (updated as any).url;
                                      delete (updated as any).goto_node;

                                      // Устанавливаем выбранный тип
                                      if (actionType === 'callback') {
                                        (updated as any).callbackData = '';
                                      } else if (actionType === 'url') {
                                        (updated as any).url = '';
                                      } else if (actionType === 'goto') {
                                        (updated as any).goto_node = '';
                                      }

                                      newButtons[rowIndex][btnIndex] = updated;
                                      onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Выберите тип действия" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Без действия</SelectItem>
                                      <SelectItem value="callback">Callback данные (для обработки в коде)</SelectItem>
                                      <SelectItem value="url">Ссылка (откроется в браузере)</SelectItem>
                                      <SelectItem value="goto">Переход к ноде (внутри сценария)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Поля в зависимости от типа */}
                                {(button as any).callbackData !== undefined && (
                                  <Input
                                    placeholder='Данные для callback (например: "btn_click")'
                                    value={(button as any).callbackData || ''}
                                    onChange={(e) => {
                                      const newButtons = [...(config.keyboard?.buttons || [])];
                                      newButtons[rowIndex][btnIndex] = { ...button, callbackData: e.target.value };
                                      onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                                    }}
                                  />
                                )}

                                {(button as any).url !== undefined && (
                                  <Input
                                    placeholder='URL ссылки (например: https://example.com)'
                                    value={(button as any).url || ''}
                                    onChange={(e) => {
                                      const newButtons = [...(config.keyboard?.buttons || [])];
                                      newButtons[rowIndex][btnIndex] = { ...button, url: e.target.value };
                                      onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                                    }}
                                  />
                                )}

                                {(button as any).goto_node !== undefined && (
                                  <Select
                                    value={(button as any).goto_node || ''}
                                    onValueChange={(value) => {
                                      const newButtons = [...(config.keyboard?.buttons || [])];
                                      newButtons[rowIndex][btnIndex] = { ...button, goto_node: value } as any;
                                      onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Выберите ноду для перехода..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableNodes
                                        .filter(n => n.id !== 'current') // Исключаем текущую ноду
                                        .map(node => (
                                          <SelectItem key={node.id} value={node.id}>
                                            {node.data.label} ({node.id})
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            )}

                        {config.keyboard?.type === 'reply' && (
                          <div className='flex gap-2'>
                            <label className='flex items-center gap-1 text-sm'>
                              <input
                                type='checkbox'
                                checked={(button as any).request_contact || false}
                                onChange={(e) => {
                                const newButtons = [...(config.keyboard?.buttons || [])];
                                newButtons[rowIndex][btnIndex] = { 
                                  text: button.text, 
                                  request_contact: e.target.checked 
                                } as any;
                                onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } as any });
                                }}
                              />
                              Запросить контакт
                            </label>
                            <label className='flex items-center gap-1 text-sm'>
                              <input
                                type='checkbox'
                                checked={(button as any).request_location || false}
                                onChange={(e) => {
                                const newButtons = [...(config.keyboard?.buttons || [])];
                                newButtons[rowIndex][btnIndex] = { 
                                  text: button.text, 
                                  request_location: e.target.checked 
                                } as any;
                                onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } as any });
                                }}
                              />
                              Запросить локацию
                            </label>
                          </div>
                        )}
                      </div>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => {
                          const newButtons = [...(config.keyboard?.buttons || [])];
                          newButtons[rowIndex] = newButtons[rowIndex].filter((_, i) => i !== btnIndex);
                          onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                        }}
                      >
                        <Trash2 className='h-3 w-3' />
                      </Button>
                    </div>
                  ))}
                </div>
              ))}

              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  const newButtons = [...(config.keyboard?.buttons || []), []];
                  onChange({ ...config, keyboard: { ...config.keyboard, buttons: newButtons } });
                }}
              >
                <Plus className='h-4 w-4 mr-2' />
                Добавить ряд кнопок
              </Button>
            </div>

            {/* Дополнительные опции для Reply клавиатуры */}
            {config.keyboard.type === 'reply' && (
              <div className='space-y-2 pt-2 border-t'>
                <Label className='text-xs text-muted-foreground'>Дополнительные опции</Label>
                <div className='flex gap-4'>
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='checkbox'
                      checked={(config.keyboard as any).one_time_keyboard || false}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          keyboard: { ...config.keyboard, one_time_keyboard: e.target.checked } as any
                        })
                      }
                    />
                    Скрыть после нажатия
                  </label>
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='checkbox'
                      checked={(config.keyboard as any).resize_keyboard !== false}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          keyboard: { ...config.keyboard, resize_keyboard: e.target.checked } as any
                        })
                      }
                    />
                    Адаптировать размер
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Markdown preview renderer
function renderMarkdownPreview(text: string): React.ReactNode {
  // Simple markdown parser for preview
  return text.split('\n').map((line, i) => {
    // Bold
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code
    line = line.replace(
      /`(.*?)`/g,
      '<code class="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">$1</code>'
    );
    // Links
    line = line.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-500 underline">$1</a>'
    );
    // Lists
    if (line.startsWith('- ')) {
      line = '• ' + line.substring(2);
    }

    return (
      <div key={i} className='mb-1'>
        <span dangerouslySetInnerHTML={{ __html: line || '\u00A0' }} />
      </div>
    );
  });
}

// HTML preview renderer
function renderHTMLPreview(text: string): React.ReactNode {
  return <div dangerouslySetInnerHTML={{ __html: text }} />;
}
