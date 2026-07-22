'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, PackageCheck, ScanLine, Search } from 'lucide-react';
import { toast } from 'sonner';
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
import { MarkingWorkspaceNav } from '@/features/marking/components/marking-workspace-nav';
import type { OrderWithRelations } from '@/types/orders';
import { OrdersTable } from './orders-table';

interface Summary {
  total: number;
  needsAttention: number;
  awaitingScanning: number;
  readyToShip: number;
}

const EMPTY_SUMMARY: Summary = {
  total: 0,
  needsAttention: 0,
  awaitingScanning: 0,
  readyToShip: 0
};

export function OrdersPageView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const requestId = useRef(0);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [attentionOnly, setAttentionOnly] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchOrders = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);
      if (attentionOnly) params.set('attention', 'true');
      const response = await fetch(
        `/api/projects/${projectId}/orders?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось загрузить заказы');
      if (currentRequest !== requestId.current) return;
      setOrders(data.orders ?? []);
      setTotalCount(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch (error) {
      if (currentRequest === requestId.current) {
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить заказы'
        );
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [attentionOnly, page, projectId, search, status]);

  useEffect(() => void fetchOrders(), [fetchOrders]);

  return (
    <div className='space-y-6'>
      <Heading
        title='Заказы'
        description='Контролируйте оплату, сканирование Data Matrix, чеки и готовность к отгрузке'
      />
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='orders' />

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard label='Всего заказов' value={summary.total} />
        <SummaryCard
          label='Требуют внимания'
          value={summary.needsAttention}
          icon={AlertTriangle}
          active={attentionOnly}
          warning
          onClick={() => {
            setAttentionOnly((current) => !current);
            setPage(1);
          }}
        />
        <SummaryCard
          label='Ждут сканирования'
          value={summary.awaitingScanning}
          icon={ScanLine}
        />
        <SummaryCard
          label='Готовы к отгрузке'
          value={summary.readyToShip}
          icon={PackageCheck}
        />
      </div>

      <Card>
        <CardHeader className='gap-4'>
          <div>
            <CardTitle>Очередь заказов</CardTitle>
            <CardDescription>
              Сначала устраняйте красные статусы, затем сканируйте упаковки и
              регистрируйте чек.
            </CardDescription>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                value={searchInput}
                className='pl-9'
                placeholder='Номер заказа, покупатель, телефон или адрес'
                onChange={(event) => setSearchInput(event.target.value)}
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
                <SelectItem value='all'>Все бизнес-статусы</SelectItem>
                <SelectItem value='PENDING'>Ожидают подтверждения</SelectItem>
                <SelectItem value='CONFIRMED'>Подтверждённые</SelectItem>
                <SelectItem value='PROCESSING'>В обработке</SelectItem>
                <SelectItem value='SHIPPED'>Отправленные</SelectItem>
                <SelectItem value='DELIVERED'>Доставленные</SelectItem>
                <SelectItem value='CANCELLED'>Отменённые</SelectItem>
                <SelectItem value='REFUNDED'>Возвраты</SelectItem>
              </SelectContent>
            </Select>
            {(attentionOnly || search || status !== 'all') && (
              <Button
                variant='ghost'
                onClick={() => {
                  setAttentionOnly(false);
                  setSearchInput('');
                  setSearch('');
                  setStatus('all');
                  setPage(1);
                }}
              >
                Сбросить
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='px-0'>
          <OrdersTable
            data={orders}
            loading={loading}
            totalCount={totalCount}
            currentPage={page}
            pageSize={20}
            totalPages={totalPages}
            onPageChange={setPage}
            onOrderClick={(order) =>
              router.push(`/dashboard/projects/${projectId}/orders/${order.id}`)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  warning,
  active,
  onClick
}: {
  label: string;
  value: number;
  icon?: typeof AlertTriangle;
  warning?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`${warning && value ? 'border-amber-300' : ''} ${
        onClick ? 'hover:bg-muted/40 cursor-pointer transition-colors' : ''
      } ${active ? 'ring-primary ring-2' : ''}`}
      onClick={onClick}
    >
      <CardHeader className='pb-3'>
        <CardDescription className='flex items-center gap-2'>
          {Icon && <Icon className='h-4 w-4' />} {label}
        </CardDescription>
        <CardTitle className='text-3xl tabular-nums'>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
