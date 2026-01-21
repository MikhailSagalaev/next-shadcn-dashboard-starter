/**
 * @file: src/features/profile/components/profile-tab.tsx
 * @description: Компонент таба "Профиль" для объединенной страницы настроек
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 */

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  IconUser,
  IconMail,
  IconCalendar,
  IconShield
} from '@tabler/icons-react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function ProfileTab() {
  const router = useRouter();
  const [stats, setStats] = useState({
    user: {
      name: 'Загрузка...',
      email: '',
      createdAt: new Date(),
      lastLogin: new Date()
    },
    system: {
      projects: 0,
      users: 0,
      bots: 0,
      activeProjects: 0,
      totalBonuses: 0,
      uptime: 0,
      lastActivity: new Date()
    },
    version: 'v2.1.0',
    status: {
      database: 'Проверка...',
      redis: 'Проверка...',
      telegram: 'Проверка...'
    }
  });

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/profile/stats', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      } else {
        if (response.status === 401) {
          router.push('/auth/sign-in');
          return;
        }
        toast.error('Ошибка загрузки статистики');
      }
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    }
  }, [router]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className='w-full space-y-6'>
      <div className='grid gap-6 md:grid-cols-2'>
        {/* Информация о пользователе */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <IconUser className='h-5 w-5' />
              Информация о пользователе
            </CardTitle>
            <CardDescription>Основные данные вашего аккаунта</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-3'>
              <div className='bg-primary flex h-12 w-12 items-center justify-center rounded-full'>
                <IconUser className='text-primary-foreground h-6 w-6' />
              </div>
              <div>
                <h3 className='font-semibold'>{stats.user.name}</h3>
                <p className='text-muted-foreground text-sm'>
                  {stats.user.email}
                </p>
              </div>
            </div>

            <Separator />

            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <IconMail className='text-muted-foreground h-4 w-4' />
                <span className='text-sm'>{stats.user.email}</span>
              </div>
              <div className='flex items-center gap-2'>
                <IconShield className='text-muted-foreground h-4 w-4' />
                <Badge variant='secondary'>Администратор</Badge>
              </div>
              <div className='flex items-center gap-2'>
                <IconCalendar className='text-muted-foreground h-4 w-4' />
                <span className='text-muted-foreground text-sm'>
                  Регистрация:{' '}
                  {new Date(stats.user.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Статистика */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              Статистика системы
            </CardTitle>
            <CardDescription>Обзор активности и использования</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='bg-muted rounded-lg p-4 text-center'>
                <div className='text-primary text-2xl font-bold'>
                  {stats.system.projects}
                </div>
                <div className='text-muted-foreground text-sm'>Проектов</div>
              </div>
              <div className='bg-muted rounded-lg p-4 text-center'>
                <div className='text-primary text-2xl font-bold'>
                  {stats.system.users.toLocaleString()}
                </div>
                <div className='text-muted-foreground text-sm'>
                  Пользователей
                </div>
              </div>
              <div className='bg-muted rounded-lg p-4 text-center'>
                <div className='text-primary text-2xl font-bold'>
                  {stats.system.bots}
                </div>
                <div className='text-muted-foreground text-sm'>Ботов</div>
              </div>
              <div className='bg-muted rounded-lg p-4 text-center'>
                <div className='text-primary text-2xl font-bold'>
                  {stats.system.uptime}%
                </div>
                <div className='text-muted-foreground text-sm'>Uptime</div>
              </div>
            </div>

            <Separator />

            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Последний вход:</span>
                <span>
                  {new Date(stats.user.lastLogin).toLocaleString('ru-RU')}
                </span>
              </div>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Активные проекты:</span>
                <Badge variant='outline'>{stats.system.activeProjects}</Badge>
              </div>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Общие бонусы:</span>
                <span className='font-medium'>
                  {stats.system.totalBonuses.toLocaleString()} бонусов
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
