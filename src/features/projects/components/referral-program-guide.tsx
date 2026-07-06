/**
 * @file: referral-program-guide.tsx
 * @description: Пояснение единой реферальной модели: клиентские бонусы + партнёрские комиссии + организации
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Gift,
  Link2,
  Users
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReferralProgramGuideProps {
  enablePartnerRoles?: boolean;
}

// Общий на все проекты — если админ уже разобрался с моделью на одном
// проекте, повторно разворачивать объяснение на следующих не нужно.
const STORAGE_KEY = 'referral-program-guide:collapsed';

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function ReferralProgramGuide({
  enablePartnerRoles = false
}: ReferralProgramGuideProps) {
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // localStorage может быть недоступен (приватный режим) — не критично
    }
  };

  if (enablePartnerRoles) {
    if (collapsed) {
      // Не используем `Alert` здесь: его CSS-грид завязан на прямом
      // svg-ребёнке (`has-[>svg]:grid-cols-...`), а тут иконка вложена
      // внутрь <button> — обычный div безопаснее, чем подстраиваться под
      // этот контракт.
      return (
        <button
          type='button'
          onClick={toggle}
          className='flex w-full items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-2 text-left dark:border-blue-900/40 dark:bg-blue-950/30'
        >
          <span className='flex items-center gap-2'>
            <Users className='h-4 w-4 shrink-0 text-blue-600' />
            <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>
              Одна программа — три слоя: бонусы клиенту, планы партнёров,
              организации
            </span>
          </span>
          <ChevronDown className='h-4 w-4 shrink-0 text-blue-600' />
        </button>
      );
    }

    return (
      <Alert className='border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/30'>
        <Users className='h-4 w-4 text-blue-600' />
        <div className='flex items-start justify-between gap-2'>
          <AlertTitle className='text-blue-900 dark:text-blue-100'>
            Одна программа — три слоя
          </AlertTitle>
          <Button
            variant='ghost'
            size='sm'
            className='h-6 shrink-0 px-2 text-blue-700 hover:bg-blue-100/60 dark:text-blue-200'
            onClick={toggle}
          >
            <ChevronUp className='mr-1 h-3.5 w-3.5' />
            Свернуть
          </Button>
        </div>
        <AlertDescription className='space-y-4 text-sm text-blue-950/90 dark:text-blue-100/90'>
          <p>
            Это не три разных сценария на выбор. Все слои работают{' '}
            <strong>одновременно</strong> в одном проекте:
          </p>
          <div className='grid gap-3 md:grid-cols-3'>
            <div className='rounded-md border border-blue-200/80 bg-white/70 p-3 dark:border-blue-800/50 dark:bg-blue-950/20'>
              <div className='mb-2 flex items-center gap-2'>
                <Badge variant='secondary'>Настройки</Badge>
                <Gift className='h-4 w-4' />
              </div>
              <p className='font-medium'>Бонусы клиенту</p>
              <p className='text-muted-foreground mt-1 text-xs'>
                Приветственные бонусы, скидка, % с первой покупки — для
                покупателя, который пришёл по ссылке
              </p>
            </div>
            <div className='rounded-md border border-blue-200/80 bg-white/70 p-3 dark:border-blue-800/50 dark:bg-blue-950/20'>
              <div className='mb-2 flex items-center gap-2'>
                <Badge variant='secondary'>Планы партнёров</Badge>
                <ArrowRight className='h-4 w-4' />
              </div>
              <p className='font-medium'>Вознаграждения партнёрам</p>
              <p className='text-muted-foreground mt-1 text-xs'>
                L1 тренер → L2 менеджер → L3 руководитель. Проценты задаются
                партнёрскими планами, а не клиентскими бонусами
              </p>
            </div>
            <div className='rounded-md border border-blue-200/80 bg-white/70 p-3 dark:border-blue-800/50 dark:bg-blue-950/20'>
              <div className='mb-2 flex items-center gap-2'>
                <Badge variant='secondary'>Организации</Badge>
                <Building2 className='h-4 w-4' />
              </div>
              <p className='font-medium'>Сети партнёров</p>
              <p className='text-muted-foreground mt-1 text-xs'>
                Группировка клубов/филиалов: общий руководитель, план по
                умолчанию, utm_org в ссылках
              </p>
            </div>
          </div>
          <div className='flex items-start gap-2 rounded-md border border-blue-200/60 bg-white/60 p-3 dark:border-blue-800/40 dark:bg-blue-950/10'>
            <Link2 className='mt-0.5 h-4 w-4 shrink-0' />
            <p>
              Ссылка партнёра может содержать{' '}
              <code className='text-xs'>utm_ref=ID</code> и{' '}
              <code className='text-xs'>utm_org=slug</code> сразу. Система
              привязывает клиента к пригласившему партнёру и к нужной сети — без
              выбора «одного сценария».
            </p>
          </div>
          <p className='text-muted-foreground text-xs'>
            Блок «Многоуровневая программа» во вкладке «Настройки» — legacy для
            c2c-рефералов. При включённых персональных планах выплаты считаются
            только по партнёрским планам на одноимённой вкладке.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (collapsed) {
    return (
      <button
        type='button'
        onClick={toggle}
        className='bg-card flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-2 text-left'
      >
        <span className='flex items-center gap-2'>
          <Gift className='h-4 w-4 shrink-0' />
          <span className='text-sm font-medium'>
            Настройки и планы — зачем две вкладки
          </span>
        </span>
        <ChevronDown className='h-4 w-4 shrink-0' />
      </button>
    );
  }

  return (
    <Alert>
      <Gift className='h-4 w-4' />
      <div className='flex items-start justify-between gap-2'>
        <AlertTitle>Настройки и планы — зачем две вкладки</AlertTitle>
        <Button
          variant='ghost'
          size='sm'
          className='h-6 shrink-0 px-2'
          onClick={toggle}
        >
          <ChevronUp className='mr-1 h-3.5 w-3.5' />
          Свернуть
        </Button>
      </div>
      <AlertDescription className='space-y-2 text-sm'>
        <p>
          <strong>«Настройки»</strong> — бонусы для новых клиентов и базовые
          уровни реферальной программы (c2c-режим).
        </p>
        <p>
          <strong>«Планы %»</strong> — персональные схемы выплат для отдельных
          партнёров. Включите переключатель «Персональные планы», если разным
          партнёрам нужны разные проценты.
        </p>
      </AlertDescription>
    </Alert>
  );
}
