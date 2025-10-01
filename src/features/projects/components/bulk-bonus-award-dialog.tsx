/**
 * @file: bulk-bonus-award-dialog.tsx
 * @description: Диалог для массового начисления бонусов нескольким пользователям
 * @project: SaaS Bonus System
 * @dependencies: React Hook Form, Zod, Shadcn Dialog
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Gift, Users, MessageSquare, Tag, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const bulkBonusAwardSchema = z.object({
  amount: z
    .number()
    .min(1, 'Сумма должна быть больше 0')
    .max(100000, 'Максимальная сумма 100,000₽'),
  type: z.enum(['PURCHASE', 'BIRTHDAY', 'MANUAL', 'REFERRAL'], {
    required_error: 'Выберите тип бонуса'
  }),
  description: z
    .string()
    .min(1, 'Описание обязательно')
    .max(200, 'Описание слишком длинное')
});

type BulkBonusAwardFormData = z.infer<typeof bulkBonusAwardSchema>;

interface BulkBonusAwardDialogProps {
  projectId: string;
  userIds: string[];
  userCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const bonusTypeLabels: Record<
  'PURCHASE' | 'BIRTHDAY' | 'MANUAL' | 'REFERRAL',
  string
> = {
  PURCHASE: 'За покупку',
  BIRTHDAY: 'День рождения',
  MANUAL: 'Ручное начисление',
  REFERRAL: 'Реферальная программа'
};

const bonusTypeDescriptions: Record<
  'PURCHASE' | 'BIRTHDAY' | 'MANUAL' | 'REFERRAL',
  string
> = {
  PURCHASE: 'Бонусы за совершенную покупку',
  BIRTHDAY: 'Поздравление с днем рождения',
  MANUAL: 'Ручное начисление администратором',
  REFERRAL: 'Бонусы за приведенного друга'
};

export function BulkBonusAwardDialog({
  projectId,
  userIds,
  userCount,
  open,
  onOpenChange,
  onSuccess
}: BulkBonusAwardDialogProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    currentUser?: string;
  }>({ completed: 0, total: 0 });
  const { toast } = useToast();

  const form = useForm<BulkBonusAwardFormData>({
    resolver: zodResolver(bulkBonusAwardSchema),
    defaultValues: {
      amount: 0,
      type: 'MANUAL',
      description: ''
    }
  });

  const watchedType = form.watch('type');

  const onSubmit = async (data: BulkBonusAwardFormData) => {
    try {
      setLoading(true);
      setProgress({ completed: 0, total: userIds.length });

      let successCount = 0;
      let errorCount = 0;

      // Обрабатываем пользователей по одному с прогрессом
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];

        try {
          setProgress({
            completed: i,
            total: userIds.length,
            currentUser: `Обработка пользователя ${i + 1}/${userIds.length}`
          });

          const response = await fetch(
            `/api/projects/${projectId}/users/${userId}/bonuses`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            }
          );

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error(
              `Ошибка для пользователя ${userId}:`,
              await response.text()
            );
          }
        } catch (error) {
          errorCount++;
          console.error(`Ошибка для пользователя ${userId}:`, error);
        }
      }

      setProgress({ completed: userIds.length, total: userIds.length });

      if (successCount > 0) {
        toast({
          title: 'Массовое начисление завершено',
          description: `Успешно начислено ${successCount} пользователям по ${data.amount}₽. ${errorCount > 0 ? `Ошибок: ${errorCount}` : ''}`
        });

        onSuccess();
        onOpenChange(false);
        form.reset();
      } else {
        throw new Error('Не удалось начислить бонусы ни одному пользователю');
      }
    } catch (error: any) {
      console.error('Ошибка массового начисления бонусов:', error);
      toast({
        title: 'Ошибка массового начисления',
        description: error.message || 'Не удалось выполнить операцию',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setProgress({ completed: 0, total: 0 });
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      form.reset();
      setProgress({ completed: 0, total: 0 });
    }
  };

  const handleTypeChange = (
    type: 'PURCHASE' | 'BIRTHDAY' | 'MANUAL' | 'REFERRAL'
  ) => {
    form.setValue('type', type);
    // Автоматически заполняем описание в зависимости от типа
    if (type === 'MANUAL') {
      form.setValue(
        'description',
        'Массовое ручное начисление администратором'
      );
    } else if (type === 'BIRTHDAY') {
      form.setValue('description', 'Массовое поздравление с днем рождения! 🎉');
    } else if (type === 'REFERRAL') {
      form.setValue('description', 'Массовые бонусы за реферальную программу');
    } else {
      form.setValue('description', '');
    }
  };

  const totalAmount = (form.watch('amount') || 0) * userCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <Gift className='h-5 w-5 text-green-500' />
            <span>Массовое начисление бонусов</span>
          </DialogTitle>
          <DialogDescription className='flex items-center space-x-2'>
            <Users className='h-4 w-4' />
            <span>
              Выбрано пользователей: <strong>{userCount}</strong>
            </span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 gap-4'>
              {/* Сумма бонусов */}
              <FormField
                control={form.control}
                name='amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='flex items-center space-x-2'>
                      <Gift className='h-4 w-4' />
                      <span>Сумма бонусов на одного пользователя *</span>
                    </FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type='number'
                          placeholder='0'
                          min='1'
                          max='100000'
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          disabled={loading}
                          className='pr-8'
                        />
                        <span className='text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 transform'>
                          ₽
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Тип бонуса */}
              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='flex items-center space-x-2'>
                      <Tag className='h-4 w-4' />
                      <span>Тип бонуса *</span>
                    </FormLabel>
                    <Select
                      onValueChange={handleTypeChange}
                      defaultValue={field.value}
                      disabled={loading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Выберите тип бонуса' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(bonusTypeLabels).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              <div className='flex flex-col'>
                                <span>{label}</span>
                                <span className='text-muted-foreground text-xs'>
                                  {
                                    bonusTypeDescriptions[
                                      value as keyof typeof bonusTypeDescriptions
                                    ]
                                  }
                                </span>
                              </div>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Описание */}
              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='flex items-center space-x-2'>
                      <MessageSquare className='h-4 w-4' />
                      <span>Описание *</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Опишите причину массового начисления бонусов...'
                        rows={3}
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Предварительный просмотр */}
            {form.watch('amount') > 0 && (
              <div className='rounded-lg border border-green-200 bg-green-50 p-4'>
                <div className='mb-2 flex items-center space-x-2 text-green-700'>
                  <Gift className='h-4 w-4' />
                  <span className='font-medium'>Предварительный просмотр</span>
                </div>
                <div className='space-y-1 text-sm'>
                  <div>
                    <strong>Сумма на пользователя:</strong>{' '}
                    {form.watch('amount')}₽
                  </div>
                  <div>
                    <strong>Всего пользователей:</strong> {userCount}
                  </div>
                  <div>
                    <strong>Общая сумма:</strong> {totalAmount}₽
                  </div>
                  <div>
                    <strong>Тип:</strong> {bonusTypeLabels[watchedType]}
                  </div>
                  {form.watch('description') && (
                    <div>
                      <strong>Описание:</strong> {form.watch('description')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Прогресс выполнения */}
            {loading && progress.total > 0 && (
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  <div className='space-y-2'>
                    <div className='flex justify-between text-sm'>
                      <span>Обработка: {progress.currentUser}</span>
                      <span>
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-gray-200'>
                      <div
                        className='h-2 rounded-full bg-green-500 transition-all duration-300'
                        style={{
                          width: `${(progress.completed / progress.total) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleClose}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button type='submit' disabled={loading}>
                {loading
                  ? `Начисление... (${progress.completed}/${progress.total})`
                  : `Начислить ${totalAmount}₽ (${userCount} пользователей)`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
