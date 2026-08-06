'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { ManualComplianceConfirmDialog } from '@/features/marking/components/manual-compliance-confirm-dialog';
import {
  type ReceivingRecord,
  type ReceivingUnit,
  formatReceivingDate,
  receiptTitle,
  receivingStatusLabel,
  unitStatusLabel
} from './receiving-types';
import { Textarea } from '@/components/ui/textarea';

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
  const updDocument = receipt?.complianceDocuments?.find(
    (document) => document.kind === 'UPD_RECEIPT'
  );
  const updConfirmed = updDocument?.status === 'SUCCEEDED';

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
          body: JSON.stringify({})
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось завершить приёмку');
      await load();
      toast.success(
        updConfirmed
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
          <CardHeader className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,32rem)]'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <ScanLine className='h-5 w-5' /> Сканирование упаковок
              </CardTitle>
              <CardDescription className='mt-1'>
                Сканируйте полный Data Matrix. Один код соответствует одной
                физической упаковке.
              </CardDescription>
            </div>
            <div className='flex min-w-0 flex-col items-stretch gap-3'>
              {updDocument?.status === 'READY_TO_SIGN' ? (
                <ManualComplianceConfirmDialog
                  projectId={projectId}
                  documentId={updDocument.id}
                  documentNumber={updDocument.documentNumber}
                  triggerLabel='Подтвердить принятый УПД'
                  onConfirmed={load}
                />
              ) : (
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
                  {updConfirmed ? 'Принять на склад' : 'Завершить сверку'}
                </Button>
              )}
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
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <Label htmlFor='receiving-code'>Data Matrix с упаковки</Label>
                  <ReceiptCodeDiagnostic
                    projectId={projectId}
                    receiptId={receiptId}
                    expectedGtin={
                      receipt.items?.find((item) => item.gtin)?.gtin
                    }
                  />
                </div>
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
            {!updConfirmed && quarantined === 0 && scanned > 0 && (
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

      {receipt.discrepancies?.length ? (
        <DiscrepanciesCard
          projectId={projectId}
          receiptId={receiptId}
          discrepancies={receipt.discrepancies}
          onChanged={load}
        />
      ) : null}

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

function ReceiptCodeDiagnostic({
  projectId,
  receiptId,
  expectedGtin
}: {
  projectId: string;
  receiptId: string;
  expectedGtin?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    gtin: string;
    serial: string;
    productName: string;
    rawLength: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const example =
    expectedGtin && /^\d{8,14}$/.test(expectedGtin)
      ? `(01)${expectedGtin.padStart(14, '0')}(21)TEST${Date.now().toString(36).toUpperCase()}`
      : '';

  async function validate() {
    if (!value.trim()) return;
    setTesting(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/receipts/${receiptId}/scan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: value.trim(), validateOnly: true })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Код не удалось распознать');
      setResult(data.validation);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Код не удалось распознать'
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='outline' size='sm'>
          <CircleHelp /> Проверить без сканера
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Проверка Data Matrix без сканера</DialogTitle>
          <DialogDescription>
            Сканер только вводит символы как клавиатура. Здесь можно вставить
            полный код вручную или проверить учебный пример. Проверка ничего не
            добавляет в приёмку и не меняет склад.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <Alert>
            <CircleHelp />
            <AlertTitle>Почему случайные цифры не подходят</AlertTitle>
            <AlertDescription>
              Полный GS1 Data Matrix содержит как минимум идентификатор товара
              <code className='mx-1'>(01)</code>с 14 цифрами GTIN и серийный
              номер
              <code className='mx-1'>(21)</code>. Обычный штрихкод содержит
              только GTIN и не идентифицирует конкретную упаковку.
            </AlertDescription>
          </Alert>
          <div className='space-y-2'>
            <Label htmlFor='receipt-code-test'>
              Код для безопасной проверки
            </Label>
            <Input
              id='receipt-code-test'
              className='font-mono'
              value={value}
              autoFocus
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
                setResult(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void validate();
                }
              }}
              placeholder='Например: (01)04601234567890(21)ABC123'
            />
          </div>
          {example && (
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                setValue(example);
                setError(null);
                setResult(null);
              }}
            >
              Подставить учебный код для GTIN {expectedGtin}
            </Button>
          )}
          {result && (
            <Alert className='border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'>
              <CheckCircle2 className='text-emerald-700' />
              <AlertTitle>Формат распознан, товар совпадает</AlertTitle>
              <AlertDescription>
                {result.productName}: GTIN {result.gtin}, серийный номер{' '}
                {result.serial}. Код не сохранён.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant='destructive'>
              <AlertTriangle />
              <AlertTitle>Проверка не пройдена</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => setOpen(false)}
          >
            Закрыть
          </Button>
          <Button
            type='button'
            disabled={!value.trim() || testing}
            onClick={() => void validate()}
          >
            {testing ? <Loader2 className='animate-spin' /> : <ScanLine />}
            Проверить, не сохраняя
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscrepanciesCard({
  projectId,
  receiptId,
  discrepancies,
  onChanged
}: {
  projectId: string;
  receiptId: string;
  discrepancies: NonNullable<ReceivingRecord['discrepancies']>;
  onChanged: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('CORRECTED_DOCUMENT');
  const [comment, setComment] = useState('');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState<
    Array<{ id: string; name: string; gtin?: string | null }>
  >([]);
  const [saving, setSaving] = useState(false);
  const active = discrepancies.find((item) => item.id === activeId);
  const openItems = discrepancies.filter((item) => !item.resolvedAt);

  useEffect(() => {
    if (!active?.markedUnit?.gtin) return;
    void fetch(
      `/api/projects/${projectId}/products?search=${encodeURIComponent(active.markedUnit.gtin)}`
    )
      .then((response) => response.json())
      .then((data) => {
        const matched = (data.products ?? []).filter(
          (product: { gtin?: string | null }) =>
            product.gtin === active.markedUnit?.gtin
        );
        setProducts(matched);
        if (matched.length === 1) setProductId(matched[0].id);
      })
      .catch(() => setProducts([]));
  }, [active?.markedUnit?.gtin, projectId]);

  async function resolve() {
    if (!activeId) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/receipts/${receiptId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discrepancyId: activeId,
            resolution,
            comment: comment.trim() || undefined,
            productId: productId || undefined
          })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось разобрать расхождение');
      toast.success('Решение сохранено');
      setActiveId(null);
      setComment('');
      setProductId('');
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить решение'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={openItems.length ? 'border-amber-300/70' : undefined}>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5' /> Расхождения и карантин
        </CardTitle>
        <CardDescription>
          Открыто {openItems.length} из {discrepancies.length}. Каждое
          расхождение требует явного решения и сохраняется в журнале.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {discrepancies.map((item) => (
          <div
            key={item.id}
            className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between'
          >
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={item.resolvedAt ? 'secondary' : 'destructive'}>
                  {item.resolvedAt ? 'Разобрано' : 'Требует решения'}
                </Badge>
                <span className='text-muted-foreground text-xs'>
                  {item.type || 'Расхождение'}
                </span>
              </div>
              <div className='mt-2 text-sm'>{item.message}</div>
              {item.markedUnit && (
                <div className='text-muted-foreground mt-1 font-mono text-xs'>
                  GTIN {item.markedUnit.gtin}
                  {item.markedUnit.serial
                    ? ` · серийный № …${item.markedUnit.serial.slice(-6)}`
                    : ''}
                </div>
              )}
              {item.resolutionComment && (
                <div className='text-muted-foreground mt-2 text-xs'>
                  Решение: {item.resolutionComment}
                </div>
              )}
            </div>
            {!item.resolvedAt && (
              <Button
                variant='outline'
                onClick={() => {
                  setActiveId(item.id);
                  setResolution('CORRECTED_DOCUMENT');
                  setComment('');
                  setProductId(item.markedUnit?.productId ?? '');
                }}
              >
                Разобрать
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog
        open={Boolean(activeId)}
        onOpenChange={(open) => !open && setActiveId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Решение по расхождению</DialogTitle>
            <DialogDescription>
              Упаковка останется недоступной, пока выбранное действие не будет
              выполнено полностью.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Действие</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='CORRECTED_DOCUMENT'>
                    УПД исправлен — принять
                  </SelectItem>
                  <SelectItem value='RETURN_TO_SUPPLIER'>
                    Вернуть поставщику
                  </SelectItem>
                  <SelectItem value='WRITE_OFF'>Передать в списание</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {['CORRECTED_DOCUMENT', 'ACCEPTED'].includes(resolution) &&
              active?.markedUnit &&
              !active.markedUnit.productId && (
                <div className='space-y-2'>
                  <Label>Товар каталога с таким GTIN</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder='Выберите товар' />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} · {product.gtin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!products.length && (
                    <p className='text-destructive text-xs'>
                      В каталоге нет товара с GTIN {active.markedUnit.gtin}.
                      Сначала настройте каталог.
                    </p>
                  )}
                </div>
              )}
            <div className='space-y-2'>
              <Label>Комментарий</Label>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder='Основание решения или номер исправленного документа'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setActiveId(null)}>
              Отмена
            </Button>
            <Button
              disabled={
                saving ||
                (resolution === 'CORRECTED_DOCUMENT' &&
                  Boolean(active?.markedUnit) &&
                  !active?.markedUnit?.productId &&
                  !productId)
              }
              onClick={() => void resolve()}
            >
              {saving ? <Loader2 className='animate-spin' /> : <PackageCheck />}
              Подтвердить решение
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
