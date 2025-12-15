'use client';

/**
 * @file: src/components/super-admin/subscription-plans-table.tsx
 * @description: Управление тарифными планами в супер-админке
 * @project: SaaS Bonus System
 * @created: 2025-11-16
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Edit3, Power, PowerOff } from 'lucide-react';
import { SubscriptionPlan, SubscriptionPlanDialog } from './subscription-plan-dialog';
import { toast } from 'sonner';

export function SubscriptionPlansTable() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogPlan, setDialogPlan] = useState<SubscriptionPlan | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/subscription-plans');
      if (!res.ok) {
        throw new Error('Не удалось загрузить планы');
      }
      const data = await res.json();
      const normalized = (data.plans || []).map((plan: SubscriptionPlan & { features: unknown }) => ({
        ...plan,
        price: Number(plan.price),
        features: Array.isArray(plan.features)
          ? (plan.features as string[])
          : typeof plan.features === 'string'
          ? [plan.features as string]
          : []
      }));
      setPlans(normalized);
    } catch (error) {
      console.error('Error loading plans', error);
      toast.error('Ошибка загрузки тарифов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreateDialog = () => {
    setDialogPlan(null);
    setShowDialog(true);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setDialogPlan(plan);
    setShowDialog(true);
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const res = await fetch(`/api/super-admin/subscription-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive })
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Не удалось обновить план');
      }
      toast.success(`План ${!plan.isActive ? 'активирован' : 'деактивирован'}`);
      fetchPlans();
    } catch (error) {
      console.error('toggle plan error', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка обновления плана');
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold'>Тарифные планы</h3>
          <p className='text-sm text-muted-foreground'>
            Управляйте тарифами и лимитами. Планы используются при выдаче подписки администраторам.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className='mr-2 h-4 w-4' />
          Новый план
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>План</TableHead>
              <TableHead>Стоимость</TableHead>
              <TableHead>Лимиты</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Особенности</TableHead>
              <TableHead className='text-right'>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  <Loader2 className='mx-auto h-6 w-6 animate-spin' />
                </TableCell>
              </TableRow>
            ) : plans.length ? (
              plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className='flex flex-col'>
                      <span className='font-semibold'>{plan.name}</span>
                      <span className='text-xs text-muted-foreground'>/{plan.slug}/</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='font-medium'>
                      {Number(plan.price).toLocaleString('ru-RU')} {plan.currency} /{' '}
                      {plan.interval === 'year' ? 'год' : 'месяц'}
                    </div>
                  </TableCell>
                <TableCell className='text-sm text-muted-foreground'>
                  <div>Проекты: {plan.maxProjects}</div>
                  <div>Пользователей на проект: {plan.maxUsersPerProject}</div>
                  <div>Ботов: {plan.maxBots ?? 0}</div>
                  <div>Уведомления: {plan.maxNotifications ?? 0}</div>
                </TableCell>
                  <TableCell>
                    <div className='flex flex-col gap-1'>
                      <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                        {plan.isActive ? 'Активен' : 'Отключен'}
                      </Badge>
                      <Badge variant={plan.isPublic ? 'outline' : 'secondary'}>
                        {plan.isPublic ? 'Публичный' : 'Скрытый'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1'>
                      {(Array.isArray(plan.features) ? plan.features : []).slice(0, 4).map((feature) => (
                        <Badge key={feature} variant='outline' className='text-xs'>
                          {feature}
                        </Badge>
                      ))}
                      {Array.isArray(plan.features) && plan.features.length > 4 && (
                        <span className='text-xs text-muted-foreground'>
                          +{plan.features.length - 4}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='text-right space-x-2'>
                    <Button variant='ghost' size='sm' onClick={() => openEditDialog(plan)}>
                      <Edit3 className='mr-1 h-4 w-4' />
                      Редактировать
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleToggleActive(plan)}
                      className={plan.isActive ? 'text-red-500' : 'text-green-600'}
                    >
                      {plan.isActive ? (
                        <>
                          <PowerOff className='mr-1 h-4 w-4' /> Выключить
                        </>
                      ) : (
                        <>
                          <Power className='mr-1 h-4 w-4' /> Включить
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center text-muted-foreground'>
                  Нет созданных тарифов
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showDialog && (
        <SubscriptionPlanDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onSuccess={fetchPlans}
          plan={dialogPlan || undefined}
        />
      )}
    </div>
  );
}


