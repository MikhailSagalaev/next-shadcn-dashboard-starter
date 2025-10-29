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
}

export function MessageEditor({
  value,
  onChange,
  keyboard,
  onKeyboardChange,
  placeholder = "Введите текст сообщения...",
  className,
  showPreview = true,
  showVariableHelper = true
}: MessageEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { suggestions, showSuggestions, handleTextChange, setShowSuggestions } = useVariableAutocomplete();

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
      const newText = value.substring(0, start) + `{${variableKey}}` + value.substring(end);
      
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
  const handleSuggestionSelect = (suggestion: {key: string, label: string}) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const beforeCursor = value.substring(0, start);
      const lastOpenBrace = beforeCursor.lastIndexOf('{');
      
      if (lastOpenBrace !== -1) {
        const newText = value.substring(0, lastOpenBrace + 1) + suggestion.key + '}' + value.substring(start);
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

  // Подсветка переменных в тексте
  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{[^}]+\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return (
          <Badge key={index} variant="secondary" className="mx-1">
            {part}
          </Badge>
        );
      }
      return part;
    });
  };

  // Предварительный просмотр с заменой переменных (заглушка)
  const renderPreview = (text: string) => {
    return text
      .replace(/\{user\.firstName\}/g, 'Иван')
      .replace(/\{user\.lastName\}/g, 'Петров')
      .replace(/\{user\.fullName\}/g, 'Иван Петров')
      .replace(/\{user\.balanceFormatted\}/g, '1,250 бонусов')
      .replace(/\{user\.currentLevel\}/g, 'Золотой')
      .replace(/\{user\.referralCode\}/g, 'REF123')
      .replace(/\{user\.referralLink\}/g, 'https://t.me/bot?start=ref_REF123')
      .replace(/\{user\.totalEarnedFormatted\}/g, '5,000 бонусов')
      .replace(/\{user\.totalSpentFormatted\}/g, '3,750 бонусов')
      .replace(/\{user\.totalPurchasesFormatted\}/g, '25,000 ₽')
      .replace(/\{user\.email\}/g, 'ivan@example.com')
      .replace(/\{user\.phone\}/g, '+7 (999) 123-45-67')
      .replace(/\{user\.telegramUsername\}/g, '@ivan_petrov')
      .replace(/\{user\.registeredAt\}/g, '15.10.2025, 14:30')
      .replace(/\{user\.transactionCount\}/g, '15')
      .replace(/\{user\.bonusCount\}/g, '8')
      .replace(/\{[^}]+\}/g, '❓ Неизвестная переменная');
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Панель инструментов */}
      <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
            <MessageSquare className="h-3 w-3 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-900">Редактор сообщения</span>
          {value && (
            <Badge variant="secondary" className="text-xs">
              {value.length} символов
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {showVariableHelper && (
            <VariableSelector
              onVariableSelect={handleVariableInsert}
              trigger={
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-md transition-all duration-200 h-8 px-3 text-xs"
                >
                  <Variable className="h-3 w-3 mr-1.5 text-blue-600" />
                  <span className="font-medium text-blue-700">Переменные</span>
                </Button>
              }
            />
          )}
          
          {showPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="h-8 px-3 text-xs"
            >
              {isPreviewMode ? (
                <>
                  <Code className="h-3 w-3 mr-1.5" />
                  Код
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1.5" />
                  Превью
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Редактор */}
      <div className="relative">
        {isPreviewMode ? (
          <div className="min-h-[120px] p-4 border border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-blue-50 whitespace-pre-wrap shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Предварительный просмотр</span>
            </div>
            <div className="text-sm text-gray-800 leading-relaxed">
              {highlightVariables(renderPreview(value))}
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Редактирование</span>
            </div>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleTextChangeInternal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[120px] font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
            
            {/* Подсказки автодополнения */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-600">Доступные переменные:</span>
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.key}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 last:border-b-0"
                  >
                    <div>
                      <div className="font-medium text-sm">{suggestion.label}</div>
                      <div className="text-xs text-gray-500">{suggestion.key}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                      {suggestion.key}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Статистика переменных */}
      {value && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Символов: <strong>{value.length}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Переменных: <strong>{(value.match(/\{[^}]+\}/g) || []).length}</strong></span>
            </div>
            {value.includes('{') && !value.includes('}') && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-orange-600 font-medium">⚠️ Незакрытые переменные</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Редактор клавиатуры */}
      {onKeyboardChange && (
        <div className="pt-4 border-t border-gray-200">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-purple-100 rounded-md flex items-center justify-center">
                <span className="text-xs font-bold text-purple-600">⌨️</span>
              </div>
              <h4 className="font-medium text-gray-900 text-sm">Клавиатура</h4>
            </div>
            <p className="text-xs text-gray-600">
              Добавьте кнопки для взаимодействия с пользователем. Кнопки могут запрашивать контакт, геолокацию или выполнять callback действия.
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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600">💡</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 text-sm mb-2">Как использовать переменные</h4>
              <ul className="text-xs text-gray-700 space-y-1">
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  Начните вводить <code className="bg-blue-100 px-1 rounded text-blue-800">{'{'}</code> для автодополнения переменных
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  Используйте кнопку "Переменные" для выбора из списка
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  Переменные автоматически заменяются реальными данными пользователя
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
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
