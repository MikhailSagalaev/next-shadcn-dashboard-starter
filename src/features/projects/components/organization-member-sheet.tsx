'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Gift,
  Loader2,
  Network,
  Pencil,
  RotateCcw,
  ShoppingBag,
  UserMinus,
  Users,
  WalletCards
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/features/orders/components/order-workflow-ui';
import type {
  OrganizationActivityAttribution,
  OrganizationActivityKind,
  OrganizationActivityPeriod
} from '@/lib/services/organization-member-activity.service';
import { OrganizationLevelBadge } from './organization-level-badge';

export interface OrganizationMemberSheetMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  level: number | null;
  title: string | null;
  canManage: boolean;
  invitedByName: string | null;
  referrerLinks: Array<{
    referrerId: string;
    referrerName: string;
    sharePercent: number;
    isPrimary: boolean;
  }>;
  directReferrals: Array<{ id: string; name: string }>;
  joinedAt: string;
  registeredAt: string;
  totalPurchases: number;
  referralBonusEarned: number;
  isActive: boolean;
}

interface ActivityOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  accountedPurchaseAmount: number;
  status: string;
  accountingState: string;
  createdAt: string;
}

interface ActivityEntry {
  id: string;
  occurredAt: string;
  kind: OrganizationActivityKind;
  label: string;
  description: string | null;
  amount: number;
  signedAmount: number;
  referralLevel: number | null;
  attribution: OrganizationActivityAttribution;
  relatedUser: { id: string; name: string } | null;
  order: ActivityOrder | null;
}

interface ActivityResponse {
  summary: {
    purchaseTotal: number;
    referralRewardTotal: number;
    cashbackTotal: number;
    bonusSpentTotal: number;
  };
  activities: ActivityEntry[];
  orders: ActivityOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    scanTruncated: boolean;
    unscopedTransactions: number;
  };
}

interface OrganizationMemberSheetProps {
  projectId: string;
  organizationId: string;
  member: OrganizationMemberSheetMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEdit: (member: OrganizationMemberSheetMember) => void;
  onTransfer: (member: OrganizationMemberSheetMember) => void;
  onRemove: (member: OrganizationMemberSheetMember) => void;
}

const PERIOD_LABEL: Record<OrganizationActivityPeriod, string> = {
  today: 'Сегодня',
  '7d': 'Последние 7 дней',
  '30d': 'Последние 30 дней',
  all: 'Всё время'
};

const formatRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2
  }).format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));

function activityIcon(kind: OrganizationActivityKind) {
  if (kind === 'REFERRAL_REWARD') return Network;
  if (kind === 'PURCHASE_CASHBACK') return Gift;
  if (kind === 'BONUS_SPEND') return WalletCards;
  if (kind === 'BONUS_EXPIRE') return Clock3;
  if (kind.includes('REVERSAL') || kind === 'BONUS_SPEND_RETURN') {
    return RotateCcw;
  }
  return Gift;
}

function attributionLabel(attribution: OrganizationActivityAttribution) {
  if (attribution === 'EXPLICIT') return 'организация зафиксирована в операции';
  if (attribution === 'ORDER') return 'по организации заказа';
  return 'по зафиксированной атрибуции покупателя';
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted/40 rounded-lg p-3'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 font-semibold tabular-nums'>{value}</p>
    </div>
  );
}

export function OrganizationMemberSheet({
  projectId,
  organizationId,
  member,
  open,
  onOpenChange,
  returnFocusRef,
  onEdit,
  onTransfer,
  onRemove
}: OrganizationMemberSheetProps) {
  const [period, setPeriod] = useState<OrganizationActivityPeriod>('30d');
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (page: number, append = false) => {
      if (!member) return;
      const requestId = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        setError('');
        const params = new URLSearchParams({
          period,
          page: String(page),
          limit: '30'
        });
        const response = await fetch(
          `/api/projects/${projectId}/organizations/${organizationId}/members/${member.id}/activity?${params.toString()}`,
          { cache: 'no-store' }
        );
        const next = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(next.error || 'Не удалось загрузить историю');
        }
        if (requestId !== requestIdRef.current) return;
        setData(next);
        setActivities((current) =>
          append
            ? [...current, ...(next.activities ?? [])]
            : (next.activities ?? [])
        );
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить историю'
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [member, organizationId, period, projectId]
  );

  useEffect(() => {
    if (!open || !member) {
      requestIdRef.current += 1;
      return;
    }
    setData(null);
    setActivities([]);
    void load(1);
  }, [load, member, open]);

  const runAndClose = (
    action: (value: OrganizationMemberSheetMember) => void
  ) => {
    if (!member) return;
    onOpenChange(false);
    action(member);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className='w-full gap-0 sm:max-w-2xl'
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <SheetHeader className='border-b px-5 py-4 pe-12'>
          <div className='flex flex-wrap items-center gap-2'>
            <SheetTitle className='text-lg'>
              {member?.name ?? 'Участник'}
            </SheetTitle>
            {member && !member.isActive && (
              <Badge variant='secondary'>Неактивен</Badge>
            )}
            <OrganizationLevelBadge level={member?.level} />
            {member?.canManage && (
              <Badge variant='secondary'>Управляющий</Badge>
            )}
          </div>
          <SheetDescription>
            {[member?.email, member?.phone].filter(Boolean).join(' · ') ||
              'Контактные данные не указаны'}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue='overview' className='flex min-h-0 flex-1 flex-col'>
          <div className='border-b px-5 py-3'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='overview'>Обзор</TabsTrigger>
              <TabsTrigger value='activity'>Начисления</TabsTrigger>
              <TabsTrigger value='orders'>Покупки</TabsTrigger>
            </TabsList>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4'>
            <TabsContent value='overview' className='mt-0 space-y-5'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <Metric
                  label='Покупки в организации'
                  value={formatRub(member?.totalPurchases ?? 0)}
                />
                <Metric
                  label='Реферальные бонусы'
                  value={formatRub(member?.referralBonusEarned ?? 0)}
                />
                <Metric
                  label='Добавлен в организацию'
                  value={
                    member
                      ? new Date(member.joinedAt).toLocaleDateString('ru-RU')
                      : '—'
                  }
                />
                <Metric
                  label='Регистрация в проекте'
                  value={
                    member
                      ? new Date(member.registeredAt).toLocaleDateString(
                          'ru-RU'
                        )
                      : '—'
                  }
                />
              </div>

              <section
                className='space-y-3'
                aria-labelledby='member-links-title'
              >
                <h3 id='member-links-title' className='font-medium'>
                  Реферальные связи
                </h3>
                <div className='space-y-3 text-sm'>
                  <div>
                    <p className='text-muted-foreground text-xs'>Кто привёл</p>
                    <p>{member?.invitedByName ?? 'Не зафиксировано'}</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>Рефереры</p>
                    {member && member.referrerLinks.length > 0 ? (
                      <ul className='mt-1 space-y-1'>
                        {member.referrerLinks.map((link) => (
                          <li key={link.referrerId}>
                            {link.referrerName} · {link.sharePercent}%
                            {link.isPrimary ? ' · основной' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Не назначены</p>
                    )}
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>
                      Прямые рефералы
                    </p>
                    {member && member.directReferrals.length > 0 ? (
                      <ul className='mt-1 space-y-1'>
                        {member.directReferrals.map((referral) => (
                          <li key={referral.id}>{referral.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Нет</p>
                    )}
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value='activity' className='mt-0 space-y-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h3 className='font-medium'>История начислений</h3>
                  <p className='text-muted-foreground text-xs'>
                    Только операции, доказуемо связанные с этой организацией.
                  </p>
                </div>
                <Select
                  value={period}
                  onValueChange={(value) =>
                    setPeriod(value as OrganizationActivityPeriod)
                  }
                >
                  <SelectTrigger
                    className='w-[190px]'
                    aria-label='Период истории'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(PERIOD_LABEL) as OrganizationActivityPeriod[]
                    ).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PERIOD_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {data && (
                <div className='grid gap-2 sm:grid-cols-3'>
                  <Metric
                    label='Реферальные'
                    value={formatRub(data.summary.referralRewardTotal)}
                  />
                  <Metric
                    label='Кэшбэк'
                    value={formatRub(data.summary.cashbackTotal)}
                  />
                  <Metric
                    label='Потрачено бонусов'
                    value={formatRub(data.summary.bonusSpentTotal)}
                  />
                </div>
              )}

              {loading ? (
                <div className='flex items-center justify-center py-12'>
                  <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                  <span className='sr-only'>Загрузка истории</span>
                </div>
              ) : error ? (
                <div className='border-destructive/40 bg-destructive/5 rounded-lg border p-4 text-sm'>
                  <p>{error}</p>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='mt-3'
                    onClick={() => void load(1)}
                  >
                    Повторить
                  </Button>
                </div>
              ) : activities.length === 0 ? (
                <div className='text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm'>
                  За выбранный период начислений этой организации нет.
                </div>
              ) : (
                <ul className='space-y-2'>
                  {activities.map((activity) => {
                    const Icon = activityIcon(activity.kind);
                    return (
                      <li key={activity.id} className='rounded-lg border p-3'>
                        <div className='flex items-start gap-3'>
                          <div className='bg-muted mt-0.5 grid size-9 shrink-0 place-items-center rounded-md'>
                            <Icon className='h-4 w-4' aria-hidden='true' />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                              <div>
                                <p className='font-medium'>{activity.label}</p>
                                <p className='text-muted-foreground text-xs'>
                                  {formatDateTime(activity.occurredAt)}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'font-semibold tabular-nums',
                                  activity.signedAmount < 0
                                    ? 'text-destructive'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                )}
                              >
                                {activity.signedAmount > 0 ? '+' : ''}
                                {formatRub(activity.signedAmount)}
                              </span>
                            </div>
                            {activity.description && (
                              <p className='mt-2 text-sm'>
                                {activity.description}
                              </p>
                            )}
                            <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
                              {activity.relatedUser && (
                                <span>
                                  Покупатель: {activity.relatedUser.name}
                                </span>
                              )}
                              {activity.referralLevel && (
                                <span>Уровень {activity.referralLevel}</span>
                              )}
                              <span>
                                {attributionLabel(activity.attribution)}
                              </span>
                            </div>
                            {activity.order && (
                              <Button
                                type='button'
                                variant='link'
                                size='sm'
                                className='mt-1 h-auto px-0'
                                asChild
                              >
                                <Link
                                  href={`/dashboard/projects/${projectId}/orders/${activity.order.id}`}
                                >
                                  Заказ № {activity.order.orderNumber}
                                  <ArrowUpRight aria-hidden='true' />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {data && data.pagination.unscopedTransactions > 0 && (
                <p className='text-muted-foreground bg-muted/40 rounded-lg p-3 text-xs'>
                  Не показано операций без доказуемой связи с этой организацией:{' '}
                  {data.pagination.unscopedTransactions}.
                </p>
              )}
              {data?.pagination.scanTruncated && (
                <p className='text-muted-foreground text-xs'>
                  История очень большая: показана последняя проверенная часть.
                </p>
              )}
              {data?.pagination.hasMore && (
                <Button
                  type='button'
                  variant='outline'
                  className='w-full'
                  disabled={loadingMore}
                  onClick={() => void load(data.pagination.page + 1, true)}
                >
                  {loadingMore && (
                    <Loader2 className='animate-spin' aria-hidden='true' />
                  )}
                  Показать ещё
                </Button>
              )}
            </TabsContent>

            <TabsContent value='orders' className='mt-0 space-y-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h3 className='font-medium'>Покупки участника</h3>
                  <p className='text-muted-foreground text-xs'>
                    Заказы, отнесённые к выбранной организации.
                  </p>
                </div>
                <Select
                  value={period}
                  onValueChange={(value) =>
                    setPeriod(value as OrganizationActivityPeriod)
                  }
                >
                  <SelectTrigger
                    className='w-[190px]'
                    aria-label='Период покупок'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(PERIOD_LABEL) as OrganizationActivityPeriod[]
                    ).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PERIOD_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className='flex items-center justify-center py-12'>
                  <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                  <span className='sr-only'>Загрузка покупок</span>
                </div>
              ) : data?.orders.length ? (
                <ul className='space-y-2'>
                  {data.orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/dashboard/projects/${projectId}/orders/${order.id}`}
                        className='hover:bg-muted/50 focus-visible:ring-ring flex min-h-16 items-center gap-3 rounded-lg border p-3 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                      >
                        <div className='bg-muted grid size-9 shrink-0 place-items-center rounded-md'>
                          <ShoppingBag className='h-4 w-4' aria-hidden='true' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='font-medium'>
                            Заказ № {order.orderNumber}
                          </p>
                          <p className='text-muted-foreground flex items-center gap-1 text-xs'>
                            <CalendarDays
                              className='h-3 w-3'
                              aria-hidden='true'
                            />
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                        <div className='text-end'>
                          <p className='font-medium tabular-nums'>
                            {formatRub(order.totalAmount)}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </p>
                        </div>
                        <ArrowUpRight
                          className='text-muted-foreground h-4 w-4 shrink-0'
                          aria-hidden='true'
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className='text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm'>
                  За выбранный период покупок этой организации нет.
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {member && (
          <>
            <Separator />
            <SheetFooter className='grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => runAndClose(onEdit)}
              >
                <Pencil aria-hidden='true' />
                Редактировать
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => runAndClose(onTransfer)}
              >
                <Users aria-hidden='true' />
                Перенести
              </Button>
              <Button
                type='button'
                variant='outline'
                className='text-destructive hover:text-destructive'
                onClick={() => runAndClose(onRemove)}
              >
                <UserMinus aria-hidden='true' />
                Убрать
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
