'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  PackageSearch,
  Search
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
import { CreateReceiptDialog } from './create-receipt-dialog';
import {
  type ReceivingRecord,
  formatReceivingDate,
  receiptTitle,
  receivingStatusLabel,
  receivingStatusTone
} from './receiving-types';

export function ReceivingPageView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(
        `/api/projects/${projectId}/receipts?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось загрузить приёмки');
      setReceipts(data.receipts ?? data.items ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить приёмки'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const active = receipts.filter((item) =>
    [
      'DRAFT',
      'CREATED',
      'IN_PROGRESS',
      'SCANNING',
      'READY',
      'ACCEPTANCE_PENDING'
    ].includes(item.status)
  ).length;
  const issues = receipts.filter(
    (item) =>
      (item.discrepancyCount ?? 0) > 0 ||
      ['DISCREPANCY', 'REVIEW'].includes(item.status)
  ).length;
  const accepted = receipts.filter((item) =>
    ['ACCEPTED', 'COMPLETED'].includes(item.status)
  ).length;

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Heading
          title='Приёмки'
          description='Сверяйте поставку с УПД и принимайте на склад каждую маркированную упаковку'
        />
        <CreateReceiptDialog
          projectId={projectId}
          onCreated={(id) =>
            id
              ? router.push(`/dashboard/projects/${projectId}/receipts/${id}`)
              : load()
          }
        />
      </div>
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='receipts' />

      <div className='grid gap-4 sm:grid-cols-3'>
        <MetricCard icon={PackageSearch} label='В работе' value={active} />
        <MetricCard
          icon={AlertTriangle}
          label='С расхождениями'
          value={issues}
          warning={issues > 0}
        />
        <MetricCard icon={CheckCircle2} label='Принято' value={accepted} />
      </div>

      <Card>
        <CardHeader className='gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <ClipboardCheck className='h-5 w-5' /> Журнал приёмок
            </CardTitle>
            <CardDescription className='mt-1'>
              Не завершайте документ, пока фактическое количество и все
              расхождения не проверены.
            </CardDescription>
          </div>
          <div className='relative w-full sm:w-80'>
            <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              className='pl-9'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Поставщик, УПД или номер'
            />
          </div>
        </CardHeader>
        <CardContent className='px-0'>
          {loading ? (
            <div className='space-y-3 px-6 py-3'>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className='h-14 w-full' />
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <div className='flex flex-col items-center px-6 py-16 text-center'>
              <ClipboardCheck className='text-muted-foreground/60 mb-4 h-10 w-10' />
              <div className='font-medium'>
                {search ? 'Приёмки не найдены' : 'Приёмок пока нет'}
              </div>
              <p className='text-muted-foreground mt-1 max-w-lg text-sm'>
                {search
                  ? 'Измените поисковый запрос.'
                  : 'Создайте приёмку по документу поставщика, затем отсканируйте Data Matrix с каждой упаковки.'}
              </p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='pl-6'>Документ</TableHead>
                    <TableHead>Поставщик</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Упаковки</TableHead>
                    <TableHead>Создана</TableHead>
                    <TableHead className='pr-6 text-right'>Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => {
                    const tone = receivingStatusTone(receipt.status);
                    const scanned =
                      receipt.scannedUnits ??
                      receipt.acceptedUnits ??
                      receipt.items?.reduce(
                        (sum, item) => sum + item.acceptedQuantity,
                        0
                      ) ??
                      0;
                    const expected =
                      receipt.expectedUnits ??
                      receipt.items?.reduce(
                        (sum, item) => sum + item.expectedQuantity,
                        0
                      );
                    return (
                      <TableRow
                        key={receipt.id}
                        className='cursor-pointer'
                        onClick={() =>
                          router.push(
                            `/dashboard/projects/${projectId}/receipts/${receipt.id}`
                          )
                        }
                      >
                        <TableCell className='pl-6 font-medium'>
                          {receiptTitle(receipt)}
                        </TableCell>
                        <TableCell>
                          <div>{receipt.supplierName || 'Не указан'}</div>
                          {receipt.supplierInn && (
                            <div className='text-muted-foreground text-xs'>
                              ИНН {receipt.supplierInn}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tone === 'danger'
                                ? 'destructive'
                                : tone === 'neutral'
                                  ? 'outline'
                                  : 'secondary'
                            }
                            className={
                              tone === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : tone === 'warning'
                                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                                  : undefined
                            }
                          >
                            {receivingStatusLabel(receipt.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className='tabular-nums'>
                            {scanned}
                            {expected != null ? ` из ${expected}` : ''}
                          </span>
                          {(receipt.quarantinedUnits ?? 0) > 0 && (
                            <div className='text-xs text-amber-700'>
                              {receipt.quarantinedUnits} в карантине
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatReceivingDate(receipt.createdAt)}
                        </TableCell>
                        <TableCell className='pr-6 text-right'>
                          <Button variant='ghost' size='sm'>
                            Открыть <ChevronRight />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  warning
}: {
  icon: typeof PackageSearch;
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
