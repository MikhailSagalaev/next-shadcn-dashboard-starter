'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  FileSignature,
  Loader2,
  Save,
  Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

type Integration = {
  provider: 'MANUAL' | 'CUSTOM_GATEWAY';
  isActive: boolean;
  gatewayUrl: string | null;
  hasCredential: boolean;
  distanceSaleMode:
    | 'UNCONFIGURED'
    | 'KKT_MARKED_RECEIPT'
    | 'GIS_MT_DISTANCE_SALE';
  lastTestedAt?: string | Date | null;
  lastError?: string | null;
} | null;

export function ComplianceIntegrationForm({
  projectId,
  integration
}: {
  projectId: string;
  integration: Integration;
}) {
  const [provider, setProvider] = useState<'MANUAL' | 'CUSTOM_GATEWAY'>(
    integration?.provider ?? 'MANUAL'
  );
  const [gatewayUrl, setGatewayUrl] = useState(integration?.gatewayUrl ?? '');
  const [credential, setCredential] = useState('');
  const [distanceSaleMode, setDistanceSaleMode] = useState(
    integration?.distanceSaleMode ?? 'UNCONFIGURED'
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>([]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/compliance-integration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            isActive: provider === 'CUSTOM_GATEWAY',
            distanceSaleMode,
            gatewayUrl: provider === 'CUSTOM_GATEWAY' ? gatewayUrl : undefined,
            credential:
              provider === 'CUSTOM_GATEWAY' && credential
                ? credential
                : undefined
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Настройки не сохранены');
      setCredential('');
      toast.success('Настройки ЭДО/ГИС МТ сохранены');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Настройки не сохранены'
      );
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/compliance-integration/test`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Шлюз недоступен');
      const list = Array.isArray(data.capabilities?.capabilities)
        ? data.capabilities.capabilities.map(String)
        : [];
      setCapabilities(list);
      toast.success('Шлюз отвечает и готов принимать запросы');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Шлюз недоступен');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>УПД, ЭДО и ГИС МТ</CardTitle>
        <CardDescription>
          Проектные реквизиты оператора для приёмок, возврата в оборот и
          документов списания. Они не связаны с оплатой подписки Gupil.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        <Alert>
          <FileSignature />
          <AlertTitle>Юридически значимые документы требуют УКЭП</AlertTitle>
          <AlertDescription>
            В ручном режиме Gupil готовит и контролирует документ, но не
            изображает успешную отправку. Автоматическая отправка включается
            только через совместимый шлюз вашего оператора ЭДО/ГИС МТ.
          </AlertDescription>
        </Alert>
        <div className='space-y-2'>
          <Label>Как выводить Data Matrix при дистанционной продаже</Label>
          <Select
            value={distanceSaleMode}
            onValueChange={(value) =>
              setDistanceSaleMode(
                value as
                  | 'UNCONFIGURED'
                  | 'KKT_MARKED_RECEIPT'
                  | 'GIS_MT_DISTANCE_SALE'
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='UNCONFIGURED'>
                Не выбрано — отгрузка заблокирована
              </SelectItem>
              <SelectItem value='KKT_MARKED_RECEIPT'>
                Через маркировочный чек ЮKassa
              </SelectItem>
              <SelectItem value='GIS_MT_DISTANCE_SALE'>
                Через ГИС МТ «Дистанционная торговля»
              </SelectItem>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>
            Для собственной доставки обычно используется чек с кодом. Для
            сторонней службы доставки может требоваться отдельный документ ГИС
            МТ. Один код нельзя выводить обоими способами.
          </p>
        </div>
        {distanceSaleMode === 'UNCONFIGURED' && (
          <Alert variant='destructive'>
            <AlertTriangle />
            <AlertTitle>Схема продажи не выбрана</AlertTitle>
            <AlertDescription>
              Gupil не разрешит сформировать маркировочный чек или отправить
              заказ в ГИС МТ, пока вы явно не выберете один способ.
            </AlertDescription>
          </Alert>
        )}
        {distanceSaleMode === 'GIS_MT_DISTANCE_SALE' && (
          <Alert>
            <Truck />
            <AlertTitle>Для полной автоматизации нужен шлюз</AlertTitle>
            <AlertDescription>
              Шлюз должен принять документ дистанционной продажи, вернуть
              квитанцию ГИС МТ и подтвердить успешный закрывающий чек. Без двух
              подтверждений Gupil не разрешит отгрузку.
            </AlertDescription>
          </Alert>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Режим работы</Label>
            <Select
              value={provider}
              onValueChange={(value) =>
                setProvider(value as 'MANUAL' | 'CUSTOM_GATEWAY')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='MANUAL'>
                  Ручная подпись у оператора
                </SelectItem>
                <SelectItem value='CUSTOM_GATEWAY'>
                  API-шлюз оператора
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {provider === 'CUSTOM_GATEWAY' && (
            <div className='space-y-2'>
              <Label htmlFor='gateway-url'>HTTPS endpoint шлюза</Label>
              <Input
                id='gateway-url'
                value={gatewayUrl}
                onChange={(event) => setGatewayUrl(event.target.value)}
                placeholder='https://operator.example/api/documents'
              />
            </div>
          )}
        </div>
        {provider === 'CUSTOM_GATEWAY' && (
          <div className='space-y-2'>
            <Label htmlFor='gateway-key'>Ключ доступа</Label>
            <Input
              id='gateway-key'
              type='password'
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              placeholder={
                integration?.hasCredential
                  ? 'Оставьте пустым, чтобы не менять'
                  : 'Ключ API оператора'
              }
            />
            <p className='text-muted-foreground text-xs'>
              Хранится зашифрованным отдельно для этого проекта и после
              сохранения не показывается.
            </p>
          </div>
        )}
        <div className='flex flex-wrap gap-2'>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className='animate-spin' /> : <Save />}
            Сохранить ЭДО/ГИС МТ
          </Button>
          {provider === 'CUSTOM_GATEWAY' && (
            <Button
              variant='outline'
              onClick={test}
              disabled={testing || saving}
            >
              {testing ? <Loader2 className='animate-spin' /> : <Truck />}
              Проверить шлюз
            </Button>
          )}
        </div>
        {capabilities.length > 0 && (
          <p className='text-muted-foreground text-sm'>
            Возможности шлюза: {capabilities.join(', ')}
          </p>
        )}
        {integration?.lastError && (
          <Alert variant='destructive'>
            <AlertTriangle />
            <AlertTitle>Последняя проверка неуспешна</AlertTitle>
            <AlertDescription>{integration.lastError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
