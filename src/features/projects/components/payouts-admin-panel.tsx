/**
 * @file: src/features/projects/components/payouts-admin-panel.tsx
 * @description: Админ-очередь заявок на вывод b2b-комиссии (план 007). Список +
 *   действия Одобрить / Отклонить / Отметить выплаченным / Сбой.
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wallet, RefreshCw, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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

export function PayoutsAdminPanel({ projectId }: PayoutsAdminPanelProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

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
  );
}
