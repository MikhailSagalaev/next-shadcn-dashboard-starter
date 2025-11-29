/**
 * @file: src/components/ui/telegram-message-editor.tsx
 * @description: WYSIWYG редактор для Telegram сообщений с поддержкой переменных и HTML форматирования
 * @project: SaaS Bonus System
 * @dependencies: TelegramRichEditor
 * @created: 2025-11-29
 * @updated: 2025-11-29
 * @author: AI Assistant + User
 */

'use client';

import { TelegramRichEditor } from './telegram-rich-editor';

interface TelegramMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showVariableHelper?: boolean;
  minHeight?: string;
  onSend?: (html: string) => void;
  showActions?: boolean;
}

export function TelegramMessageEditor({
  value,
  onChange,
  placeholder = 'Введите текст сообщения...',
  className,
  showVariableHelper = true,
  minHeight = '150px',
  onSend,
  showActions = true
}: TelegramMessageEditorProps) {
  return (
    <TelegramRichEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      showVariableHelper={showVariableHelper}
      minHeight={minHeight}
      onSend={onSend}
      showActions={showActions}
    />
  );
}
