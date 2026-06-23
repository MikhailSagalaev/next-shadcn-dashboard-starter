/**
 * @file: src/components/ui/copy-button.tsx
 * @description: Переиспользуемая кнопка «скопировать в буфер обмена» с визуальным подтверждением
 * @project: SaaS Bonus System
 * @dependencies: React, lucide-react, button, use-toast
 */

'use client';

import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CopyButtonProps {
  /** Значение, которое копируется в буфер обмена. */
  value: string;
  /** Текст тоста при успешном копировании. */
  toastTitle?: string;
  /** Подпись для screen-reader / тултип. */
  label?: string;
  className?: string;
  size?: 'icon' | 'sm';
}

/**
 * Кнопка-иконка, копирующая `value` в буфер обмена. После копирования на
 * ~1.5с показывает галочку и тост.
 */
export function CopyButton({
  value,
  toastTitle = 'Скопировано',
  label = 'Копировать',
  className,
  size = 'icon'
}: CopyButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast({ title: toastTitle });
        setTimeout(() => setCopied(false), 1500);
      } catch {
        toast({
          title: 'Не удалось скопировать',
          variant: 'destructive'
        });
      }
    },
    [value, toastTitle, toast]
  );

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
        'shrink-0',
        className
      )}
    >
      {copied ? (
        <Check className='h-3.5 w-3.5 text-green-600' />
      ) : (
        <Copy className='h-3.5 w-3.5' />
      )}
    </Button>
  );
}
