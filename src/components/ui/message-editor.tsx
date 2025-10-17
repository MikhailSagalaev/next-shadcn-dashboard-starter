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
import { MessageSquare, Eye, Code, Variable } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showPreview?: boolean;
  showVariableHelper?: boolean;
}

export function MessageEditor({
  value,
  onChange,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium">Редактор сообщения</span>
        </div>
        
        <div className="flex items-center gap-2">
          {showVariableHelper && (
            <VariableSelector
              onVariableSelect={handleVariableInsert}
              trigger={
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <Variable className="h-4 w-4 mr-2 text-blue-600" />
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
            >
              {isPreviewMode ? (
                <>
                  <Code className="h-4 w-4 mr-2" />
                  Код
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
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
          <div className="min-h-[120px] p-3 border rounded-md bg-gray-50 whitespace-pre-wrap">
            {highlightVariables(renderPreview(value))}
          </div>
        ) : (
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleTextChangeInternal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[120px] font-mono text-sm"
            />
            
            {/* Подсказки автодополнения */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.key}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{suggestion.label}</div>
                      <div className="text-sm text-gray-500">{suggestion.key}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
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
        <div className="text-xs text-gray-500 flex items-center gap-4">
          <span>Символов: {value.length}</span>
          <span>
            Переменных: {(value.match(/\{[^}]+\}/g) || []).length}
          </span>
          {value.includes('{') && !value.includes('}') && (
            <span className="text-orange-500">⚠️ Незакрытые переменные</span>
          )}
        </div>
      )}

      {/* Справка по переменным */}
      {showVariableHelper && (
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
          <p><strong>💡 Подсказка:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Начните вводить <code>{'{'}</code> для автодополнения переменных</li>
            <li>Используйте кнопку "Переменные" для выбора из списка</li>
            <li>Переменные автоматически заменяются реальными данными пользователя</li>
            <li>Переключитесь в режим "Превью" чтобы увидеть результат</li>
          </ul>
        </div>
      )}
    </div>
  );
}
