/**
 * @file: src/components/ui/telegram-rich-editor.tsx
 * @description: WYSIWYG редактор для Telegram с поддержкой переменных и HTML форматирования
 * Минимальный редактор с floating toolbar, адаптированный под Telegram
 * @project: SaaS Bonus System
 * @dependencies: Lexical, shadcn/ui
 * @created: 2025-11-29
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  InitialConfigType,
  LexicalComposer
} from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND
} from 'lexical';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TRANSFORMERS } from '@lexical/markdown';

import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { VariableSelector } from './variable-selector';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
  Variable,
  Undo,
  Redo
} from 'lucide-react';
import { cn } from '@/lib/utils';

const editorTheme = {
  root: 'ltr',
  paragraph: 'mb-1 ltr text-left',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-sm'
  },
  link: 'text-blue-600 hover:text-blue-800 underline cursor-pointer'
};

const editorNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  LinkNode,
  AutoLinkNode
];

interface TelegramRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showVariableHelper?: boolean;
  minHeight?: string;
}

// Плагин для конвертации HTML
function HTMLConverterPlugin({
  htmlValue,
  onHTMLChange,
  onInitialized
}: {
  htmlValue: string;
  onHTMLChange: (html: string) => void;
  onInitialized: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [lastLoadedValue, setLastLoadedValue] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (htmlValue && htmlValue !== lastLoadedValue) {
      console.log('Loading HTML into editor:', htmlValue);
      editor.update(() => {
        try {
          const parser = new DOMParser();
          const dom = parser.parseFromString(
            htmlValue || '<p></p>',
            'text/html'
          );
          const nodes = $generateNodesFromDOM(editor, dom);
          const root = $getRoot();
          root.clear();
          root.append(...nodes);
          setLastLoadedValue(htmlValue);
          setIsReady(true);
          onInitialized();
          console.log('HTML loaded successfully');
        } catch (error) {
          console.error('Error parsing HTML:', error);
        }
      });
    } else if (!htmlValue && !isReady) {
      // Если нет начального значения, сразу помечаем как готовый
      setIsReady(true);
      onInitialized();
    }
  }, [editor, htmlValue, lastLoadedValue, isReady, onInitialized]);

  useEffect(() => {
    if (!isReady) return;

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor, null);
        console.log('Editor content changed:', html);
        onHTMLChange(html);
      });
    });
  }, [editor, isReady, onHTMLChange]);

  return null;
}

// Плагин для вставки переменных
function VariableInsertPlugin({
  onVariableInsert
}: {
  onVariableInsert: (variable: string) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    (window as any).__insertTelegramVariable = (variable: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(`{${variable}}`);
        }
      });
      onVariableInsert(variable);
    };

    return () => {
      delete (window as any).__insertTelegramVariable;
    };
  }, [editor, onVariableInsert]);

  return null;
}

// Тулбар для форматирования
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat('bold'));
          setIsItalic(selection.hasFormat('italic'));
          setIsUnderline(selection.hasFormat('underline'));
          setIsStrikethrough(selection.hasFormat('strikethrough'));
          setIsCode(selection.hasFormat('code'));
        }
      });
    });
  }, [editor]);

  const formatText = (
    format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'
  ) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const insertLink = () => {
    if (linkUrl) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  return (
    <div className='flex flex-wrap items-center gap-1 border-b p-2'>
      <Button
        type='button'
        variant={isBold ? 'default' : 'ghost'}
        size='sm'
        onClick={() => formatText('bold')}
        className='h-8 w-8 p-0'
        title='Жирный (Ctrl+B)'
      >
        <Bold className='h-4 w-4' />
      </Button>

      <Button
        type='button'
        variant={isItalic ? 'default' : 'ghost'}
        size='sm'
        onClick={() => formatText('italic')}
        className='h-8 w-8 p-0'
        title='Курсив (Ctrl+I)'
      >
        <Italic className='h-4 w-4' />
      </Button>

      <Button
        type='button'
        variant={isUnderline ? 'default' : 'ghost'}
        size='sm'
        onClick={() => formatText('underline')}
        className='h-8 w-8 p-0'
        title='Подчеркнутый (Ctrl+U)'
      >
        <Underline className='h-4 w-4' />
      </Button>

      <Button
        type='button'
        variant={isStrikethrough ? 'default' : 'ghost'}
        size='sm'
        onClick={() => formatText('strikethrough')}
        className='h-8 w-8 p-0'
        title='Зачеркнутый'
      >
        <Strikethrough className='h-4 w-4' />
      </Button>

      <Button
        type='button'
        variant={isCode ? 'default' : 'ghost'}
        size='sm'
        onClick={() => formatText('code')}
        className='h-8 w-8 p-0'
        title='Код'
      >
        <CodeIcon className='h-4 w-4' />
      </Button>

      <div className='bg-border mx-1 h-6 w-px' />

      <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0'
            title='Вставить ссылку'
          >
            <LinkIcon className='h-4 w-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-80'>
          <div className='space-y-2'>
            <h4 className='text-sm font-medium'>Вставить ссылку</h4>
            <Input
              placeholder='https://example.com'
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertLink();
                }
              }}
            />
            <Button onClick={insertLink} size='sm' className='w-full'>
              Вставить
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className='bg-border mx-1 h-6 w-px' />

      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        className='h-8 w-8 p-0'
        title='Отменить (Ctrl+Z)'
      >
        <Undo className='h-4 w-4' />
      </Button>

      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        className='h-8 w-8 p-0'
        title='Повторить (Ctrl+Y)'
      >
        <Redo className='h-4 w-4' />
      </Button>
    </div>
  );
}

export function TelegramRichEditor({
  value,
  onChange,
  placeholder = 'Введите текст сообщения...',
  className,
  showVariableHelper = true,
  minHeight = '150px'
}: TelegramRichEditorProps) {
  const [htmlValue, setHtmlValue] = useState(value);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('TelegramRichEditor value changed:', value);
    if (value !== htmlValue) {
      setHtmlValue(value);
      setIsInitialized(false);
    }
  }, [value]);

  const handleHTMLChange = useCallback(
    (html: string) => {
      console.log('HTML changed:', html);
      setHtmlValue(html);
      onChange(html);
    },
    [onChange]
  );

  const handleInitialized = useCallback(() => {
    console.log('Editor initialized');
    setIsInitialized(true);
  }, []);

  const handleVariableInsert = useCallback((variable: string) => {
    if ((window as any).__insertTelegramVariable) {
      (window as any).__insertTelegramVariable(variable);
    }
  }, []);

  const textLength = htmlValue.replace(/<[^>]*>/g, '').length;
  const variableCount = (htmlValue.match(/\{[^}]+\}/g) || []).length;

  const editorConfig: InitialConfigType = {
    namespace: 'TelegramRichEditor',
    theme: editorTheme,
    nodes: editorNodes,
    editorState: undefined,
    onError: () => {
      // Silently handle Lexical errors
    }
  };

  return (
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
        <LexicalComposer initialConfig={editorConfig} key={value}>
          <ToolbarPlugin />
          <div className='bg-background relative' dir='ltr'>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className='overflow-auto px-4 py-3 outline-none'
                  style={{
                    minHeight,
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'embed'
                  }}
                  dir='ltr'
                />
              }
              placeholder={
                <div className='text-muted-foreground pointer-events-none absolute top-3 left-4 select-none'>
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <LinkPlugin />
            <ListPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <HTMLConverterPlugin
              htmlValue={htmlValue}
              onHTMLChange={handleHTMLChange}
              onInitialized={handleInitialized}
            />
            <VariableInsertPlugin onVariableInsert={handleVariableInsert} />
          </div>
        </LexicalComposer>
      </div>

      {/* Справка */}
      {showVariableHelper && (
        <div className='bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs'>
          <p className='mb-2 font-medium'>
            Поддерживаемое форматирование Telegram:
          </p>
          <ul className='ml-4 list-disc space-y-1'>
            <li>
              <strong>Жирный</strong> - Ctrl+B или{' '}
              <code className='bg-muted rounded px-1'>&lt;b&gt;</code>
            </li>
            <li>
              <em>Курсив</em> - Ctrl+I или{' '}
              <code className='bg-muted rounded px-1'>&lt;i&gt;</code>
            </li>
            <li>
              <u>Подчеркнутый</u> - Ctrl+U или{' '}
              <code className='bg-muted rounded px-1'>&lt;u&gt;</code>
            </li>
            <li>
              <s>Зачеркнутый</s> -{' '}
              <code className='bg-muted rounded px-1'>&lt;s&gt;</code>
            </li>
            <li>
              Код - <code className='bg-muted rounded px-1'>&lt;code&gt;</code>
            </li>
            <li>
              Ссылки -{' '}
              <code className='bg-muted rounded px-1'>
                &lt;a href="..."&gt;
              </code>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
