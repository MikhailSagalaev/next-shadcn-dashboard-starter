/**
 * @file: src/components/composite/confirm-dialog.tsx
 * @description: Универсальный диалог подтверждения действия
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { ReactNode, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export interface ConfirmDialogProps {
  // Dialog props
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | ReactNode;

  // Action props
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;

  // Styling
  variant?: 'default' | 'destructive';

  // Labels
  confirmLabel?: string;
  cancelLabel?: string;

  // Messages
  successMessage?: string;
  errorMessage?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  variant = 'default',
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  successMessage,
  errorMessage = 'Произошла ошибка'
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();

      if (successMessage) {
        toast({
          title: 'Успех',
          description: successMessage
        });
      }

      onOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : errorMessage;

      toast({
        title: 'Ошибка',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
