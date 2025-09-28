/**
 * @file: src/features/projects/components/bonus-level-dialog.tsx
 * @description: Диалог для создания и редактирования уровней бонусов
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui, React Hook Form, Zod
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Save, X } from 'lucide-react';
import type { BonusLevel } from '@/types/bonus';

const bonusLevelSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Название уровня обязательно')
      .max(50, 'Название слишком длинное'),
    minAmount: z
      .number()
      .min(0, 'Минимальная сумма не может быть отрицательной'),
    maxAmount: z.number().nullable(),
    bonusPercent: z
      .number()
      .min(0.1, 'Процент бонусов должен быть больше 0')
      .max(50, 'Процент бонусов не может быть больше 50%'),
    paymentPercent: z
      .number()
      .min(1, 'Процент оплаты должен быть больше 0')
      .max(100, 'Процент оплаты не может быть больше 100%'),
    isActive: z.boolean()
  })
  .refine(
    (data) => {
      if (data.maxAmount !== null && data.maxAmount <= data.minAmount) {
        return false;
      }
      return true;
    },
    {
      message: 'Максимальная сумма должна быть больше минимальной',
      path: ['maxAmount']
    }
  );

type BonusLevelFormData = z.infer<typeof bonusLevelSchema>;

interface BonusLevelDialogProps {
  projectId: string;
  level?: BonusLevel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BonusLevelDialog({
  projectId,
  level,
  open,
  onOpenChange,
  onSuccess
}: BonusLevelDialogProps) {
  const { toast } = useToast();

  const form = useForm<BonusLevelFormData>({
    resolver: zodResolver(bonusLevelSchema),
    defaultValues: {
      name: '',
      minAmount: 0,
      maxAmount: null,
      bonusPercent: 5,
      paymentPercent: 10,
      isActive: true
    }
  });

  // Заполняем форму при открытии диалога с данными уровня
  useEffect(() => {
    if (open && level) {
      console.log('🔧 Filling form with level data:', level);

      form.reset({
        name: level.name || '',
        minAmount: Number(level.minAmount) || 0,
        maxAmount:
          level.maxAmount === null || level.maxAmount === undefined
            ? null
            : Number(level.maxAmount),
        bonusPercent: Number(level.bonusPercent) || 5,
        paymentPercent: Number(level.paymentPercent) || 10,
        isActive: level.isActive ?? true
      });
    } else if (open && !level) {
      // Создание нового уровня
      form.reset({
        name: '',
        minAmount: 0,
        maxAmount: null,
        bonusPercent: 5,
        paymentPercent: 10,
        isActive: true
      });
    }
  }, [open, level, form]);

  const onSubmit = async (data: BonusLevelFormData) => {
    try {
      const url = level
        ? `/api/projects/${projectId}/bonus-levels/${level.id}`
        : `/api/projects/${projectId}/bonus-levels`;

      const response = await fetch(url, {
        method: level ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка сохранения');
      }

      toast({
        title: 'Успех',
        description: level ? 'Уровень обновлен' : 'Уровень создан'
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving level:', error);
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить уровень',
        variant: 'destructive'
      });
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {level ? 'Редактировать уровень' : 'Создать уровень'}
          </DialogTitle>
          <DialogDescription>
            {level
              ? 'Измените параметры уровня бонусной программы'
              : 'Создайте новый уровень бонусной программы'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название уровня</FormLabel>
                  <FormControl>
                    <Input placeholder='Например: Базовый' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='minAmount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Мин. сумма заказа (₽)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='0'
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='maxAmount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Макс. сумма заказа (₽)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='Без ограничений'
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(
                            value === '' ? null : Number(value) || null
                          );
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Оставьте пустым для без ограничений
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='bonusPercent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Процент бонусов (%)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.1'
                        placeholder='5'
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='paymentPercent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Макс. оплата бонусами (%)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='10'
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='isActive'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Активный уровень
                    </FormLabel>
                    <FormDescription>
                      Неактивные уровни не используются в расчетах
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type='button' variant='outline' onClick={handleCancel}>
                <X className='mr-2 h-4 w-4' />
                Отмена
              </Button>
              <Button type='submit'>
                <Save className='mr-2 h-4 w-4' />
                {level ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
