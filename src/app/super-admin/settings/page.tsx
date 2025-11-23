'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface SystemStatus {
  version: string;
  metrics: {
    projects: number;
    users: number;
    bots: number;
    admins: number;
  };
  status: {
    database: string;
    redis: string;
    telegram: string;
  };
  fetchedAt: string;
}

export default function SuperAdminSettingsPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/super-admin/system-status');
        if (response.ok) {
          const data = await response.json();
          setSystemStatus(data);
        }
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, []);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>
          Системные настройки
        </h1>
        <p className='text-muted-foreground'>
          Управление настройками системы и feature flags
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            Форма с feature flags, глобальными лимитами, системной информацией
            будет добавлена в следующих итерациях.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Системная информация</CardTitle>
          <p className='text-muted-foreground text-sm'>
            Обновлено:{' '}
            {systemStatus
              ? new Date(systemStatus.fetchedAt).toLocaleString('ru-RU')
              : '—'}
          </p>
        </CardHeader>
        <CardContent>
          {loading || !systemStatus ? (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <AlertCircle className='h-4 w-4 animate-pulse' />
              Загрузка состояния системы...
            </div>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              <div className='space-y-4'>
                <p className='text-muted-foreground text-sm'>
                  Версия платформы:{' '}
                  <span className='text-foreground font-medium'>
                    {systemStatus.version}
                  </span>
                </p>
                <div className='text-muted-foreground space-y-2 text-sm'>
                  <div className='flex items-center justify-between'>
                    <span>Проектов</span>
                    <span className='text-foreground font-medium'>
                      {systemStatus.metrics.projects}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span>Пользователей</span>
                    <span className='text-foreground font-medium'>
                      {systemStatus.metrics.users}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span>Ботов</span>
                    <span className='text-foreground font-medium'>
                      {systemStatus.metrics.bots}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span>Администраторов</span>
                    <span className='text-foreground font-medium'>
                      {systemStatus.metrics.admins}
                    </span>
                  </div>
                </div>
              </div>

              <div className='space-y-3 text-sm'>
                {[
                  { label: 'База данных', value: systemStatus.status.database },
                  { label: 'Redis', value: systemStatus.status.redis },
                  { label: 'Telegram API', value: systemStatus.status.telegram }
                ].map((item) => (
                  <div
                    key={item.label}
                    className='flex items-center justify-between'
                  >
                    <span className='text-muted-foreground'>{item.label}</span>
                    <Badge
                      variant={
                        item.value.includes('нет') ||
                        item.value.includes('Недоступен')
                          ? 'destructive'
                          : 'default'
                      }
                      className='flex items-center gap-1'
                    >
                      {item.value.includes('нет') ||
                      item.value.includes('Недоступен') ? (
                        <AlertCircle className='h-3 w-3' />
                      ) : (
                        <CheckCircle className='h-3 w-3' />
                      )}
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
