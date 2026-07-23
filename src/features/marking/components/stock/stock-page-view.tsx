'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Search,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { MarkingWorkspaceNav } from '@/features/marking/components/marking-workspace-nav';
import {
  formatReceivingDate,
  unitStatusLabel
} from '@/features/marking/components/receiving/receiving-types';

interface StockUnit {
  id: string;
  gtin?: string | null;
  code?: string | null;
  maskedCode?: string | null;
  serial?: string | null;
  status: string;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
  } | null;
  receipt?: {
    id: string;
    number?: string | null;
    documentNumber?: string | null;
  } | null;
  order?: {
    id: string;
    orderNumber?: string | null;
  } | null;
  reservedAt?: string | null;
  receivedAt?: string | null;
  createdAt?: string | null;
  quarantineReason?: string | null;
}

const PAGE_SIZE = 25;

export function StockPageView({ projectId }: { projectId: string }) {
  const requestId = useRef(0);
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    available: 0,
    reserved: 0,
    quarantine: 0,
    total: 0
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });
      if (search) params.set('search', search);
      if (status !== 'ALL') params.set('status', status);
      const response = await fetch(
        `/api/projects/${projectId}/stock-units?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось загрузить склад');
      if (currentRequest !== requestId.current) return;
      const nextUnits = data.stockUnits ?? data.units ?? data.items ?? [];
      setUnits(nextUnits);
      const pagination = data.pagination ?? {};
      setTotal(data.total ?? pagination.total ?? nextUnits.length);
      setTotalPages(Math.max(1, data.totalPages ?? pagination.totalPages ?? 1));
      setSummary(
        data.summary ?? {
          available: nextUnits.filter(
            (unit: StockUnit) => unit.status === 'AVAILABLE'
          ).length,
          reserved: nextUnits.filter(
            (unit: StockUnit) => unit.status === 'RESERVED'
          ).length,
          quarantine: nextUnits.filter((unit: StockUnit) =>
            ['QUARANTINED', 'QUARANTINE', 'DISCREPANCY'].includes(unit.status)
          ).length,
          total: data.total ?? pagination.total ?? nextUnits.length
        }
      );
    } catch (error) {
      if (currentRequest === requestId.current) {
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить склад'
        );
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, projectId, search, status]);

  useEffect(() => void load(), [load]);

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <Heading
        title='Склад маркированных товаров'
        description='Каждая строка — конкретная физическая упаковка с собственным Data Matrix'
      />
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='stock' />

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <Metric icon={Boxes} label='Всего упаковок' value={summary.total} />
        <Metric
          icon={PackageCheck}
          label='Доступно'
          value={summary.available}
        />
        <Metric icon={Boxes} label='В резерве' value={summary.reserved} />
        <Metric
          icon={ShieldAlert}
          label='Карантин'
          value={summary.quarantine}
          warning={summary.quarantine > 0}
        />
      </div>

      <Card>
        <CardHeader className='gap-4'>
          <div>
            <CardTitle>Реестр упаковок</CardTitle>
            <CardDescription className='mt-1'>
              Здесь видно происхождение и текущее состояние каждой упаковки: от
              приёмки до резерва, продажи или списания.
            </CardDescription>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                className='pl-9'
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder='Товар, SKU, GTIN или серийный номер'
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className='w-full sm:w-56'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>Все состояния</SelectItem>
                <SelectItem value='AVAILABLE'>Доступные</SelectItem>
                <SelectItem value='RESERVED'>В резерве</SelectItem>
                <SelectItem value='QUARANTINED'>Карантин</SelectItem>
                <SelectItem value='SOLD'>Проданные</SelectItem>
                <SelectItem value='RETURNED'>Возвращённые</SelectItem>
                <SelectItem value='WRITTEN_OFF'>Списанные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className='px-0'>
          {loading ? (
            <div className='space-y-3 px-6 py-3'>
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className='h-14 w-full' />
              ))}
            </div>
          ) : units.length === 0 ? (
            <div className='flex flex-col items-center px-6 py-16 text-center'>
              <Boxes className='text-muted-foreground/60 mb-4 h-10 w-10' />
              <div className='font-medium'>
                {search || status !== 'ALL'
                  ? 'Упаковки не найдены'
                  : 'Склад пока пуст'}
              </div>
              <p className='text-muted-foreground mt-1 max-w-lg text-sm'>
                {search || status !== 'ALL'
                  ? 'Измените запрос или выберите другое состояние.'
                  : 'Завершите первую приёмку — принятые Data Matrix появятся в этом реестре.'}
              </p>
              {!search && status === 'ALL' && (
                <Button className='mt-4' asChild>
                  <Link href={`/dashboard/projects/${projectId}/receipts`}>
                    Перейти к приёмкам
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='pl-6'>Товар</TableHead>
                      <TableHead>GTIN / код</TableHead>
                      <TableHead>Состояние</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead>Связанный заказ</TableHead>
                      <TableHead className='pr-6'>Поступила</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((unit) => (
                      <StockRow
                        key={unit.id}
                        unit={unit}
                        projectId={projectId}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className='flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='text-muted-foreground text-sm'>
                  Показано {units.length} из {total}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    <ChevronLeft /> Назад
                  </Button>
                  <span className='min-w-20 text-center text-sm'>
                    {page} из {totalPages}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Далее <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StockRow({ unit, projectId }: { unit: StockUnit; projectId: string }) {
  const warning = ['QUARANTINED', 'QUARANTINE', 'DISCREPANCY'].includes(
    unit.status
  );
  const sourceNumber =
    unit.receipt?.number || unit.receipt?.documentNumber || 'Приёмка';
  return (
    <TableRow>
      <TableCell className='max-w-sm pl-6'>
        <div className='truncate font-medium'>
          {unit.product?.name || 'Товар не сопоставлен'}
        </div>
        {unit.product?.sku && (
          <div className='text-muted-foreground text-xs'>
            SKU {unit.product.sku}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className='font-mono text-xs'>{unit.gtin || '—'}</div>
        <div className='text-muted-foreground mt-1 font-mono text-xs'>
          {unit.maskedCode || maskCode(unit.code, unit.serial)}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={warning ? 'destructive' : 'secondary'}>
          {unitStatusLabel(unit.status)}
        </Badge>
        {unit.quarantineReason && (
          <div className='mt-1 flex max-w-52 gap-1 text-xs text-amber-700'>
            <AlertTriangle className='h-3 w-3 shrink-0' />
            <span className='line-clamp-2'>{unit.quarantineReason}</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        {unit.receipt ? (
          <Button variant='link' className='h-auto p-0' asChild>
            <Link
              href={`/dashboard/projects/${projectId}/receipts/${unit.receipt.id}`}
            >
              {sourceNumber}
            </Link>
          </Button>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        {unit.order ? (
          <Button variant='link' className='h-auto p-0' asChild>
            <Link
              href={`/dashboard/projects/${projectId}/orders/${unit.order.id}`}
            >
              {unit.order.orderNumber || `№ ${unit.order.id.slice(-8)}`}
            </Link>
          </Button>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-muted-foreground pr-6 text-sm'>
        {formatReceivingDate(unit.receivedAt || unit.createdAt)}
      </TableCell>
    </TableRow>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  warning
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <Card className={warning ? 'border-amber-300/70' : undefined}>
      <CardHeader className='pb-3'>
        <CardDescription className='flex items-center gap-2'>
          <Icon className='h-4 w-4' /> {label}
        </CardDescription>
        <CardTitle className='text-3xl tabular-nums'>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function maskCode(code?: string | null, serial?: string | null): string {
  if (serial) return `Серийный № …${serial.slice(-6)}`;
  if (!code) return 'Код скрыт';
  if (code.length < 12) return 'Код скрыт';
  return `${code.slice(0, 6)}…${code.slice(-4)}`;
}
