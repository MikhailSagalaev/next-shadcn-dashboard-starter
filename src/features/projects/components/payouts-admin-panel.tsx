/**
 * @file: src/features/projects/components/payouts-admin-panel.tsx
 * @description: Админ-очередь заявок на вывод b2b-комиссии (план 007). Список +
 *   действия Одобрить / Отклонить / Отметить выплаченным / Сбой.
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wallet, RefreshCw, Download, Settings2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface PayoutsAdminPanelProps {
  projectId: string;
  initialPayoutMinAmount?: number;
  initialPayoutHoldDays?: number;
}

type PayoutStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

interface PayoutItem {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: string | null;
  payoutDetails: {
    raw?: string;
    inn?: string;
    fullName?: string;
    cardNumber?: string;
  } | null;
  requestedAt: string;
  paidAt: string | null;
  rejectReason: string | null;
  failReason: string | null;
  externalRef: string | null;
  partner: { id: string; name: string };
}

const STATUS_LABEL: Record<PayoutStatus, string> = {
  REQUESTED: 'Новая',
  APPROVED: 'Одобрена',
  PAID: 'Выплачена',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отозвана',
  FAILED: 'Сбой'
};

const STATUS_VARIANT: Record<
  PayoutStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  REQUESTED: 'default',
  APPROVED: 'secondary',
  PAID: 'outline',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
  FAILED: 'destructive'
};

const PAYOUT_METHOD_LABEL: Record<string, string> = {
  card: 'Карта',
  sbp: 'Телефон (СБП)',
  wallet: 'Кошелёк',
  self_employed: 'Самозанятый'
};

function formatPayoutRequisites(item: PayoutItem): string {
  const methodLabel = item.payoutMethod
    ? (PAYOUT_METHOD_LABEL[item.payoutMethod] ?? item.payoutMethod)
    : null;

  const details = item.payoutDetails;
  // self_employed хранит структурированные поля, а не одну строку raw —
  // рендерим их явно (ИНН/ФИО/карта), а не как непонятный JSON.
  if (details?.inn || details?.fullName || details?.cardNumber) {
    const parts = [
      details.fullName,
      details.inn ? `ИНН ${details.inn}` : null,
      details.cardNumber ? `карта ${details.cardNumber}` : null
    ].filter(Boolean);
    const body = parts.join(', ');
    return methodLabel ? `${methodLabel}: ${body}` : body;
  }

  const raw = details?.raw;
  if (methodLabel && raw) return `${methodLabel}: ${raw}`;
  if (raw) return raw;
  if (methodLabel) return methodLabel;
  return '—';
}

export function PayoutsAdminPanel({
  projectId,
  initialPayoutMinAmount = 0,
  initialPayoutHoldDays = 0
}: PayoutsAdminPanelProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [payoutMinAmount, setPayoutMinAmount] = useState(
    initialPayoutMinAmount
  );
  const [payoutHoldDays, setPayoutHoldDays] = useState(initialPayoutHoldDays);
  const [savingSettings, setSavingSettings] = useState(false);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-program/payout-settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payoutMinAmount, payoutHoldDays })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      toast({ title: 'Настройки выплат сохранены' });
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось сохранить',
        variant: 'destructive'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        statusFilter && statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/projects/${projectId}/payouts${qs}`);
      if (!res.ok) throw new Error('Не удалось загрузить заявки');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Ошибка загрузки',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    payoutId: string,
    action: 'approve' | 'reject' | 'paid' | 'fail'
  ) => {
    // reject/fail просят причину; paid — № платёжки (опц.).
    let body: Record<string, string> = {};
    if (action === 'reject' || action === 'fail') {
      const reason = window.prompt('Причина:') ?? '';
      body = { reason };
    } else if (action === 'paid') {
      const externalRef = window.prompt('№ платёжки / референс (опц.):') ?? '';
      body = { externalRef };
    }

    setBusyId(payoutId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/payouts/${payoutId}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Действие не выполнено');
      toast({ title: 'Готово', description: 'Статус заявки обновлён' });
      await load();
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Ошибка',
        variant: 'destructive'
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Settings2 className='mr-2 h-5 w-5' />
            Настройки выплат
          </CardTitle>
          <CardDescription>
            Порог и способы вывода b2b-комиссии партнёрам — не пересекается с
            обычной реферальной программой на вкладке «Настройки».
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='payoutMinAmount'>
                Минимальная сумма вывода, ₽
              </Label>
              <Input
                id='payoutMinAmount'
                type='number'
                step='100'
                min='0'
                value={payoutMinAmount}
                onChange={(e) => setPayoutMinAmount(Number(e.target.value))}
              />
              <p className='text-muted-foreground text-xs'>
                0 — без ограничения
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='payoutHoldDays'>
                Период удержания перед выводом, дней
              </Label>
              <Input
                id='payoutHoldDays'
                type='number'
                step='1'
                min='0'
                max='365'
                value={payoutHoldDays}
                onChange={(e) => setPayoutHoldDays(Number(e.target.value))}
              />
              <p className='text-muted-foreground text-xs'>
                0 — без удержания. Сейчас поле сохраняется, но не проверяется
                при выводе — это отдельная задача, порог ещё не применяется.
              </p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            Сохранить
          </Button>

          <div className='space-y-2 border-t pt-4'>
            <p className='text-sm font-medium'>
              Способы вывода, доступные партнёрам
            </p>
            <div className='flex flex-wrap gap-2'>
              {Object.entries(PAYOUT_METHOD_LABEL).map(([key, label]) => (
                <Badge key={key} variant='outline'>
                  {label}
                </Badge>
              ))}
            </div>
            <p className='text-muted-foreground text-xs'>
              Одинаковый набор для всех проектов — партнёр выбирает способ в
              боте перед вводом реквизитов. Пока не настраивается по проектам
              (нельзя отключить конкретный способ здесь).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center'>
                <Wallet className='mr-2 h-5 w-5' />
                Заявки на вывод
              </CardTitle>
              <CardDescription>
                Очередь выплат партнёрам. Одобрите, выплатите вручную и отметьте
                выплаченным; отклонение/сбой возвращают бонусы партнёру.
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='w-[160px]'>
                  <SelectValue placeholder='Статус' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>Все статусы</SelectItem>
                  <SelectItem value='REQUESTED'>Новые</SelectItem>
                  <SelectItem value='APPROVED'>Одобренные</SelectItem>
                  <SelectItem value='PAID'>Выплаченные</SelectItem>
                  <SelectItem value='REJECTED'>Отклонённые</SelectItem>
                  <SelectItem value='CANCELLED'>Отозванные</SelectItem>
                  <SelectItem value='FAILED'>Сбой</SelectItem>
                </SelectContent>
              </Select>
              <Button variant='outline' size='icon' onClick={load}>
                <RefreshCw className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  const qs =
                    statusFilter && statusFilter !== 'ALL'
                      ? `?status=${statusFilter}`
                      : '';
                  window.open(
                    `/api/projects/${projectId}/payouts/export${qs}`,
                    '_blank'
                  );
                }}
              >
                <Download className='mr-2 h-4 w-4' />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              Загрузка…
            </p>
          ) : items.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              Заявок нет.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Партнёр</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Реквизиты</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Подана</TableHead>
                  <TableHead className='text-right'>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className='font-medium'>
                      {p.partner.name}
                    </TableCell>
                    <TableCell>
                      {p.amount.toLocaleString('ru-RU')} {p.currency}
                    </TableCell>
                    <TableCell className='max-w-[220px] truncate text-sm'>
                      {formatPayoutRequisites(p)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status]}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      {p.rejectReason && (
                        <span className='text-muted-foreground ml-2 text-xs'>
                          {p.rejectReason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-sm'>
                      {new Date(p.requestedAt).toLocaleString('ru-RU')}
                    </TableCell>
                    <TableCell className='space-x-2 text-right'>
                      {p.status === 'REQUESTED' && (
                        <>
                          <Button
                            size='sm'
                            disabled={busyId === p.id}
                            onClick={() => act(p.id, 'approve')}
                          >
                            Одобрить
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            disabled={busyId === p.id}
                            onClick={() => act(p.id, 'reject')}
                          >
                            Отклонить
                          </Button>
                        </>
                      )}
                      {p.status === 'APPROVED' && (
                        <>
                          <Button
                            size='sm'
                            disabled={busyId === p.id}
                            onClick={() => act(p.id, 'paid')}
                          >
                            Выплачено
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            disabled={busyId === p.id}
                            onClick={() => act(p.id, 'fail')}
                          >
                            Сбой
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
