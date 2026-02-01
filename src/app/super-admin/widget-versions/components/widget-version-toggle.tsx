/**
 * @file: src/app/super-admin/widget-versions/components/widget-version-toggle.tsx
 * @description: Компонент переключения версии виджета для проекта
 * @project: SaaS Bonus System
 * @created: 2026-02-01
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
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

interface WidgetVersionToggleProps {
  projectId: string;
  projectName: string;
  currentVersion: string;
}

export function WidgetVersionToggle({
  projectId,
  projectName,
  currentVersion
}: WidgetVersionToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const targetVersion = currentVersion === 'legacy' ? 'universal' : 'legacy';

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/super-admin/projects/${projectId}/widget-version`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ version: targetVersion })
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка при изменении версии');
      }

      toast({
        title: 'Версия виджета изменена',
        description: `Проект "${projectName}" переключен на ${targetVersion === 'legacy' ? 'Legacy' : 'Universal'} версию`
      });

      // Обновляем страницу
      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось изменить версию виджета',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setShowConfirm(true)}
        disabled={isLoading}
        className='gap-2'
      >
        {isLoading ? (
          <>
            <RefreshCw className='h-3 w-3 animate-spin' />
            Переключение...
          </>
        ) : (
          <>
            <RefreshCw className='h-3 w-3' />
            Переключить
          </>
        )}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить версию виджета?</AlertDialogTitle>
            <AlertDialogDescription className='space-y-2'>
              <p>
                Вы собираетесь переключить проект <strong>{projectName}</strong>{' '}
                на{' '}
                <strong>
                  {targetVersion === 'legacy' ? 'Legacy' : 'Universal'}
                </strong>{' '}
                версию виджета.
              </p>
              {targetVersion === 'universal' ? (
                <div className='rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20'>
                  <p className='text-sm text-blue-900 dark:text-blue-100'>
                    <strong>Universal версия:</strong> Новая архитектура с
                    поддержкой множества платформ. Убедитесь, что проект
                    протестирован перед переключением.
                  </p>
                </div>
              ) : (
                <div className='rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20'>
                  <p className='text-sm text-amber-900 dark:text-amber-100'>
                    <strong>Legacy версия:</strong> Откат на старую версию
                    виджета. Используйте только при проблемах с Universal
                    версией.
                  </p>
                </div>
              )}
              <p className='text-xs text-zinc-500'>
                Изменение вступит в силу немедленно. Виджет на сайте клиента
                будет использовать новую версию при следующей загрузке страницы.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle} disabled={isLoading}>
              {isLoading ? 'Переключение...' : 'Переключить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
