'use client';

import { useState } from 'react';
import { FileSignature, Loader2, Save } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);

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
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className='animate-spin' /> : <Save />}
          Сохранить ЭДО/ГИС МТ
        </Button>
      </CardContent>
    </Card>
  );
}
