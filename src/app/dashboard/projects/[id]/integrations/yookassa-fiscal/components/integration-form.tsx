'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Save, TestTube2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const YOOKASSA_TIMEZONES = [
  { value: 1, label: '1 — UTC+2 · Калининград' },
  { value: 2, label: '2 — UTC+3 · Москва, Санкт-Петербург' },
  { value: 3, label: '3 — UTC+4 · Астрахань, Самара, Ульяновск' },
  { value: 4, label: '4 — UTC+5 · Екатеринбург, Челябинск, Уфа' },
  { value: 5, label: '5 — UTC+6 · Омск' },
  { value: 6, label: '6 — UTC+7 · Красноярск, Новосибирск, Томск' },
  { value: 7, label: '7 — UTC+8 · Иркутск, Улан-Удэ' },
  { value: 8, label: '8 — UTC+9 · Чита, Якутск' },
  { value: 9, label: '9 — UTC+10 · Хабаровск, Владивосток' },
  { value: 10, label: '10 — UTC+11 · Магадан, Южно-Сахалинск' },
  { value: 11, label: '11 — UTC+12 · Петропавловск-Камчатский' }
] as const;

type Integration = {
  shopId: string;
  isActive: boolean;
  receiptTimezone: number;
  deliveryVatCode: number | null;
  lastTestedAt: string | null;
  lastError: string | null;
};

export function YooKassaFiscalForm({
  projectId,
  integration
}: {
  projectId: string;
  integration: Integration | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [shopId, setShopId] = useState(integration?.shopId ?? '');
  const [secretKey, setSecretKey] = useState('');
  const [timezone, setTimezone] = useState(integration?.receiptTimezone ?? 2);
  const [deliveryVatCode, setDeliveryVatCode] = useState(
    integration?.deliveryVatCode?.toString() ?? ''
  );
  const [isActive, setIsActive] = useState(integration?.isActive ?? false);
  const [action, setAction] = useState<'save' | 'test' | 'delete' | null>(null);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setAction('save');
    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/yookassa-fiscal`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            ...(secretKey ? { secretKey } : {}),
            receiptTimezone: timezone,
            deliveryVatCode: deliveryVatCode ? Number(deliveryVatCode) : null,
            isActive
          })
        }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSecretKey('');
      toast({ title: 'Настройки сохранены' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Не удалось сохранить',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive'
      });
    } finally {
      setAction(null);
    }
  }

  async function testConnection() {
    setAction('test');
    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/yookassa-fiscal/test`,
        { method: 'POST' }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      toast({ title: 'Подключение к ЮKassa работает' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Проверка не пройдена',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive'
      });
    } finally {
      setAction(null);
    }
  }

  async function remove() {
    if (!confirm('Удалить настройки ЮKassa этого проекта?')) return;
    setAction('delete');
    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/yookassa-fiscal`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Не удалось удалить интеграцию');
      toast({ title: 'Интеграция удалена' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive'
      });
    } finally {
      setAction(null);
    }
  }

  return (
    <Card className='max-w-3xl'>
      <CardHeader>
        <div className='flex items-center justify-between gap-4'>
          <CardTitle>Касса магазина</CardTitle>
          <Badge variant={integration?.isActive ? 'default' : 'secondary'}>
            {integration?.isActive
              ? 'Активна'
              : integration
                ? 'Настроена'
                : 'Не подключена'}
          </Badge>
        </div>
        <CardDescription>
          Это реквизиты ЮKassa владельца магазина. Они не связаны с оплатой
          подписки Gupil и используются только для чеков его покупателей.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className='space-y-5' onSubmit={save}>
          <div className='space-y-2'>
            <Label htmlFor='shop-id'>shopId</Label>
            <Input
              id='shop-id'
              value={shopId}
              onChange={(event) => {
                setShopId(event.target.value);
                setIsActive(false);
              }}
              required
              inputMode='numeric'
              autoComplete='off'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='secret-key'>Секретный ключ ЮKassa</Label>
            <Input
              id='secret-key'
              type='password'
              value={secretKey}
              onChange={(event) => {
                setSecretKey(event.target.value);
                setIsActive(false);
              }}
              required={!integration}
              autoComplete='new-password'
              placeholder={
                integration ? 'Оставьте пустым, чтобы не менять' : ''
              }
            />
            <p className='text-muted-foreground text-xs'>
              Ключ хранится зашифрованным и после сохранения не показывается.
            </p>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='timezone'>Часовая зона кассы</Label>
              <Select
                value={String(timezone)}
                onValueChange={(value) => setTimezone(Number(value))}
              >
                <SelectTrigger id='timezone' className='w-full'>
                  <SelectValue placeholder='Выберите часовую зону' />
                </SelectTrigger>
                <SelectContent>
                  {YOOKASSA_TIMEZONES.map((item) => (
                    <SelectItem key={item.value} value={String(item.value)}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                Это номер зоны из справочника ЮKassa, а не смещение UTC. Для
                Москвы ЮKassa использует номер 2.
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='delivery-vat'>Код НДС доставки</Label>
              <Input
                id='delivery-vat'
                type='number'
                min={1}
                max={12}
                value={deliveryVatCode}
                onChange={(event) => setDeliveryVatCode(event.target.value)}
                placeholder='Если доставка бесплатная — не заполняйте'
              />
            </div>
          </div>
          <div className='flex items-center justify-between rounded-lg border p-4'>
            <div>
              <Label htmlFor='active'>Отправлять маркировочные чеки</Label>
              <p className='text-muted-foreground text-xs'>
                Включение доступно после успешной проверки подключения.
              </p>
            </div>
            <Switch
              id='active'
              checked={isActive}
              disabled={!integration?.lastTestedAt}
              onCheckedChange={setIsActive}
            />
          </div>
          {integration?.lastTestedAt && (
            <p className='flex items-center gap-2 text-sm text-green-700'>
              <CheckCircle2 className='h-4 w-4' />
              Проверено{' '}
              {new Date(integration.lastTestedAt).toLocaleString('ru-RU')}
            </p>
          )}
          {integration?.lastError && (
            <p className='text-destructive text-sm'>{integration.lastError}</p>
          )}
          <div className='flex flex-wrap gap-2'>
            <Button type='submit' disabled={action !== null}>
              {action === 'save' ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Save className='mr-2 h-4 w-4' />
              )}
              Сохранить
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={!integration || action !== null}
              onClick={testConnection}
            >
              {action === 'test' ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <TestTube2 className='mr-2 h-4 w-4' />
              )}
              Проверить подключение
            </Button>
            {integration && (
              <Button
                type='button'
                variant='destructive'
                disabled={action !== null}
                onClick={remove}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Удалить
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
