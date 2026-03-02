/**
 * @file: credentials.tsx
 * @description: Display and manage МойСклад Loyalty API credentials
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
import { useToast } from '@/hooks/use-toast';
import { Copy, Eye, EyeOff, RefreshCw, Loader2 } from 'lucide-react';

interface CredentialsProps {
  projectId: string;
  baseUrl: string;
  isActive: boolean;
}

export function MoySkladCredentials({
  projectId,
  baseUrl,
  isActive
}: CredentialsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано',
      description: `${label} скопирован в буфер обмена`,
    });
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Вы уверены? Старый токен перестанет работать. Вам нужно будет обновить токен в настройках МойСклад.')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad/regenerate-token`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate token');
      }

      const data = await response.json();
      setAuthToken(data.authToken);
      setShowToken(true);

      toast({
        title: 'Токен обновлен',
        description: 'Новый токен сгенерирован. Обновите его в настройках МойСклад.',
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить токен',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='border-indigo-200 dark:border-indigo-900'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          🔑 Credentials для МойСклад
        </CardTitle>
        <CardDescription>
          Используйте эти данные для настройки интеграции в МойСклад
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Base URL */}
        <div className='space-y-2'>
          <Label htmlFor='baseUrl'>Base URL</Label>
          <div className='flex gap-2'>
            <Input
              id='baseUrl'
              value={baseUrl}
              readOnly
              className='font-mono text-sm'
            />
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => copyToClipboard(baseUrl, 'Base URL')}
            >
              <Copy className='h-4 w-4' />
            </Button>
          </div>
          <p className='text-xs text-zinc-500'>
            Укажите этот URL в настройках Loyalty API в МойСклад
          </p>
        </div>

        {/* Auth Token */}
        <div className='space-y-2'>
          <Label htmlFor='authToken'>Auth Token</Label>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                id='authToken'
                type={showToken ? 'text' : 'password'}
                value={authToken || '••••••••••••••••••••••••••••••••'}
                readOnly
                className='font-mono text-sm pr-10'
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-0 top-0 h-full'
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </Button>
            </div>
            {authToken && (
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => copyToClipboard(authToken, 'Auth Token')}
              >
                <Copy className='h-4 w-4' />
              </Button>
            )}
          </div>
          <p className='text-xs text-zinc-500'>
            Укажите этот токен в заголовке Lognex-Discount-API-Auth-Token
          </p>
        </div>

        {/* Regenerate Token Button */}
        <div className='flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950'>
          <div className='space-y-1'>
            <p className='text-sm font-medium text-yellow-900 dark:text-yellow-100'>
              Обновить токен
            </p>
            <p className='text-xs text-yellow-700 dark:text-yellow-300'>
              Старый токен перестанет работать после обновления
            </p>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleRegenerateToken}
            disabled={loading || !isActive}
          >
            {loading ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <RefreshCw className='mr-2 h-4 w-4' />
            )}
            Обновить
          </Button>
        </div>

        {/* Warning */}
        {!isActive && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950'>
            <p className='text-sm font-medium text-red-900 dark:text-red-100'>
              ⚠️ Интеграция отключена
            </p>
            <p className='text-xs text-red-700 dark:text-red-300 mt-1'>
              Активируйте интеграцию в форме ниже, чтобы МойСклад мог вызывать API
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
