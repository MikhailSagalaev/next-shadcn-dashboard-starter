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
import { Bold, Italic, Link, List, Code, Eye, EyeOff } from 'lucide-react';

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

import type { MessageConfig } from '@/types/bot-constructor';

interface MessageEditorProps {
  config: MessageConfig;
  onChange: (config: MessageConfig) => void;
}

export function MessageEditor({ config, onChange }: MessageEditorProps) {
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
  }, [text, parseMode, config, onChange]);

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

        <Select value={parseMode} onValueChange={setParseMode}>
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
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {/* Editor */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center justify-between text-sm'>
              Редактор
              <Badge variant='outline' className='text-xs'>
                {parseMode}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Введите текст сообщения...'
              className='min-h-[200px] font-mono text-sm'
              style={{ fontFamily: 'monospace' }}
            />
          </CardContent>
        </Card>

        {/* Preview */}
        {showPreview && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center justify-between text-sm'>
                Превью в Telegram
                <Badge variant='secondary' className='text-xs'>
                  {parseMode}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='min-h-[200px] rounded-lg bg-gray-100 p-3 dark:bg-gray-800'>
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
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Опции сообщения</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
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
