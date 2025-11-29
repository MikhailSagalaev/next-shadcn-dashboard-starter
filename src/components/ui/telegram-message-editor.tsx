/**
 * @file: src/components/ui/telegram-message-editor.tsx
 * @description: Обертка над shadcn-editor для Telegram сообщений с поддержкой переменных и HTML форматирования
 * @project: SaaS Bonus System
 * @dependencies: shadcn-editor (@/components/blocks/editor-x/editor), Lexical
 * @created: 2025-11-29
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { SerializedEditorState } from 'lexical';
import {
  InitialConfigType,
  LexicalComposer
} from '@lexical/react/LexicalComposer';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import { EditorState } from 'lexical';
import { editorTheme } from '@/components/editor/themes/editor-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { nodes } from '@/components/blocks/editor-x/nodes';
import { Plugins } from '@/components/blocks/editor-x/plugins';
import { VariableSelector } from './variable-selector';
import { Button } from './button';
import { Badge } from './badge';
import { Variable } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TelegramMessageEditorProps {
  value: string; // HTML строка
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showVariableHelper?: boolean;
}

const editorConfig: InitialConfigType = {
  namespace: 'TelegramMessageEditor',
  theme: editorTheme,
  nodes,
  onError: (error: Error) => {
    console.error('Lexical error:', error);
  }
};

// Плагин для конвертации HTML в Lexical и обратно
function HTMLConverterPlugin({
  htmlValue,
  onHTMLChange,
  isInitialized
}: {
  htmlValue: string;
  onHTMLChange: (html: string) => void;
  isInitialized: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  // Сохраняем ссылку на editor для использования в OnChangePlugin
  useEffect(() => {
    (window as any).__telegramEditor = editor;
    return () => {
      delete (window as any).__telegramEditor;
    };
  }, [editor]);

  // Инициализация: конвертируем HTML в Lexical state
  useEffect(() => {
    if (htmlValue && !isInitialized) {
      editor.update(() => {
        try {
          const parser = new DOMParser();
          const dom = parser.parseFromString(htmlValue, 'text/html');
          const lexicalNodes = $generateNodesFromDOM(editor, dom);
          const root = $getRoot();
          root.clear();
          root.append(...lexicalNodes);
        } catch (error) {
          console.error('Error parsing HTML:', error);
          // Fallback: создаем простой текстовый узел
          const root = $getRoot();
          root.clear();
          const paragraph = root.createParagraphNode();
          paragraph.append(
            root.createTextNode(htmlValue.replace(/<[^>]*>/g, ''))
          );
          root.append(paragraph);
        }
      });
    }
  }, [editor, htmlValue, isInitialized]);

  // Отслеживание изменений: конвертируем Lexical state в HTML
  useEffect(() => {
    if (!isInitialized) return;

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        try {
          const htmlString = $generateHtmlFromNodes(editor, null);
          onHTMLChange(htmlString);
        } catch (error) {
          console.error('Error generating HTML:', error);
        }
      });
    });
  }, [editor, isInitialized, onHTMLChange]);

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
    // Глобальная функция для вставки переменных
    (window as any).__insertTelegramVariable = (variable: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(`{${variable}}`);
        } else {
          const root = $getRoot();
          const firstChild = root.getFirstChild();
          if (firstChild) {
            firstChild.append(root.createTextNode(`{${variable}}`));
          } else {
            const paragraph = root.createParagraphNode();
            paragraph.append(root.createTextNode(`{${variable}}`));
            root.append(paragraph);
          }
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

export function TelegramMessageEditor({
  value,
  onChange,
  placeholder = 'Введите текст сообщения...',
  className,
  showVariableHelper = true
}: TelegramMessageEditorProps) {
  const [htmlValue, setHtmlValue] = useState(value);
  const [isInitialized, setIsInitialized] = useState(false);

  // Обновляем HTML при изменении извне
  useEffect(() => {
    if (value !== htmlValue) {
      setHtmlValue(value);
      setIsInitialized(false); // Переинициализируем при изменении извне
    }
  }, [value]);

  // Обработка изменения HTML
  const handleHTMLChange = useCallback(
    (html: string) => {
      setHtmlValue(html);
      onChange(html);
      if (!isInitialized) {
        setIsInitialized(true);
      }
    },
    [onChange, isInitialized]
  );

  // Вставка переменной
  const handleVariableInsert = useCallback((variable: string) => {
    if ((window as any).__insertTelegramVariable) {
      (window as any).__insertTelegramVariable(variable);
    }
  }, []);

  // Подсчет символов (без HTML тегов)
  const textLength = htmlValue.replace(/<[^>]*>/g, '').length;
  const variableCount = (htmlValue.match(/\{[^}]+\}/g) || []).length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Панель инструментов */}
      <div className='bg-muted/50 flex items-center justify-between rounded-lg border p-2'>
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

      {/* Редактор shadcn-editor */}
      <div className='bg-background overflow-hidden rounded-lg border shadow'>
        <LexicalComposer initialConfig={editorConfig}>
          <TooltipProvider>
            <Plugins />
            <HTMLConverterPlugin
              htmlValue={htmlValue}
              onHTMLChange={handleHTMLChange}
              isInitialized={isInitialized}
            />
            <VariableInsertPlugin onVariableInsert={handleVariableInsert} />
          </TooltipProvider>
        </LexicalComposer>
      </div>

      {/* Справка */}
      {showVariableHelper && (
        <div className='bg-muted/30 text-muted-foreground rounded-lg border p-3 text-sm'>
          <p>
            Используйте панель инструментов для форматирования текста.
            Поддерживаются теги Telegram:{' '}
            <code className='bg-muted rounded px-1'>&lt;b&gt;</code>,{' '}
            <code className='bg-muted rounded px-1'>&lt;i&gt;</code>,{' '}
            <code className='bg-muted rounded px-1'>&lt;u&gt;</code>,{' '}
            <code className='bg-muted rounded px-1'>&lt;s&gt;</code>,{' '}
            <code className='bg-muted rounded px-1'>&lt;code&gt;</code>,{' '}
            <code className='bg-muted rounded px-1'>&lt;a&gt;</code>
          </p>
        </div>
      )}
    </div>
  );
}
