/**
 * @file: src/components/ui/message-editor.tsx
 * @description: Улучшенный редактор сообщений с поддержкой переменных
 * @project: SaaS Bonus System
 * @created: 2025-10-15
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VariableSelector, useVariableAutocomplete } from './variable-selector';
import { KeyboardEditor, type KeyboardConfig } from './keyboard-editor';
import { MessageSquare, Eye, Code, Variable } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  keyboard?: KeyboardConfig | null;
  onKeyboardChange?: (keyboard: KeyboardConfig | null) => void;
  placeholder?: string;
  className?: string;
  showPreview?: boolean;
  showVariableHelper?: boolean;
  onFormattingRequest?: (
    accessor: (callback: (textarea: HTMLTextAreaElement) => void) => void
  ) => void;
}

export function MessageEditor({
  value,
  onChange,
  keyboard,
  onKeyboardChange,
  placeholder = 'Введите текст сообщения...',
  className,
  showPreview = true,
  showVariableHelper = true,
  onFormattingRequest
}: MessageEditorProps) {
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { suggestions, showSuggestions, handleTextChange, setShowSuggestions } =
    useVariableAutocomplete();

  // Предоставляем доступ к textarea для форматирования
  useEffect(() => {
    if (onFormattingRequest && textareaRef.current) {
      onFormattingRequest(
        (callback: (textarea: HTMLTextAreaElement) => void) => {
          if (textareaRef.current) {
            callback(textareaRef.current);
          }
        }
      );
    }
  }, [onFormattingRequest]);

  // Обработка изменения текста
  const handleTextChangeInternal = (newValue: string) => {
    onChange(newValue);

    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      setCursorPosition(cursorPos);
      handleTextChange(newValue, cursorPos);
    }
  };

  // Обработка вставки переменной
  const handleVariableInsert = (variableKey: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        value.substring(0, start) + `{${variableKey}}` + value.substring(end);

      onChange(newText);

      // Устанавливаем курсор после вставленной переменной
      setTimeout(() => {
        const newCursorPos = start + variableKey.length + 2; // +2 для {}
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  // Обработка выбора подсказки
  const handleSuggestionSelect = (suggestion: {
    key: string;
    label: string;
  }) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const beforeCursor = value.substring(0, start);
      const lastOpenBrace = beforeCursor.lastIndexOf('{');

      if (lastOpenBrace !== -1) {
        const newText =
          value.substring(0, lastOpenBrace + 1) +
          suggestion.key +
          '}' +
          value.substring(start);
        onChange(newText);

        setTimeout(() => {
          const newCursorPos = lastOpenBrace + suggestion.key.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }

      setShowSuggestions(false);
    }
  };

  // Обработка нажатий клавиш
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSuggestionSelect(suggestions[0]);
      }
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Панель инструментов */}
      <div className='flex items-center justify-between rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-3'>
        <div className='flex items-center gap-2'>
          <div className='flex h-6 w-6 items-center justify-center rounded-md bg-blue-100'>
            <MessageSquare className='h-3 w-3 text-blue-600' />
          </div>
          <span className='text-sm font-medium text-gray-900'>
            Редактор сообщения
          </span>
          {value && (
            <Badge variant='secondary' className='text-xs'>
              {value.length} символов
            </Badge>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {showVariableHelper && (
            <VariableSelector
              onVariableSelect={handleVariableInsert}
              trigger={
                <Button
                  variant='outline'
                  size='sm'
                  className='h-8 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 text-xs transition-all duration-200 hover:border-blue-300 hover:from-blue-100 hover:to-indigo-100 hover:shadow-md'
                >
                  <Variable className='mr-1.5 h-3 w-3 text-blue-600' />
                  <span className='font-medium text-blue-700'>Переменные</span>
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Редактор */}
      <div className='relative'>
        <div className='relative'>
          <div className='mb-2 flex items-center gap-2'>
            <Code className='h-4 w-4 text-gray-600' />
            <span className='text-sm font-medium text-gray-700'>
              Редактирование
            </span>
          </div>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleTextChangeInternal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className='min-h-[120px] border-gray-200 font-mono text-sm focus:border-blue-500 focus:ring-blue-500'
          />

          {/* Подсказки автодополнения */}
          {showSuggestions && suggestions.length > 0 && (
            <div className='absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg'>
              <div className='border-b border-gray-100 p-2'>
                <span className='text-xs font-medium text-gray-600'>
                  Доступные переменные:
                </span>
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.key}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className='flex w-full items-center justify-between border-b border-gray-50 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50'
                >
                  <div>
                    <div className='text-sm font-medium'>
                      {suggestion.label}
                    </div>
                    <div className='text-xs text-gray-500'>
                      {suggestion.key}
                    </div>
                  </div>
                  <Badge
                    variant='secondary'
                    className='bg-blue-100 text-xs text-blue-700'
                  >
                    {suggestion.key}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Статистика переменных */}
      {value && (
        <div className='rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-3'>
          <div className='flex items-center gap-4 text-xs'>
            <div className='flex items-center gap-1'>
              <div className='h-2 w-2 rounded-full bg-blue-500'></div>
              <span className='text-gray-600'>
                Символов: <strong>{value.length}</strong>
              </span>
            </div>
            <div className='flex items-center gap-1'>
              <div className='h-2 w-2 rounded-full bg-green-500'></div>
              <span className='text-gray-600'>
                Переменных:{' '}
                <strong>{(value.match(/\{[^}]+\}/g) || []).length}</strong>
              </span>
            </div>
            {value.includes('{') && !value.includes('}') && (
              <div className='flex items-center gap-1'>
                <div className='h-2 w-2 rounded-full bg-orange-500'></div>
                <span className='font-medium text-orange-600'>
                  ⚠️ Незакрытые переменные
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Редактор клавиатуры */}
      {onKeyboardChange && (
        <div className='border-t border-gray-200 pt-4'>
          <div className='mb-3 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-3'>
            <div className='mb-2 flex items-center gap-2'>
              <div className='flex h-5 w-5 items-center justify-center rounded-md bg-purple-100'>
                <span className='text-xs font-bold text-purple-600'>⌨️</span>
              </div>
              <h4 className='text-sm font-medium text-gray-900'>Клавиатура</h4>
            </div>
            <p className='text-xs text-gray-600'>
              Добавьте кнопки для взаимодействия с пользователем. Кнопки могут
              запрашивать контакт, геолокацию или выполнять callback действия.
            </p>
          </div>
          <KeyboardEditor
            value={keyboard || null}
            onChange={onKeyboardChange}
          />
        </div>
      )}

      {/* Справка по переменным */}
      {showVariableHelper && (
        <div className='rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3'>
          <div className='flex items-start gap-2'>
            <div className='mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-blue-100'>
              <span className='text-xs font-bold text-blue-600'>💡</span>
            </div>
            <div>
              <h4 className='mb-2 text-sm font-medium text-gray-900'>
                Как использовать переменные
              </h4>
              <ul className='space-y-1 text-xs text-gray-700'>
                <li className='flex items-center gap-2'>
                  <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                  Начните вводить{' '}
                  <code className='rounded bg-blue-100 px-1 text-blue-800'>
                    {'{'}
                  </code>{' '}
                  для автодополнения переменных
                </li>
                <li className='flex items-center gap-2'>
                  <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                  Используйте кнопку "Переменные" для выбора из списка
                </li>
                <li className='flex items-center gap-2'>
                  <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                  Переменные автоматически заменяются реальными данными
                  пользователя
                </li>
                <li className='flex items-center gap-2'>
                  <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                  Переключитесь в режим "Превью" чтобы увидеть результат
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Экспортируем типы для использования в других компонентах
export type { KeyboardConfig, KeyboardButton } from './keyboard-editor';
