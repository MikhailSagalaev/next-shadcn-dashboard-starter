/**
 * @file: src/features/projects/components/user-create-dialog.tsx
 * @description: Модальный диалог для создания нового пользователя
 * @project: SaaS Bonus System
 * @dependencies: React Hook Form, Zod, Shadcn Dialog
 * @created: 2024-12-31
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
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Calendar } from 'lucide-react';

const userCreateSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'Имя обязательно')
      .max(50, 'Имя слишком длинное'),
    lastName: z.string().max(50, 'Фамилия слишком длинная').optional(),
    email: z.string().email('Некорректный email').optional().or(z.literal('')),
    phone: z
      .string()
      .min(10, 'Некорректный номер телефона')
      .optional()
      .or(z.literal('')),
    birthDate: z.string().optional().or(z.literal(''))
  })
  .refine((data) => data.email || data.phone, {
    message: 'Необходимо указать email или телефон',
    path: ['email']
  });

type UserCreateFormData = z.infer<typeof userCreateSchema>;

interface UserCreateDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: any) => void;
}

export function UserCreateDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess
}: UserCreateDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      birthDate: ''
    }
  });

  const onSubmit = async (data: UserCreateFormData) => {
    try {
      setLoading(true);

      // Подготавливаем данные для отправки
      // Проверяем, что birthDate это валидная ISO дата или пустая строка
      let birthDateValue: string | null = null;
      if (data.birthDate && data.birthDate.trim()) {
        // Если это ISO формат (YYYY-MM-DD), используем как есть
        if (data.birthDate.includes('-') && data.birthDate.length >= 10) {
          birthDateValue = data.birthDate.split('T')[0]; // Берем только дату без времени
        } else if (data.birthDate.length === 10 && data.birthDate.includes('.')) {
          // Если это формат DD.MM.YYYY, конвертируем в ISO
          const [d, m, y] = data.birthDate.split('.');
          const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          if (!isNaN(date.getTime())) {
            birthDateValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
      }

      const payload = {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        birthDate: birthDateValue
      };

      const response = await fetch(`/api/projects/${projectId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Парсим ответ один раз для всех случаев
      let responseData: any = {};
      try {
        const responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (e) {
        // Если не удалось распарсить JSON, используем текст ответа
        responseData = { error: 'Ошибка создания пользователя' };
      }

      if (!response.ok) {
        const errorMessage = responseData.error || responseData.message || 'Ошибка создания пользователя';
        
        // Обрабатываем различные типы ошибок
        if (response.status === 409) {
          // Конфликт - пользователь уже существует
          if (errorMessage.includes('email')) {
            form.setError('email', {
              type: 'server',
              message: 'Пользователь с таким email уже существует'
            });
            toast({
              title: 'Ошибка',
              description: 'Пользователь с таким email уже существует',
              variant: 'destructive'
            });
          } else if (errorMessage.includes('телефон') || errorMessage.includes('phone')) {
            form.setError('phone', {
              type: 'server',
              message: 'Пользователь с таким телефоном уже существует'
            });
            toast({
              title: 'Ошибка',
              description: 'Пользователь с таким телефоном уже существует',
              variant: 'destructive'
            });
          } else {
            toast({
              title: 'Ошибка',
              description: errorMessage,
              variant: 'destructive'
            });
          }
        } else if (response.status === 400) {
          // Ошибка валидации
          if (responseData.details?.fieldErrors) {
            const fieldErrors = responseData.details.fieldErrors as Record<string, string[]>;
            Object.entries(fieldErrors).forEach(([key, messages]) => {
              if (key === 'email' || key === 'phone' || key === 'firstName' || key === 'lastName' || key === 'birthDate') {
                form.setError(key as keyof UserCreateFormData, {
                  type: 'server',
                  message: messages?.[0] || errorMessage
                });
              }
            });
          }
          toast({
            title: 'Ошибка валидации',
            description: errorMessage,
            variant: 'destructive'
          });
        } else if (response.status === 402) {
          // Лимит пользователей исчерпан
          toast({
            title: 'Лимит пользователей',
            description: errorMessage,
            variant: 'destructive'
          });
        } else {
          // Другие ошибки
          toast({
            title: 'Ошибка',
            description: errorMessage,
            variant: 'destructive'
          });
        }
        
        throw new Error(errorMessage);
      }

      // Успешный ответ - используем уже распарсенные данные
      const user = responseData;

      toast({
        title: 'Успех',
        description: 'Пользователь успешно создан'
      });

      onSuccess(user);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      // Логируем ошибку в консоль для отладки
      console.error('Ошибка создания пользователя:', error);
      
      // Если ошибка еще не была обработана (не была показана toast), показываем общую ошибку
      if (!error.message || !error.message.includes('Ошибка')) {
        toast({
          title: 'Ошибка',
          description: error.message || 'Не удалось создать пользователя. Проверьте введенные данные.',
          variant: 'destructive',
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <User className='h-5 w-5' />
            <span>Добавить пользователя</span>
          </DialogTitle>
          <DialogDescription>
            Создайте нового пользователя для проекта. Укажите имя и хотя бы один
            способ связи.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 gap-4'>
              {/* Имя (обязательное) */}
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Введите имя'
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Фамилия */}
              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Фамилия</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Введите фамилию'
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='flex items-center space-x-2'>
                      <Mail className='h-4 w-4' />
                      <span>Email</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='user@example.com'
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Телефон */}
              <FormField
                control={form.control}
                name='phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='flex items-center space-x-2'>
                      <Phone className='h-4 w-4' />
                      <span>Телефон</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='tel'
                        placeholder='+7 999 123-45-67'
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Дата рождения */}
              <FormField
                control={form.control}
                name='birthDate'
                render={({ field }) => {
                  const formatDate = (value: string) => {
                    // Удаляем все кроме цифр
                    const digits = value.replace(/\D/g, '');
                    
                    // Форматируем как DD.MM.YYYY
                    if (digits.length === 0) {
                      return '';
                    } else if (digits.length <= 2) {
                      return digits;
                    } else if (digits.length <= 4) {
                      return `${digits.slice(0, 2)}.${digits.slice(2)}`;
                    } else {
                      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
                    }
                  };

                  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    const inputValue = e.target.value;
                    const formatted = formatDate(inputValue);
                    
                    // Валидация дня (01-31)
                    if (formatted.length >= 2) {
                      const day = formatted.slice(0, 2);
                      const dayNum = parseInt(day);
                      if (dayNum > 31 || dayNum < 1) {
                        return; // Не обновляем поле при невалидном дне
                      }
                    }
                    
                    // Валидация месяца (01-12)
                    if (formatted.length >= 5) {
                      const month = formatted.slice(3, 5);
                      const monthNum = parseInt(month);
                      if (monthNum > 12 || monthNum < 1) {
                        return; // Не обновляем поле при невалидном месяце
                      }
                    }
                    
                    // Если дата полная (10 символов DD.MM.YYYY), конвертируем в ISO формат
                    if (formatted.length === 10) {
                      const [d, m, y] = formatted.split('.');
                      const dayNum = parseInt(d);
                      const monthNum = parseInt(m);
                      const yearNum = parseInt(y);
                      
                      // Дополнительная валидация
                      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                        const date = new Date(yearNum, monthNum - 1, dayNum);
                        // Проверяем, что дата корректна (защита от 31 февраля и т.д.)
                        if (date.getDate() === dayNum && date.getMonth() === monthNum - 1 && date.getFullYear() === yearNum) {
                          const isoDate = `${yearNum}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                          field.onChange(isoDate);
                          return;
                        }
                      }
                    }
                    
                    // Сохраняем промежуточное значение только для отображения
                    // В форме сохраняем как есть, если дата неполная - будет пустая строка при отправке
                    field.onChange(formatted.length === 10 ? '' : formatted);
                  };

                  const handleDateBlur = () => {
                    // При потере фокуса проверяем, что дата полная и валидная
                    const value = field.value || '';
                    
                    // Если это ISO формат, оставляем как есть
                    if (value.includes('-') && value.length >= 10) {
                      field.onBlur();
                      return;
                    }
                    
                    // Если это формат DD.MM.YYYY и дата полная
                    if (value.length === 10 && value.includes('.')) {
                      const [d, m, y] = value.split('.');
                      const dayNum = parseInt(d);
                      const monthNum = parseInt(m);
                      const yearNum = parseInt(y);
                      
                      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                        const date = new Date(yearNum, monthNum - 1, dayNum);
                        if (date.getDate() === dayNum && date.getMonth() === monthNum - 1 && date.getFullYear() === yearNum) {
                          const isoDate = `${yearNum}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                          field.onChange(isoDate);
                        } else {
                          // Если дата невалидна, очищаем поле
                          field.onChange('');
                        }
                      } else {
                        // Если дата невалидна, очищаем поле
                        field.onChange('');
                      }
                    } else if (value.length > 0 && value.length < 10) {
                      // Если дата неполная, очищаем поле
                      field.onChange('');
                    }
                    
                    field.onBlur();
                  };

                  // Отображаем значение в формате DD.MM.YYYY
                  const displayValue = field.value?.includes('-') 
                    ? field.value.split('T')[0].split('-').reverse().join('.')
                    : field.value || '';

                  return (
                    <FormItem>
                      <FormLabel className='flex items-center space-x-2'>
                        <Calendar className='h-4 w-4' />
                        <span>Дата рождения</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='text'
                          placeholder='DD.MM.YYYY'
                          value={displayValue}
                          onChange={handleDateChange}
                          onBlur={handleDateBlur}
                          disabled={loading}
                          maxLength={10}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className='text-muted-foreground rounded border-l-4 border-blue-200 bg-blue-50 py-2 pl-4 text-sm'>
              <strong>Примечание:</strong> Необходимо указать хотя бы один
              способ связи (email или телефон) для возможности привязки аккаунта
              в Telegram боте.
            </div>

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
                {loading ? 'Создание...' : 'Создать пользователя'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
