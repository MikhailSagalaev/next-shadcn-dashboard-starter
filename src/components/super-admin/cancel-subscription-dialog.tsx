/**
 * @file: src/components/super-admin/cancel-subscription-dialog.tsx
 * @description: Диалог для отмены подписки
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Ban, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  status: string;
  adminAccount: {
    email: string;
  };
  plan: {
    name: string;
  };
}

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription;
  onSuccess: () => void;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  onSuccess
}: CancelSubscriptionDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/super-admin/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Отменено супер-администратором' })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Ошибка при отмене подписки');
      }

      toast.success('Подписка успешно отменена');
      onSuccess();
      onOpenChange(false);
      setReason('');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка при отмене подписки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <Ban className='h-5 w-5' />
            Отменить подписку
          </DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите отменить подписку пользователя {subscription.adminAccount.email}?
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='rounded-md border border-destructive/50 bg-destructive/10 p-4'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='h-5 w-5 text-destructive mt-0.5' />
              <div className='space-y-1'>
                <div className='font-medium text-destructive'>Внимание!</div>
                <div className='text-sm text-muted-foreground'>
                  После отмены подписки пользователь потеряет доступ к тарифному плану &quot;{subscription.plan.name}&quot;.
                  Подписку можно будет возобновить позже.
                </div>
              </div>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reason'>Причина отмены (необязательно)</Label>
            <Textarea
              id='reason'
              placeholder='Укажите причину отмены подписки...'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button variant='destructive' onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Отменить подписку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
