'use client';

/**
 * @file: src/components/super-admin/subscription-plan-dialog.tsx
 * @description: Диалог создания/редактирования тарифных планов
 * @project: SaaS Bonus System
 * @created: 2025-11-16
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: string;
  maxProjects: number;
  maxUsersPerProject: number;
  maxBots?: number | null;
  maxNotifications?: number | null;
  features: string[] | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
}

interface SubscriptionPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  plan?: SubscriptionPlan | null;
}

const intervalOptions = [
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
];

const currencyOptions = ['RUB', 'USD', 'EUR'];

export function SubscriptionPlanDialog({
  open,
  onOpenChange,
  onSuccess,
  plan
}: SubscriptionPlanDialogProps) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    currency: 'RUB',
    interval: 'month',
    maxProjects: 1,
    maxUsersPerProject: 100,
    maxBots: 0,
    maxNotifications: 0,
    featuresText: '',
    isActive: true,
    isPublic: true,
    sortOrder: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (plan) {
        setForm({
          name: plan.name,
          slug: plan.slug,
          description: plan.description || '',
          price: Number(plan.price),
          currency: plan.currency || 'RUB',
          interval: plan.interval || 'month',
          maxProjects: plan.maxProjects,
          maxUsersPerProject: plan.maxUsersPerProject,
          maxBots: plan.maxBots ?? 0,
          maxNotifications: plan.maxNotifications ?? 0,
          featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
          isActive: plan.isActive,
          isPublic: plan.isPublic,
          sortOrder: plan.sortOrder ?? 0
        });
      } else {
        setForm((prev) => ({
          ...prev,
          name: '',
          slug: '',
          description: '',
          price: 0,
          maxProjects: 1,
          maxUsersPerProject: 100,
          maxBots: 0,
          maxNotifications: 0,
          featuresText: '',
          isActive: true,
          isPublic: true,
          sortOrder: 0
        }));
      }
    }
  }, [open, plan]);

  const parsedFeatures = useMemo(
    () =>
      form.featuresText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [form.featuresText]
  );

  const handleChange = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug) {
      toast.error('Название и slug обязательны');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        price: Number(form.price),
        currency: form.currency,
        interval: form.interval,
        maxProjects: Number(form.maxProjects),
        maxUsersPerProject: Number(form.maxUsersPerProject),
        maxBots: Number(form.maxBots),
        maxNotifications: Number(form.maxNotifications),
        features: parsedFeatures,
        isActive: form.isActive,
        isPublic: form.isPublic,
        sortOrder: Number(form.sortOrder)
      };

      const url = plan ? `/api/super-admin/subscription-plans/${plan.id}` : '/api/super-admin/subscription-plans';
      const method = plan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Не удалось сохранить план');
      }

      toast.success(`План ${plan ? 'обновлен' : 'создан'} успешно`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Subscription plan save error', error);
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить план');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{plan ? 'Редактировать тарифный план' : 'Создать тарифный план'}</DialogTitle>
          <DialogDescription>
            {plan
              ? 'Обновите параметры существующего плана'
              : 'Создайте новый тариф, определите лимиты и доступные возможности.'}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='plan-name'>Название *</Label>
            <Input
              id='plan-name'
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder='Pro, Enterprise...'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-slug'>Slug *</Label>
            <Input
              id='plan-slug'
              value={form.slug}
              onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder='pro, enterprise...'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-price'>Цена *</Label>
            <Input
              id='plan-price'
              type='number'
              min='0'
              step='100'
              value={form.price}
              onChange={(e) => handleChange('price', Number(e.target.value))}
            />
          </div>

          <div className='space-y-2'>
            <Label>Валюта</Label>
            <Select value={form.currency} onValueChange={(value) => handleChange('currency', value)}>
              <SelectTrigger>
                <SelectValue placeholder='Выберите валюту' />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Периодичность</Label>
            <Select value={form.interval} onValueChange={(value) => handleChange('interval', value)}>
              <SelectTrigger>
                <SelectValue placeholder='Интервал' />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-max-projects'>Максимум проектов</Label>
            <Input
              id='plan-max-projects'
              type='number'
              min='1'
              value={form.maxProjects}
              onChange={(e) => handleChange('maxProjects', Number(e.target.value))}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-max-users'>Пользователей на проект</Label>
            <Input
              id='plan-max-users'
              type='number'
              min='1'
              value={form.maxUsersPerProject}
              onChange={(e) => handleChange('maxUsersPerProject', Number(e.target.value))}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-max-bots'>Ботов</Label>
            <Input
              id='plan-max-bots'
              type='number'
              min='0'
              value={form.maxBots}
              onChange={(e) => handleChange('maxBots', Number(e.target.value))}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-max-notifications'>Уведомления</Label>
            <Input
              id='plan-max-notifications'
              type='number'
              min='0'
              value={form.maxNotifications}
              onChange={(e) => handleChange('maxNotifications', Number(e.target.value))}
            />
          </div>

          <div className='space-y-2 md:col-span-2'>
            <Label htmlFor='plan-description'>Описание</Label>
            <Textarea
              id='plan-description'
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder='Короткое описание тарифа'
            />
          </div>

          <div className='space-y-2 md:col-span-2'>
            <Label htmlFor='plan-features'>Особенности (каждая с новой строки)</Label>
            <Textarea
              id='plan-features'
              rows={4}
              value={form.featuresText}
              onChange={(e) => handleChange('featuresText', e.target.value)}
              placeholder={'Чат-боты без ограничений\nWebhook интеграции\nДоступ к API'}
            />
          </div>

          <div className='flex items-center justify-between rounded border p-3'>
            <div>
              <Label htmlFor='plan-active'>Активен</Label>
              <p className='text-sm text-muted-foreground'>Можно выдавать и покупать</p>
            </div>
            <Switch
              id='plan-active'
              checked={form.isActive}
              onCheckedChange={(checked) => handleChange('isActive', checked)}
            />
          </div>

          <div className='flex items-center justify-between rounded border p-3'>
            <div>
              <Label htmlFor='plan-public'>Доступен публично</Label>
              <p className='text-sm text-muted-foreground'>Отображается клиентам</p>
            </div>
            <Switch
              id='plan-public'
              checked={form.isPublic}
              onCheckedChange={(checked) => handleChange('isPublic', checked)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='plan-sort-order'>Порядок сортировки</Label>
            <Input
              id='plan-sort-order'
              type='number'
              value={form.sortOrder}
              onChange={(e) => handleChange('sortOrder', Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {plan ? 'Сохранить изменения' : 'Создать план'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


