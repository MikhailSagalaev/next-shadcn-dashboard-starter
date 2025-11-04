/**
 * @file: src/components/super-admin/change-plan-dialog.tsx
 * @description: Диалог для смены тарифного плана подписки
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  status: string;
  plan: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
}

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription;
  onSuccess: () => void;
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  subscription,
  onSuccess
}: ChangePlanDialogProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    if (open) {
      fetchPlans();
      setSelectedPlanId(subscription.plan.id);
    }
  }, [open, subscription]);

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const res = await fetch('/api/super-admin/subscription-plans?isActive=true');
      if (!res.ok) throw new Error('Failed to fetch plans');
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Ошибка загрузки планов');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlanId || selectedPlanId === subscription.plan.id) {
      toast.error('Выберите другой план');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/super-admin/subscriptions/${subscription.id}/change-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlanId: selectedPlanId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Ошибка при смене плана');
      }

      toast.success('План успешно изменен');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка при смене плана');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <RefreshCw className='h-5 w-5' />
            Изменить тарифный план
          </DialogTitle>
          <DialogDescription>
            Выберите новый тарифный план для подписки пользователя {subscription.plan.name}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label>Текущий план</Label>
            <div className='rounded-md border p-3 bg-muted'>
              <div className='font-medium'>{subscription.plan.name}</div>
              <div className='text-sm text-muted-foreground'>{subscription.plan.slug}</div>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan'>Новый план *</Label>
            {loadingPlans ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='h-6 w-6 animate-spin' />
              </div>
            ) : (
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger id='plan'>
                  <SelectValue placeholder='Выберите план' />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.price} {plan.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedPlan && selectedPlan.id !== subscription.plan.id && (
            <div className='rounded-md border p-3 bg-blue-50 dark:bg-blue-950'>
              <div className='text-sm font-medium'>Новый план</div>
              <div className='text-sm text-muted-foreground'>
                {selectedPlan.name} - {selectedPlan.price} {selectedPlan.currency}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedPlanId || selectedPlanId === subscription.plan.id}>
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Изменить план
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
