/**
 * @file: bonus-mode-selector.tsx
 * @description: Переключатель режимов начисления бонусов
 * @project: SaaS Bonus System
 * @created: 2026-03-09
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { Percent, Target, AlertCircle } from 'lucide-react';
import { BonusModeCard } from './bonus-mode-card';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BonusModeSelectorProps {
  value: 'SIMPLE' | 'LEVELS';
  onChange: (mode: 'SIMPLE' | 'LEVELS') => void;
  hasLevels: boolean;
  levelsCount?: number;
}

export function BonusModeSelector({
  value,
  onChange,
  hasLevels,
  levelsCount = 0
}: BonusModeSelectorProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingMode, setPendingMode] = useState<'SIMPLE' | 'LEVELS' | null>(
    null
  );

  const handleModeClick = (mode: 'SIMPLE' | 'LEVELS') => {
    if (mode === value) return;

    // Если переключаемся с LEVELS на SIMPLE и есть уровни - показываем предупреждение
    if (mode === 'SIMPLE' && hasLevels && levelsCount > 0) {
      setPendingMode(mode);
      setShowConfirmDialog(true);
      return;
    }

    // Если переключаемся на LEVELS без уровней - показываем информацию
    if (mode === 'LEVELS' && !hasLevels) {
      setPendingMode(mode);
      setShowConfirmDialog(true);
      return;
    }

    onChange(mode);
  };

  const handleConfirm = () => {
    if (pendingMode) {
      onChange(pendingMode);
      setPendingMode(null);
    }
    setShowConfirmDialog(false);
  };

  const handleCancel = () => {
    setPendingMode(null);
    setShowConfirmDialog(false);
  };

  return (
    <>
      <div className='space-y-4'>
        <div>
          <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>
            Режим начисления бонусов
          </h3>
          <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
            Выберите, как будут начисляться бонусы вашим клиентам
          </p>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <BonusModeCard
            mode='SIMPLE'
            selected={value === 'SIMPLE'}
            onClick={() => handleModeClick('SIMPLE')}
            title='Простой режим'
            description='Фиксированный процент для всех клиентов'
            icon={Percent}
            features={[
              'Быстрая настройка за 1 минуту',
              'Одинаковый процент для всех',
              'Подходит для простых программ',
              'Легко понять клиентам'
            ]}
          />

          <BonusModeCard
            mode='LEVELS'
            selected={value === 'LEVELS'}
            onClick={() => handleModeClick('LEVELS')}
            title='Уровни бонусов'
            description='Процент зависит от суммы покупок клиента'
            icon={Target}
            features={[
              'Мотивация к большим покупкам',
              'Сегментация клиентов',
              'Гибкая настройка процентов',
              'Повышение лояльности'
            ]}
          />
        </div>

        {/* Info Alert */}
        {value === 'LEVELS' && !hasLevels && (
          <Alert className='border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'>
            <AlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
            <AlertTitle className='text-amber-900 dark:text-amber-100'>
              Настройте уровни бонусов
            </AlertTitle>
            <AlertDescription className='text-amber-700 dark:text-amber-300'>
              Вы выбрали режим "Уровни бонусов", но пока не создали ни одного
              уровня. Перейдите в раздел "Уровни бонусов" для настройки.
            </AlertDescription>
          </Alert>
        )}

        {value === 'LEVELS' && hasLevels && levelsCount > 0 && (
          <Alert className='border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'>
            <Target className='h-4 w-4 text-blue-600 dark:text-blue-400' />
            <AlertTitle className='text-blue-900 dark:text-blue-100'>
              Активно {levelsCount}{' '}
              {levelsCount === 1
                ? 'уровень'
                : levelsCount < 5
                  ? 'уровня'
                  : 'уровней'}
            </AlertTitle>
            <AlertDescription className='text-blue-700 dark:text-blue-300'>
              Процент начисления определяется уровнем клиента на основе общей
              суммы его покупок.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMode === 'SIMPLE'
                ? 'Переключить на простой режим?'
                : 'Переключить на уровни бонусов?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMode === 'SIMPLE' && hasLevels ? (
                <>
                  У вас настроено {levelsCount}{' '}
                  {levelsCount === 1
                    ? 'уровень'
                    : levelsCount < 5
                      ? 'уровня'
                      : 'уровней'}
                  . Они будут деактивированы, но не удалены. Вы сможете
                  вернуться к ним позже, переключившись обратно на режим "Уровни
                  бонусов".
                </>
              ) : pendingMode === 'LEVELS' && !hasLevels ? (
                <>
                  Вы переключаетесь на режим "Уровни бонусов". После
                  переключения вам нужно будет создать хотя бы один уровень в
                  разделе "Уровни бонусов", иначе начисление бонусов работать не
                  будет.
                </>
              ) : (
                'Вы уверены, что хотите изменить режим начисления бонусов?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Переключить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
