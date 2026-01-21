/**
 * @file: src/components/composite/form-dialog.tsx
 * @description: Универсальный диалог с формой - устраняет дублирование логики форм
 * @project: SaaS Bonus System
 * @dependencies: react-hook-form, zod, shadcn/ui
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { ReactNode, useState } from 'react';
import { useForm, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

export interface FormDialogProps<TSchema extends z.ZodType> {
  // Dialog props
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;

  // Form props
  schema: TSchema;
  defaultValues: z.infer<TSchema>;
  children: (form: UseFormReturn<z.infer<TSchema>>) => ReactNode;

  // API props
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  transformData?: (data: z.infer<TSchema>) => any;

  // Callbacks
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;

  // Messages
  successMessage?: string;
  errorMessage?: string;

  // Buttons
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
}

export function FormDialog<TSchema extends z.ZodType>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  children,
  endpoint,
  method = 'POST',
  transformData,
  onSuccess,
  onError,
  successMessage = 'Успешно сохранено',
  errorMessage = 'Произошла ошибка',
  submitLabel = 'Сохранить',
  cancelLabel = 'Отмена',
  showCancel = true
}: FormDialogProps<TSchema>) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema as any),
    defaultValues
  });

  const handleSubmit = async (data: z.infer<TSchema>) => {
    try {
      setLoading(true);

      const payload = transformData ? transformData(data) : data;

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || errorMessage);
      }

      const result = await response.json();

      toast({
        title: 'Успех',
        description: successMessage
      });

      form.reset();
      onSuccess?.(result);
      onOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : errorMessage;

      toast({
        title: 'Ошибка',
        description: errorMsg,
        variant: 'destructive'
      });

      onError?.(error instanceof Error ? error : new Error(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            {children(form)}

            <DialogFooter>
              {showCancel && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
              )}
              <Button type='submit' disabled={loading}>
                {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
