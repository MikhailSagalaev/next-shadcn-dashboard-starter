/**
 * @file: src/components/ui/telegram-rich-editor.tsx
 * @description: WYSIWYG редактор для Telegram с поддержкой переменных и HTML форматирования
 * Минимальный редактор с floating toolbar, адаптированный под Telegram
 * Вдохновлен shadcn-editor (https://shadcn-editor.vercel.app)
 * @project: SaaS Bonus System
 * @dependencies: Lexical, shadcn/ui
 * @created: 2025-11-29
 * @updated: 2025-11-29
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
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { exportFile, importFile } from '@lexical/file';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CLEAR_EDITOR_COMMAND
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
import { Separator } from './separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from './tooltip';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './dialog';
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
  Redo,
  Send,
  Upload,
  Download,
  Copy,
  Lock,
  Unlock,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const editorTheme = {
  ltr: 'ltr',
  rtl: 'ltr', // Принудительно LTR даже для RTL контента
  root: 'ltr text-left [direction:ltr]',
  paragraph: 'mb-1 ltr text-left [direction:ltr]',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-sm'
  },
  link: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
  heading: {
    h1: 'text-2xl font-bold mb-2 ltr text-left [direction:ltr]',
    h2: 'text-xl font-bold mb-2 ltr text-left [direction:ltr]',
    h3: 'text-lg font-bold mb-2 ltr text-left [direction:ltr]'
  },
  list: {
    ul: 'list-disc ml-4 ltr text-left [direction:ltr]',
    ol: 'list-decimal ml-4 ltr text-left [direction:ltr]',
    listitem: 'mb-1 ltr text-left [direction:ltr]'
  },
  quote: 'border-l-4 border-gray-300 pl-4 italic ltr text-left [direction:ltr]'
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
  onSend?: (html: string) => void;
  showActions?: boolean;
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

  // Функция для установки LTR направления на все ноды
  const setLTRDirection = () => {
    const root = $getRoot();
    root.setDirection('ltr');
    const children = root.getChildren();
    children.forEach((child) => {
      if ('setDirection' in child && typeof child.setDirection === 'function') {
        (child as any).setDirection('ltr');
      }
    });
  };

  useEffect(() => {
    if (htmlValue && htmlValue !== lastLoadedValue) {
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
          setLTRDirection();
          setLastLoadedValue(htmlValue);
          setIsReady(true);
          onInitialized();
        } catch {
          // Silently handle HTML parsing errors
        }
      });
    } else if (!htmlValue && !isReady) {
      editor.update(() => {
        setLTRDirection();
      });
      setIsReady(true);
      onInitialized();
    }
  }, [editor, htmlValue, lastLoadedValue, isReady, onInitialized]);

  useEffect(() => {
    if (!isReady) return;

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor, null);
        onHTMLChange(html);
      });
    });
  }, [editor, isReady, onHTMLChange]);

  return null;
}

// Плагин для принудительной установки LTR направления
function LTRPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Устанавливаем LTR при инициализации
    editor.update(() => {
      const root = $getRoot();
      root.setDirection('ltr');
      // Устанавливаем направление для всех дочерних элементов
      const children = root.getChildren();
      children.forEach((child) => {
        if (
          'setDirection' in child &&
          typeof child.setDirection === 'function'
        ) {
          (child as any).setDirection('ltr');
        }
      });
    });

    // Слушаем изменения и принудительно устанавливаем LTR
    return editor.registerUpdateListener(({ dirtyElements }) => {
      if (dirtyElements.size > 0) {
        editor.update(
          () => {
            const root = $getRoot();
            // Проверяем и исправляем направление root
            if (root.getDirection() !== 'ltr') {
              root.setDirection('ltr');
            }
            // Проверяем все дочерние элементы
            const children = root.getChildren();
            children.forEach((child) => {
              if ('getDirection' in child && 'setDirection' in child) {
                const childWithDir = child as any;
                if (childWithDir.getDirection() !== 'ltr') {
                  childWithDir.setDirection('ltr');
                }
              }
            });
          },
          { discrete: true }
        );
      }
    });
  }, [editor]);

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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant={isBold ? 'default' : 'ghost'}
            size='sm'
            onClick={() => formatText('bold')}
            className='h-8 w-8 p-0'
          >
            <Bold className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Жирный (Ctrl+B)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant={isItalic ? 'default' : 'ghost'}
            size='sm'
            onClick={() => formatText('italic')}
            className='h-8 w-8 p-0'
          >
            <Italic className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Курсив (Ctrl+I)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant={isUnderline ? 'default' : 'ghost'}
            size='sm'
            onClick={() => formatText('underline')}
            className='h-8 w-8 p-0'
          >
            <Underline className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Подчеркнутый (Ctrl+U)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant={isStrikethrough ? 'default' : 'ghost'}
            size='sm'
            onClick={() => formatText('strikethrough')}
            className='h-8 w-8 p-0'
          >
            <Strikethrough className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Зачеркнутый</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant={isCode ? 'default' : 'ghost'}
            size='sm'
            onClick={() => formatText('code')}
            className='h-8 w-8 p-0'
          >
            <CodeIcon className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Код</TooltipContent>
      </Tooltip>

      <Separator orientation='vertical' className='mx-1 !h-6' />

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
          <TooltipContent>Вставить ссылку</TooltipContent>
        </Tooltip>
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

      <Separator orientation='vertical' className='mx-1 !h-6' />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
            className='h-8 w-8 p-0'
          >
            <Undo className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Отменить (Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            className='h-8 w-8 p-0'
          >
            <Redo className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Повторить (Ctrl+Y)</TooltipContent>
      </Tooltip>
    </div>
  );
}

// Плагин действий (нижняя панель)
function ActionsPlugin({
  onSend,
  htmlValue
}: {
  onSend?: (html: string) => void;
  htmlValue: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [isEditable, setIsEditable] = useState(() => editor.isEditable());

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(htmlValue);
      toast.success('Содержимое скопировано');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const handleExport = () => {
    exportFile(editor, {
      fileName: `telegram-message-${new Date().toISOString().slice(0, 10)}`,
      source: 'TelegramRichEditor'
    });
    toast.success('Файл экспортирован');
  };

  const handleImport = () => {
    importFile(editor);
  };

  const toggleEditMode = () => {
    editor.setEditable(!editor.isEditable());
    setIsEditable(editor.isEditable());
  };

  return (
    <div className='flex items-center justify-between border-t p-2'>
      <div className='flex items-center gap-1'>
        {/* Send */}
        {onSend && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => onSend(htmlValue)}
                className='h-8 w-8 p-0'
              >
                <Send className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Отправить</TooltipContent>
          </Tooltip>
        )}

        {/* Import */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleImport}
              className='h-8 w-8 p-0'
            >
              <Upload className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Импорт</TooltipContent>
        </Tooltip>

        {/* Export */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleExport}
              className='h-8 w-8 p-0'
            >
              <Download className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Экспорт</TooltipContent>
        </Tooltip>

        {/* Copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleCopyContent}
              className='h-8 w-8 p-0'
            >
              <Copy className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Копировать</TooltipContent>
        </Tooltip>

        {/* Lock/Unlock */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={toggleEditMode}
              className='h-8 w-8 p-0'
            >
              {isEditable ? (
                <Lock className='h-4 w-4' />
              ) : (
                <Unlock className='h-4 w-4' />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isEditable ? 'Режим просмотра' : 'Режим редактирования'}
          </TooltipContent>
        </Tooltip>

        {/* Clear */}
        <ClearEditorActionPlugin />
      </div>
    </div>
  );
}

// Плагин очистки редактора с подтверждением
function ClearEditorActionPlugin() {
  const [editor] = useLexicalComposerContext();

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-8 w-8 p-0'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Очистить</TooltipContent>
      </Tooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Очистить редактор</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите очистить содержимое редактора? Это действие
            нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>Отмена</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant='destructive'
              onClick={() => {
                editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
                toast.success('Редактор очищен');
              }}
            >
              Очистить
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TelegramRichEditor({
  value,
  onChange,
  placeholder = 'Введите текст сообщения...',
  className,
  showVariableHelper = true,
  minHeight = '150px',
  onSend,
  showActions = true
}: TelegramRichEditorProps) {
  const [htmlValue, setHtmlValue] = useState(value);

  useEffect(() => {
    if (value !== htmlValue) {
      setHtmlValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleHTMLChange = useCallback(
    (html: string) => {
      setHtmlValue(html);
      onChange(html);
    },
    [onChange]
  );

  const handleInitialized = useCallback(() => {
    // Редактор инициализирован
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
        <LexicalComposer initialConfig={editorConfig}>
          <TooltipProvider>
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
              <LTRPlugin />
              <HistoryPlugin />
              <AutoFocusPlugin />
              <LinkPlugin />
              <ListPlugin />
              <ClearEditorPlugin />
              <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
              <HTMLConverterPlugin
                htmlValue={htmlValue}
                onHTMLChange={handleHTMLChange}
                onInitialized={handleInitialized}
              />
              <VariableInsertPlugin onVariableInsert={handleVariableInsert} />
            </div>
            {showActions && (
              <ActionsPlugin onSend={onSend} htmlValue={htmlValue} />
            )}
          </TooltipProvider>
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
