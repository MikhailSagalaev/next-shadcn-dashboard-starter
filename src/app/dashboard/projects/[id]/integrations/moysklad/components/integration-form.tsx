/**
 * @file: integration-form.tsx
 * @description: Form for МойСклад Loyalty API integration settings
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { BonusBehavior } from '@prisma/client';

interface IntegrationFormProps {
  projectId: string;
  integration: {
    id: string;
    bonusPercentage: any;
    maxBonusSpend: any;
    isActive: boolean;
  } | null;
  bonusBehavior: BonusBehavior;
}

export function MoySkladIntegrationForm({
  projectId,
  integration,
  bonusBehavior
}: IntegrationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    bonusPercentage: integration?.bonusPercentage
      ? Number(integration.bonusPercentage)
      : 10,
    maxBonusSpend: integration?.maxBonusSpend
      ? Number(integration.maxBonusSpend)
      : 50,
    isActive: integration?.isActive ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad`,
        {
          method: integration ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save integration');
      }

      toast({
        title: 'Успешно',
        description: integration
          ? 'Настройки интеграции обновлены'
          : 'Интеграция активирована',
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки интеграции</CardTitle>
        <CardDescription>
          Настройте параметры бонусной программы для МойСклад
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Bonus Percentage */}
          <div className='space-y-2'>
            <Label htmlFor='bonusPercentage'>
              Процент начисления бонусов (%)
            </Label>
            <Input
              id='bonusPercentage'
              type='number'
              min='0'
              max='100'
              step='0.01'
              value={formData.bonusPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bonusPercentage: parseFloat(e.target.value),
                })
              }
              required
            />
            <p className='text-xs text-zinc-500'>
              Процент от суммы покупки, который начисляется в виде бонусов
            </p>
          </div>

          {/* Max Bonus Spend */}
          <div className='space-y-2'>
            <Label htmlFor='maxBonusSpend'>
              Максимум оплаты бонусами (%)
            </Label>
            <Input
              id='maxBonusSpend'
              type='number'
              min='0'
              max='100'
              step='0.01'
              value={formData.maxBonusSpend}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxBonusSpend: parseFloat(e.target.value),
                })
              }
              required
            />
            <p className='text-xs text-zinc-500'>
              Максимальный процент от суммы покупки, который можно оплатить бонусами
            </p>
          </div>

          {/* Bonus Behavior Info */}
          <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900'>
            <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2'>
              Режим бонусной программы: <strong>{bonusBehavior}</strong>
            </p>
            <p className='text-xs text-zinc-600 dark:text-zinc-400'>
              {bonusBehavior === 'SPEND_AND_EARN' &&
                'Клиент может тратить и зарабатывать бонусы. При использовании бонусов начисление идет на остаток (сумма - списанные бонусы).'}
              {bonusBehavior === 'SPEND_ONLY' &&
                'Клиент может только тратить бонусы. При использовании бонусов новые бонусы НЕ начисляются.'}
              {bonusBehavior === 'EARN_ONLY' &&
                'Клиент может только зарабатывать бонусы. Списание бонусов запрещено.'}
            </p>
            <p className='text-xs text-zinc-500 mt-2'>
              Изменить режим можно в настройках проекта
            </p>
          </div>

          {/* Active Toggle */}
          <div className='flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'>
            <div className='space-y-0.5'>
              <Label htmlFor='isActive' className='text-base'>
                Активировать интеграцию
              </Label>
              <p className='text-sm text-zinc-500'>
                {formData.isActive
                  ? 'Интеграция активна, МойСклад может вызывать API'
                  : 'Интеграция отключена, запросы будут отклонены'}
              </p>
            </div>
            <Switch
              id='isActive'
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
          </div>

          {/* Submit Button */}
          <div className='flex gap-4'>
            <Button type='submit' disabled={loading}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {integration ? 'Сохранить изменения' : 'Активировать интеграцию'}
            </Button>

            {integration && (
              <Button
                type='button'
                variant='outline'
                onClick={() => router.refresh()}
                disabled={loading}
              >
                Отменить
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
