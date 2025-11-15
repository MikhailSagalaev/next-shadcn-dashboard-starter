/**
 * @file: src/features/retailcrm/components/retailcrm-integration-view.tsx
 * @description: Компонент настройки интеграции RetailCRM
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface RetailCrmIntegrationViewProps {
  projectId: string;
}

export function RetailCrmIntegrationView({ projectId }: RetailCrmIntegrationViewProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [syncOrders, setSyncOrders] = useState(true);
  const [syncCustomers, setSyncCustomers] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/retailcrm`)
      .then((res) => res.json())
      .then((data) => {
        if (data.integration) {
          setIntegration(data.integration);
          setApiUrl(data.integration.apiUrl || '');
          setApiKey(data.integration.apiKey || '');
          setIsActive(data.integration.isActive || false);
          setSyncOrders(data.integration.syncOrders ?? true);
          setSyncCustomers(data.integration.syncCustomers ?? true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectId}/retailcrm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl,
          apiKey,
          isActive,
          syncOrders,
          syncCustomers,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения');
      }

      toast({
        title: 'Успешно',
        description: 'Настройки интеграции сохранены',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <Heading title='Интеграция RetailCRM' description='Настройка синхронизации с RetailCRM' />
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Настройки подключения</CardTitle>
          <CardDescription>Введите данные для подключения к RetailCRM API</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='apiUrl'>API URL</Label>
            <Input
              id='apiUrl'
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder='https://your-store.retailcrm.ru'
            />
          </div>
          <div>
            <Label htmlFor='apiKey'>API Key</Label>
            <Input
              id='apiKey'
              type='password'
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder='Ваш API ключ'
            />
          </div>
          <div className='flex items-center justify-between'>
            <Label htmlFor='isActive'>Активировать интеграцию</Label>
            <Switch id='isActive' checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className='flex items-center justify-between'>
            <Label htmlFor='syncOrders'>Синхронизировать заказы</Label>
            <Switch id='syncOrders' checked={syncOrders} onCheckedChange={setSyncOrders} />
          </div>
          <div className='flex items-center justify-between'>
            <Label htmlFor='syncCustomers'>Синхронизировать клиентов</Label>
            <Switch id='syncCustomers' checked={syncCustomers} onCheckedChange={setSyncCustomers} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className='mr-2 h-4 w-4' />
            Сохранить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

