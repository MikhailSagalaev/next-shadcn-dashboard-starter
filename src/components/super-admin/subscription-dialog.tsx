/**
 * @file: src/components/super-admin/subscription-dialog.tsx
 * @description: Диалог для создания новой подписки
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
}

interface Admin {
  id: string;
  email: string;
  role: string;
}

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  onSuccess
}: SubscriptionDialogProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(0);
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPlans();
      fetchAdmins();
      // Сброс формы
      setSelectedAdminId('');
      setSelectedPlanId('');
      setPromoCode('');
      setTrialDays(0);
      setAdminSearch('');
    }
  }, [open]);

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

  const fetchAdmins = async (search = '') => {
    try {
      setLoadingAdmins(true);
      const params = new URLSearchParams({
        limit: '50',
        ...(search && { search })
      });
      const res = await fetch(`/api/super-admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch admins');
      const data = await res.json();
      setAdmins(data.users || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Ошибка загрузки администраторов');
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (adminSearch) {
        fetchAdmins(adminSearch);
      } else {
        fetchAdmins();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [adminSearch]);

  const handleSubmit = async () => {
    if (!selectedAdminId || !selectedPlanId) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: selectedAdminId,
          planId: selectedPlanId,
          ...(promoCode && { promoCode }),
          ...(trialDays > 0 && { trialDays })
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Ошибка при создании подписки');
      }

      toast.success('Подписка успешно создана');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка при создании подписки');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const selectedAdmin = admins.find(a => a.id === selectedAdminId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Plus className='h-5 w-5' />
            Создать новую подписку
          </DialogTitle>
          <DialogDescription>
            Создайте новую подписку для администратора
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='admin-search'>Поиск администратора</Label>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='admin-search'
                placeholder='Введите email администратора...'
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className='pl-9'
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='admin'>Администратор *</Label>
            {loadingAdmins ? (
              <div className='flex items-center justify-center py-4'>
                <Loader2 className='h-5 w-5 animate-spin' />
              </div>
            ) : (
              <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                <SelectTrigger id='admin'>
                  <SelectValue placeholder='Выберите администратора' />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.email} ({admin.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedAdmin && (
              <div className='text-sm text-muted-foreground'>
                Выбран: {selectedAdmin.email}
              </div>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan'>Тарифный план *</Label>
            {loadingPlans ? (
              <div className='flex items-center justify-center py-4'>
                <Loader2 className='h-5 w-5 animate-spin' />
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
            {selectedPlan && (
              <div className='text-sm text-muted-foreground'>
                Выбран план: {selectedPlan.name} - {selectedPlan.price} {selectedPlan.currency}
              </div>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='promo'>Промокод (необязательно)</Label>
            <Input
              id='promo'
              placeholder='Введите промокод...'
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='trial'>Пробный период, дней (необязательно)</Label>
            <Input
              id='trial'
              type='number'
              min='0'
              placeholder='0'
              value={trialDays || ''}
              onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedAdminId || !selectedPlanId}>
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Создать подписку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
