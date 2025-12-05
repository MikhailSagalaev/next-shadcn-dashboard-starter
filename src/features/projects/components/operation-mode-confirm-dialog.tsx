/**
 * @file: src/features/projects/components/operation-mode-confirm-dialog.tsx
 * @description: Диалог подтверждения изменения режима работы проекта
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn UI
 * @created: 2025-12-05
 * @author: AI Assistant + User
 */

'use client';

import { AlertTriangle, Bot, Globe } from 'lucide-react';
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
import type { OperationMode } from './operation-mode-selector';

interface OperationModeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: OperationMode;
  newMode: OperationMode;
  existingUsersCount: number;
  onConfirm: () => void;
}

export function OperationModeConfirmDialog({
  open,
  onOpenChange,
  currentMode,
  newMode,
  existingUsersCount,
  onConfirm
}: OperationModeConfirmDialogProps) {
  const isChangingToWithBot = newMode === 'WITH_BOT';

  const getModeLabel = (mode: OperationMode) => {
    return mode === 'WITH_BOT' ? 'С Telegram ботом' : 'Без Telegram бота';
  };

  const getModeIcon = (mode: OperationMode) => {
    return mode === 'WITH_BOT' ? (
      <Bot className='h-4 w-4 text-blue-500' />
    ) : (
      <Globe className='h-4 w-4 text-green-500' />
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-yellow-500' />
            Изменение режима работы
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-4'>
              <p>Вы собираетесь изменить режим работы проекта:</p>

              <div className='bg-muted flex items-center justify-center gap-4 rounded-md p-4'>
                <div className='flex items-center gap-2'>
                  {getModeIcon(currentMode)}
                  <span className='font-medium'>
                    {getModeLabel(currentMode)}
                  </span>
                </div>
                <span className='text-muted-foreground'>→</span>
                <div className='flex items-center gap-2'>
                  {getModeIcon(newMode)}
                  <span className='font-medium'>{getModeLabel(newMode)}</span>
                </div>
              </div>

              {existingUsersCount > 0 && (
                <div className='rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950'>
                  <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                    <strong>Внимание:</strong> В проекте {existingUsersCount}{' '}
                    {existingUsersCount === 1
                      ? 'пользователь'
                      : existingUsersCount < 5
                        ? 'пользователя'
                        : 'пользователей'}
                    .
                  </p>
                </div>
              )}

              <div className='space-y-2 text-sm'>
                <p className='font-medium'>Что произойдёт:</p>
                {isChangingToWithBot ? (
                  <ul className='text-muted-foreground list-inside list-disc space-y-1'>
                    <li>Новые пользователи будут создаваться неактивными</li>
                    <li>
                      Для траты бонусов потребуется активация через Telegram
                    </li>
                    <li>
                      Существующие неактивные пользователи не смогут тратить
                      бонусы
                    </li>
                    <li>Telegram бот будет инициализирован (если настроен)</li>
                  </ul>
                ) : (
                  <ul className='text-muted-foreground list-inside list-disc space-y-1'>
                    <li>
                      Новые пользователи будут автоматически активироваться
                    </li>
                    <li>Все пользователи смогут тратить бонусы без Telegram</li>
                    <li>Telegram бот будет остановлен</li>
                    <li>
                      Настройки Telegram бота сохранятся для возможного возврата
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Подтвердить изменение
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
