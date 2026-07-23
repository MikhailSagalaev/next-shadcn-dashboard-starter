'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PackageCheck,
  ScanLine,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  type ReceivingRecord,
  type ReceivingUnit,
  formatReceivingDate,
  receiptTitle,
  receivingStatusLabel,
  unitStatusLabel
} from './receiving-types';

export function ReceiptDetailView({
  projectId,
  receiptId
}: {
  projectId: string;
  receiptId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<ReceivingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [documentConfirmed, setDocumentConfirmed] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/receipts/${receiptId}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось загрузить приёмку');
      setReceipt(data.receipt ?? data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить приёмку'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, receiptId]);

  useEffect(() => void load(), [load]);

  const units = useMemo(
    () =>
      receipt?.units ??
      receipt?.items?.flatMap((item) =>
        (item.units ?? []).map((unit) => ({
          ...unit,
          product:
            unit.product ??
            ({
              id: item.id,
              name: item.name,
              gtin: item.gtin
            } as ReceivingUnit['product'])
        }))
      ) ??
      [],
    [receipt]
  );
  const scanned = receipt?.scannedUnits ?? units.length;
  const expected =
    receipt?.expectedUnits ??
    receipt?.items?.reduce((sum, item) => sum + item.expectedQuantity, 0) ??
    0;
  const quarantined =
    receipt?.quarantinedUnits ??
    units.filter((unit) =>
      ['QUARANTINED', 'QUARANTINE', 'DISCREPANCY'].includes(unit.status ?? '')
    ).length;
  const completed =
    receipt?.status === 'ACCEPTED' || receipt?.status === 'COMPLETED';
  const progress = expected ? Math.min(100, (scanned / expected) * 100) : 0;
  const canAccept = !completed && scanned > 0 && quarantined === 0;

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    const normalized = code.trim();
    if (!normalized) return;
    setScanning(true);
    setScanError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/receipts/${receiptId}/scan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: normalized })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            'Код не принят. Проверьте упаковку и повторите сканирование.'
        );
      }
      if (data.receipt) setReceipt(data.receipt);
      setCode('');
      toast.success(
        data.quarantined
          ? 'Код помещён в карантин'
          : 'Упаковка добавлена в приёмку'
      );
      if (!data.receipt) await load();
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось принять код';
      setScanError(message);
      toast.error(message);
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    } finally {
      setScanning(false);
    }
  }

  async function accept() {
    setAccepting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/receipts/${receiptId}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentConfirmed })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось завершить приёмку');
      await load();
      toast.success(
        documentConfirmed
          ? 'Приёмка завершена, упаковки доступны на складе'
          : 'Сверка завершена. Приёмка ожидает подтверждения УПД'
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось завершить приёмку'
      );
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-16 w-full' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-80 w-full' />
      </div>
    );
  }

  if (!receipt) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center py-16 text-center'>
          <ShieldAlert className='text-muted-foreground mb-3 h-10 w-10' />
          <div className='font-medium'>Приёмка не найдена</div>
          <Button className='mt-4' variant='outline' asChild>
            <Link href={`/dashboard/projects/${projectId}/receipts`}>
              Вернуться к приёмкам
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div>
        <Button variant='ghost' size='sm' className='mb-3 -ml-3' asChild>
          <Link href={`/dashboard/projects/${projectId}/receipts`}>
            <ArrowLeft /> Все приёмки
          </Link>
        </Button>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <Heading
            title={`Приёмка ${receiptTitle(receipt)}`}
            description={`${receipt.supplierName || 'Поставщик не указан'} · создана ${formatReceivingDate(receipt.createdAt)}`}
          />
          <Badge variant={completed ? 'secondary' : 'outline'}>
            {receivingStatusLabel(receipt.status)}
          </Badge>
        </div>
      </div>
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='receipts' />

      <div className='grid gap-4 sm:grid-cols-3'>
        <Metric
          label='Отсканировано'
          value={scanned}
          suffix={expected || null}
        />
        <Metric
          label='В карантине'
          value={quarantined}
          warning={quarantined > 0}
        />
        <Metric
          label='Доступно после приёмки'
          value={Math.max(0, scanned - quarantined)}
        />
      </div>

      {!completed && (
        <Card>
          <CardHeader className='gap-3 md:flex-row md:items-start md:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <ScanLine className='h-5 w-5' /> Сканирование упаковок
              </CardTitle>
              <CardDescription className='mt-1'>
                Сканируйте полный Data Matrix. Один код соответствует одной
                физической упаковке.
              </CardDescription>
            </div>
            <div className='flex flex-col items-stretch gap-3'>
              <label className='flex max-w-sm cursor-pointer items-start gap-2 text-sm'>
                <Checkbox
                  checked={documentConfirmed}
                  onCheckedChange={(checked) =>
                    setDocumentConfirmed(checked === true)
                  }
                />
                <span>
                  УПД подписан, переход товара от поставщика подтверждён
                </span>
              </label>
              <Button
                disabled={!canAccept || accepting}
                onClick={accept}
                className='shrink-0'
              >
                {accepting ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <PackageCheck />
                )}
                {documentConfirmed ? 'Принять на склад' : 'Завершить сверку'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {expected > 0 && (
              <div>
                <div className='mb-2 flex justify-between text-sm'>
                  <span>Сверка с документом</span>
                  <span className='tabular-nums'>
                    {scanned} из {expected}
                  </span>
                </div>
                <Progress value={progress} />
              </div>
            )}
            <form
              onSubmit={scan}
              className='grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]'
            >
              <div className='space-y-2'>
                <Label htmlFor='receiving-code'>Data Matrix с упаковки</Label>
                <Input
                  ref={inputRef}
                  id='receiving-code'
                  autoFocus
                  autoComplete='off'
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setScanError(null);
                  }}
                  placeholder='Нажмите сюда и отсканируйте код'
                  aria-invalid={Boolean(scanError)}
                />
                <p className='text-muted-foreground text-xs'>
                  Сканер должен работать в режиме клавиатуры и завершать ввод
                  клавишей Enter.
                </p>
              </div>
              <Button
                type='submit'
                className='md:mt-7'
                disabled={scanning || !code.trim()}
              >
                {scanning ? <Loader2 className='animate-spin' /> : <ScanLine />}
                Добавить
              </Button>
            </form>
            {scanError && (
              <Alert variant='destructive'>
                <AlertTriangle />
                <AlertTitle>Код не принят</AlertTitle>
                <AlertDescription>{scanError}</AlertDescription>
              </Alert>
            )}
            {quarantined > 0 && (
              <Alert>
                <AlertTriangle />
                <AlertTitle>Есть упаковки в карантине</AlertTitle>
                <AlertDescription>
                  Проверьте расхождения с УПД. Завершение приёмки недоступно,
                  пока карантин не разобран.
                </AlertDescription>
              </Alert>
            )}
            {!documentConfirmed && quarantined === 0 && scanned > 0 && (
              <Alert>
                <ShieldAlert />
                <AlertTitle>Без подписи товар ещё недоступен</AlertTitle>
                <AlertDescription>
                  Можно завершить фактическую сверку, но упаковки останутся в
                  ожидании. Они станут доступными для заказов только после
                  подтверждения УПД.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {completed && (
        <Alert className='border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'>
          <CheckCircle2 className='text-emerald-700' />
          <AlertTitle>Приёмка завершена</AlertTitle>
          <AlertDescription>
            Принятые упаковки добавлены в складской реестр и доступны для
            резерва заказами.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Фактически полученные упаковки</CardTitle>
          <CardDescription>
            Код отображается частично: полный Data Matrix хранится защищённо и
            не должен копироваться вручную.
          </CardDescription>
        </CardHeader>
        <CardContent className='px-0'>
          {units.length === 0 ? (
            <div className='text-muted-foreground px-6 py-12 text-center text-sm'>
              Пока ничего не отсканировано
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='pl-6'>Товар</TableHead>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Код</TableHead>
                    <TableHead>Состояние</TableHead>
                    <TableHead className='pr-6'>Причина</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <UnitRow key={unit.id} unit={unit} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UnitRow({ unit }: { unit: ReceivingUnit }) {
  const warning = ['QUARANTINED', 'QUARANTINE', 'DISCREPANCY'].includes(
    unit.status ?? ''
  );
  return (
    <TableRow>
      <TableCell className='max-w-sm pl-6'>
        <div className='truncate font-medium'>
          {unit.product?.name || unit.productName || 'Товар не сопоставлен'}
        </div>
        {unit.product?.sku && (
          <div className='text-muted-foreground text-xs'>
            SKU {unit.product.sku}
          </div>
        )}
      </TableCell>
      <TableCell className='font-mono text-xs'>
        {unit.gtin || unit.product?.gtin || '—'}
      </TableCell>
      <TableCell className='font-mono text-xs'>
        {unit.maskedCode || maskCode(unit.code)}
      </TableCell>
      <TableCell>
        <Badge variant={warning ? 'destructive' : 'secondary'}>
          {unitStatusLabel(unit.status)}
        </Badge>
      </TableCell>
      <TableCell className='text-muted-foreground max-w-xs pr-6 text-sm'>
        {unit.discrepancy || '—'}
      </TableCell>
    </TableRow>
  );
}

function Metric({
  label,
  value,
  suffix,
  warning
}: {
  label: string;
  value: number;
  suffix?: number | null;
  warning?: boolean;
}) {
  return (
    <Card className={warning ? 'border-amber-300/70' : undefined}>
      <CardHeader className='pb-3'>
        <CardDescription>{label}</CardDescription>
        <CardTitle className='text-3xl tabular-nums'>
          {value}
          {suffix ? (
            <span className='text-muted-foreground text-base font-normal'>
              {' '}
              из {suffix}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function maskCode(code?: string | null) {
  if (!code) return '—';
  if (code.length < 12) return '••••••';
  return `${code.slice(0, 6)}…${code.slice(-4)}`;
}
