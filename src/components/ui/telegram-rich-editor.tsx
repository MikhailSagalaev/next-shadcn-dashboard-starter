/**
 * @file: src/components/ui/telegram-rich-editor.tsx
 * @description: Простой редактор для Telegram с поддержкой HTML тегов и переменных
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from './button';
import { Badge } from './badge';
import { Textarea } from './textarea';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Separator } from './separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from './tooltip';
import { VariableSelector } from './variable-selector';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
  Variable,
  Copy,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TelegramRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showVariableHelper?: boolean;
  minHeight?: string;
  onSend?: (html: string) => void;
  showActions?: boolean;
}

export function TelegramRichEditor({
  value,
  onChange,
  placeholder = 'Введите текст сообщения...',
  className,
  showVariableHelper = true,
  minHeight = '150px'
}: TelegramRichEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  // Вставка тега вокруг выделенного текста
  const wrapSelection = useCallback(
    (openTag: string, closeTag: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      const newValue =
        value.substring(0, start) +
        openTag +
        selectedText +
        closeTag +
        value.substring(end);

      onChange(newValue);

      // Восстанавливаем фокус и позицию курсора
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + openTag.length + selectedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [value, onChange]
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = value.substring(0, start) + text + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        const newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [value, onChange]
  );

  const handleBold = () => wrapSelection('<b>', '</b>');
  const handleItalic = () => wrapSelection('<i>', '</i>');
  const handleUnderline = () => wrapSelection('<u>', '</u>');
  const handleStrike = () => wrapSelection('<s>', '</s>');
  const handleCode = () => wrapSelection('<code>', '</code>');

  const handleLink = () => {
    if (linkUrl) {
      const text = linkText || linkUrl;
      insertAtCursor(`<a href="${linkUrl}">${text}</a>`);
      setLinkUrl('');
      setLinkText('');
      setShowLinkInput(false);
    }
  };

  const handleVariableInsert = useCallback(
    (variable: string) => {
      insertAtCursor(`{${variable}}`);
    },
    [insertAtCursor]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const handleClear = () => {
    onChange('');
    textareaRef.current?.focus();
  };

  // Подсчёт статистики
  const textLength = value.replace(/<[^>]*>/g, '').length;
  const variableCount = (value.match(/\{[^}]+\}/g) || []).length;

  return (
    <TooltipProvider>
      <div className={cn('space-y-3', className)}>
        {/* Статистика и переменные */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary' className='text-xs'>
              {textLength} символов
            </Badge>
            {variableCount > 0 && (
              <Badge variant='secondary' className='text-xs'>
                {variableCount} переменных
              </Badge>
            )}
          </div>

          {showVariableHelper && (
            <VariableSelector
              onVariableSelect={handleVariableInsert}
              trigger={
                <Button variant='outline' size='sm' className='h-8'>
                  <Variable className='mr-2 h-4 w-4' />
                  Переменные
                </Button>
              }
            />
          )}
        </div>

        {/* Редактор */}
        <div className='overflow-hidden rounded-lg border shadow-sm'>
          {/* Тулбар */}
          <div className='bg-muted/30 flex flex-wrap items-center gap-1 border-b p-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleBold}
                  className='h-8 w-8 p-0'
                >
                  <Bold className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Жирный &lt;b&gt;</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleItalic}
                  className='h-8 w-8 p-0'
                >
                  <Italic className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Курсив &lt;i&gt;</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleUnderline}
                  className='h-8 w-8 p-0'
                >
                  <Underline className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Подчёркнутый &lt;u&gt;</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleStrike}
                  className='h-8 w-8 p-0'
                >
                  <Strikethrough className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Зачёркнутый &lt;s&gt;</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleCode}
                  className='h-8 w-8 p-0'
                >
                  <CodeIcon className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Код &lt;code&gt;</TooltipContent>
            </Tooltip>

            <Separator orientation='vertical' className='mx-1 h-6' />

            <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0'
                    >
                      <LinkIcon className='h-4 w-4' />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Ссылка</TooltipContent>
              </Tooltip>
              <PopoverContent className='w-80'>
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>Вставить ссылку</h4>
                  <Input
                    placeholder='https://example.com'
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                  <Input
                    placeholder='Текст ссылки (необязательно)'
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLink();
                      }
                    }}
                  />
                  <Button onClick={handleLink} size='sm' className='w-full'>
                    Вставить
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <div className='flex-1' />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleCopy}
                  className='h-8 w-8 p-0'
                >
                  <Copy className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Копировать</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleClear}
                  className='h-8 w-8 p-0'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Очистить</TooltipContent>
            </Tooltip>
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className='resize-none rounded-none border-0 focus-visible:ring-0'
            style={{ minHeight }}
          />
        </div>

        {/* Справка */}
        {showVariableHelper && (
          <div className='text-muted-foreground bg-muted/30 rounded-lg border p-3 text-xs'>
            <p className='mb-2 font-medium'>
              Поддерживаемые HTML теги Telegram:
            </p>
            <div className='flex flex-wrap gap-2'>
              <code className='bg-muted rounded px-1'>
                &lt;b&gt;жирный&lt;/b&gt;
              </code>
              <code className='bg-muted rounded px-1'>
                &lt;i&gt;курсив&lt;/i&gt;
              </code>
              <code className='bg-muted rounded px-1'>
                &lt;u&gt;подчёркнутый&lt;/u&gt;
              </code>
              <code className='bg-muted rounded px-1'>
                &lt;s&gt;зачёркнутый&lt;/s&gt;
              </code>
              <code className='bg-muted rounded px-1'>
                &lt;code&gt;код&lt;/code&gt;
              </code>
              <code className='bg-muted rounded px-1'>
                &lt;a href="..."&gt;ссылка&lt;/a&gt;
              </code>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
