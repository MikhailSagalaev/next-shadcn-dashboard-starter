/**
 * @file: src/features/projects/components/hierarchy-tab-panel.tsx
 * @description: Клиентская обёртка над `HierarchyTree` для встраивания в
 *   таблицу вкладок реферальной программы (вместо отдельной страницы
 *   `/referral/hierarchy`, на которую раньше вела кнопка). Сама грузит
 *   данные через `/api/projects/[id]/hierarchy` — смена периода больше не
 *   уводит со страницы полной навигацией, а просто перезапрашивает данные.
 *   Также сама грузит список организаций для фильтра — раньше выбор сети
 *   был доступен только переходом со страницы «Организации» по ссылке с
 *   query-параметрами.
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { EmptyState } from '@/components/composite';
import { HierarchyTree } from './hierarchy-tree';
import { JoinRequestsPanel } from './join-requests-panel';
import type {
  HierarchyNode,
  HierarchyPeriod
} from '@/app/dashboard/projects/[id]/referral/hierarchy/data-access';

const ALL_ORGS_VALUE = '__all__';

const formatRub = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(n);

interface TreeResponse {
  rootIds: string[];
  nodes: HierarchyNode[];
  totals: {
    members: number;
    trainers: number;
    managers: number;
    directors: number;
    commissionTotal: number;
  };
}

export function HierarchyTabPanel({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const [organizationId, setOrganizationId] = useState<string | null>(
    searchParams.get('organizationId')
  );
  const [organizationNameParam] = useState<string | null>(
    searchParams.get('organizationName')
  );
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [period, setPeriod] = useState<HierarchyPeriod>(
    (searchParams.get('period') as HierarchyPeriod) || '30d'
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TreeResponse | null>(null);

  // Список организаций — только для селектора фильтра, не блокирует
  // загрузку самого дерева.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/organizations`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const list = Array.isArray(json?.organizations)
          ? json.organizations
          : [];
        if (!cancelled) {
          setOrganizations(
            list.map((o: { id: string; name: string }) => ({
              id: o.id,
              name: o.name
            }))
          );
        }
      } catch {
        // ignore — фильтр просто не покажет варианты
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const organizationName =
    organizations.find((o) => o.id === organizationId)?.name ??
    organizationNameParam;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (organizationId) params.set('organizationId', organizationId);
      const res = await fetch(
        `/api/projects/${projectId}/hierarchy?${params.toString()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [projectId, period, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className='space-y-4'>
      {organizations.length > 0 && (
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm'>Сеть:</span>
          <Select
            value={organizationId ?? ALL_ORGS_VALUE}
            onValueChange={(value) =>
              setOrganizationId(value === ALL_ORGS_VALUE ? null : value)
            }
          >
            <SelectTrigger className='w-[240px]'>
              <SelectValue placeholder='Все организации' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ORGS_VALUE}>Все организации</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {organizationId && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setOrganizationId(null)}
            >
              <X className='mr-1 h-3.5 w-3.5' />
              Сбросить
            </Button>
          )}
        </div>
      )}

      {organizationId && (
        <div className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
          <span>
            Показана только сеть{' '}
            <strong>{organizationName ?? organizationId}</strong>
          </span>
        </div>
      )}

      <JoinRequestsPanel projectId={projectId} />

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
        <SummaryCard
          label='Всего в дереве'
          value={data.totals.members}
          accent='zinc'
        />
        <SummaryCard
          label='Тренеры'
          value={data.totals.trainers}
          accent='blue'
        />
        <SummaryCard
          label='Менеджеры'
          value={data.totals.managers}
          accent='purple'
        />
        <SummaryCard
          label='Руководители'
          value={data.totals.directors}
          accent='amber'
        />
        <SummaryCard
          label='Вознаграждение за период'
          value={formatRub(data.totals.commissionTotal)}
          accent='emerald'
        />
      </div>

      {data.nodes.length === 0 ? (
        <EmptyState
          icon={Users}
          title='Партнёров пока нет'
          description='Назначьте пользователям роль (тренер / менеджер / руководитель) в разделе «Пользователи». Они начнут появляться в дереве сразу же.'
          action={
            <Link
              href={`/dashboard/projects/${projectId}/users`}
              className='text-primary text-sm underline'
            >
              Перейти к пользователям →
            </Link>
          }
        />
      ) : (
        <HierarchyTree
          projectId={projectId}
          nodes={data.nodes}
          rootIds={data.rootIds}
          period={period}
          onPeriodChange={setPeriod}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent
}: {
  label: string;
  value: number | string;
  accent: 'zinc' | 'blue' | 'purple' | 'amber' | 'emerald';
}) {
  const accentClass: Record<typeof accent, string> = {
    zinc: 'border-zinc-200 dark:border-zinc-800',
    blue: 'border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20',
    purple:
      'border-purple-200 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20',
    amber:
      'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20',
    emerald:
      'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
  };
  return (
    <div className={`glass-card rounded-xl border p-4 ${accentClass[accent]}`}>
      <div className='text-muted-foreground text-xs font-medium uppercase'>
        {label}
      </div>
      <div className='mt-2 text-2xl font-semibold'>{value}</div>
    </div>
  );
}
