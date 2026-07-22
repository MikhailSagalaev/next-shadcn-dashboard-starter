'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Focus,
  Loader2,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Trash2
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
import {
  FISCAL_STATE_LABELS,
  MARKING_STATE_LABELS,
  RECEIPT_STATUS_LABELS,
  friendlyFiscalError
} from './order-workflow-ui';

interface MarkedUnitView {
  id: string;
  gtin: string;
  serial: string | null;
  status: string;
}

interface MarkingItemView {
  id: string;
  name: string;
  quantity: number;
  gtin: string | null;
  vatCode: number | null;
  markingStatus: string;
  markedUnits?: MarkedUnitView[];
}

interface MarkingOrderView {
  markingState: string;
  fiscalState: string;
  paymentStatus: string;
  providerPaymentId: string | null;
  items: MarkingItemView[];
  fiscalReceipts?: Array<{
    id: string;
    type: string;
    status: string;
    lastError: string | null;
  }>;
}

export function OrderMarkingCard({
  projectId,
  orderId,
  order,
  onChanged
}: {
  projectId: string;
  orderId: string;
  order: MarkingOrderView;
  onChanged: () => Promise<void>;
}) {
  const required = useMemo(
    () =>
      order.items.filter((item) => item.markingStatus === 'MARKED_REQUIRED'),
    [order.items]
  );
  const unconfigured = order.items.filter(
    (item) =>
      item.markingStatus === 'UNKNOWN' ||
      !item.vatCode ||
      (item.markingStatus === 'MARKED_REQUIRED' && !item.gtin)
  );
  const firstIncomplete = required.find(
    (item) => (item.markedUnits?.length ?? 0) < item.quantity
  );
  const [itemId, setItemId] = useState(
    firstIncomplete?.id ?? required[0]?.id ?? ''
  );
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (firstIncomplete?.id) setItemId(firstIncomplete.id);
  }, [firstIncomplete?.id]);

  const selectedItem = required.find((item) => item.id === itemId);
  const expected = required.reduce((sum, item) => sum + item.quantity, 0);
  const scanned = required.reduce(
    (sum, item) => sum + (item.markedUnits?.length ?? 0),
    0
  );
  const progress = expected ? Math.round((scanned / expected) * 100) : 100;
  const settlement = order.fiscalReceipts?.find(
    (receipt) => receipt.type === 'SETTLEMENT'
  );

  async function scan() {
    if (!itemId || !code || busy) return;
    setBusy(true);
    setScanError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/marking`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderItemId: itemId, code })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Код не принят');
      setCode('');
      toast.success('Data Matrix добавлен');
      await onChanged();
      inputRef.current?.focus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ошибка сканирования';
      setScanError(message);
      toast.error(message);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(unitId: string) {
    const response = await fetch(
      `/api/projects/${projectId}/orders/${orderId}/marking?unitId=${encodeURIComponent(unitId)}`,
      { method: 'DELETE' }
    );
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || 'Код нельзя удалить');
    toast.success('Скан удалён');
    await onChanged();
  }

  async function syncCatalog() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/catalog-sync`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось обновить заказ');
      toast.success(`Обновлено позиций: ${data.updated}`);
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось обновить заказ'
      );
    } finally {
      setBusy(false);
    }
  }

  async function fiscalize() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/fiscalize`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Чек не поставлен в очередь');
      toast.success(
        settlement?.status === 'FAILED'
          ? 'Повторная отправка чека запущена'
          : 'Чек поставлен в очередь'
      );
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Ошибка формирования чека'
      );
    } finally {
      setBusy(false);
    }
  }

  const receiptLocked =
    settlement &&
    ['NEW', 'PENDING', 'SUCCEEDED', 'CANCELED'].includes(settlement.status);

  return (
    <Card className='border-primary/30'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Barcode className='h-5 w-5' /> Сборка и маркировка
            </CardTitle>
            <CardDescription className='mt-1'>
              Следующее действие зависит от готовности каталога, количества
              отсканированных упаковок и статуса чека.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge
              variant={
                ['UNCONFIGURED', 'FAILED'].includes(order.markingState)
                  ? 'destructive'
                  : 'outline'
              }
            >
              {MARKING_STATE_LABELS[order.markingState] || order.markingState}
            </Badge>
            <Badge
              variant={
                order.fiscalState === 'FAILED' ? 'destructive' : 'outline'
              }
            >
              {FISCAL_STATE_LABELS[order.fiscalState] || order.fiscalState}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>
        {order.markingState === 'UNCONFIGURED' && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>Сначала настройте товары</AlertTitle>
            <AlertDescription>
              <p>
                В заказе отсутствуют GTIN, НДС или решение о маркировке для
                следующих позиций:
              </p>
              <ul className='list-disc pl-5'>
                {unconfigured.map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ul>
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button size='sm' variant='outline' asChild>
                  <Link href={`/dashboard/projects/${projectId}/products`}>
                    <ExternalLink /> Открыть каталог
                  </Link>
                </Button>
                <Button
                  size='sm'
                  disabled={busy}
                  onClick={() => void syncCatalog()}
                >
                  {busy ? <Loader2 className='animate-spin' /> : <RefreshCw />}
                  Обновить заказ из каталога
                </Button>
              </div>
              <p className='mt-2 text-xs'>
                Сначала исправьте каталог, затем нажмите «Обновить заказ из
                каталога». Уже созданный заказ хранит собственный снимок
                реквизитов и не меняется автоматически.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {required.length > 0 && order.markingState !== 'UNCONFIGURED' && (
          <>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='font-medium'>Прогресс комплектации</span>
                <span className='tabular-nums'>
                  {scanned} из {expected} упаковок
                </span>
              </div>
              <Progress value={progress} />
            </div>

            {scanned < expected && (
              <div className='bg-muted/20 rounded-xl border p-4'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <div className='font-medium'>Сканирование упаковок</div>
                    <div className='text-muted-foreground text-sm'>
                      Подключите 2D-сканер в режиме клавиатуры. Один Data Matrix
                      соответствует одной физической упаковке.
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <ScannerHelp />
                    <ScannerDiagnostic
                      projectId={projectId}
                      orderId={orderId}
                      itemId={itemId}
                      productName={selectedItem?.name}
                      expectedGtin={selectedItem?.gtin}
                    />
                  </div>
                </div>
                <div className='grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(20rem,2fr)_auto]'>
                  <Select
                    value={itemId}
                    onValueChange={(value) => {
                      setItemId(value);
                      setScanError(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Выберите товар' />
                    </SelectTrigger>
                    <SelectContent>
                      {required.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.markedUnits?.length ?? 0}/
                          {item.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className='space-y-1'>
                    <Input
                      ref={inputRef}
                      value={code}
                      className={scanError ? 'border-destructive' : undefined}
                      placeholder='Нажмите сюда и отсканируйте Data Matrix'
                      disabled={busy}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setScanError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void scan();
                        }
                      }}
                    />
                    <div className='text-muted-foreground text-xs'>
                      Ожидаемый GTIN: {selectedItem?.gtin || 'не настроен'} ·
                      сканер должен завершать ввод клавишей Enter
                    </div>
                  </div>
                  <Button disabled={!code || busy} onClick={() => void scan()}>
                    {busy ? <Loader2 className='animate-spin' /> : <ScanLine />}
                    Добавить
                  </Button>
                </div>
                {scanError && (
                  <div className='text-destructive mt-3 flex items-start gap-2 text-sm'>
                    <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                    <div>
                      <div className='font-medium'>Код не принят</div>
                      <div>{scanError}</div>
                      <div className='mt-1 text-xs'>
                        Код оставлен в поле. Исправьте выбор товара или
                        повторите сканирование.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className='grid gap-3 md:grid-cols-2'>
              {required.map((item) => (
                <div key={item.id} className='rounded-lg border p-4'>
                  <div className='flex justify-between gap-3'>
                    <div>
                      <div className='font-medium'>{item.name}</div>
                      <div className='text-muted-foreground text-xs'>
                        GTIN {item.gtin || 'не настроен'}
                      </div>
                    </div>
                    <Badge variant='outline'>
                      {item.markedUnits?.length ?? 0}/{item.quantity}
                    </Badge>
                  </div>
                  <div className='mt-3 space-y-2'>
                    {item.markedUnits?.map((unit, index) => (
                      <div
                        key={unit.id}
                        className='bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm'
                      >
                        <span className='font-mono text-xs'>
                          {index + 1}. {unit.serial || unit.gtin}
                        </span>
                        <Button
                          variant='ghost'
                          size='icon'
                          aria-label='Удалить скан'
                          onClick={() => void remove(unit.id)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {['COMPLETE', 'NOT_REQUIRED'].includes(order.markingState) && (
          <div className='rounded-xl border p-4'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-start gap-3'>
                <CheckCircle2 className='mt-0.5 h-5 w-5 text-green-600' />
                <div>
                  <div className='font-medium'>Комплектация готова</div>
                  <div className='text-muted-foreground text-sm'>
                    {settlement
                      ? `Чек: ${RECEIPT_STATUS_LABELS[settlement.status] || settlement.status}`
                      : 'Теперь отправьте чек полного расчёта в ЮKassa.'}
                  </div>
                </div>
              </div>
              <Button
                disabled={busy || Boolean(receiptLocked)}
                onClick={() => void fiscalize()}
              >
                {busy ? (
                  <Loader2 className='animate-spin' />
                ) : settlement?.status === 'FAILED' ? (
                  <RefreshCw />
                ) : (
                  <ReceiptText />
                )}
                {settlement?.status === 'FAILED'
                  ? 'Повторить отправку'
                  : settlement
                    ? RECEIPT_STATUS_LABELS[settlement.status] ||
                      settlement.status
                    : 'Сформировать чек'}
              </Button>
            </div>
            {settlement?.status === 'CANCELED' && (
              <p className='text-destructive mt-3 text-sm'>
                ЮKassa окончательно отклонила этот чек. Исправьте причину и
                обратитесь в поддержку перед повторной попыткой.
              </p>
            )}
          </div>
        )}

        {settlement?.lastError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>Не удалось зарегистрировать чек</AlertTitle>
            <AlertDescription>
              <p>{friendlyFiscalError(settlement.lastError)}</p>
              <details className='mt-2'>
                <summary className='cursor-pointer'>
                  Технические подробности
                </summary>
                <pre className='bg-muted mt-2 max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap'>
                  {settlement.lastError}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ScannerHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <CircleHelp /> Как сканировать
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Как отсканировать Data Matrix</DialogTitle>
          <DialogDescription>
            Для постоянной работы используйте проводной или Bluetooth 2D-сканер
            в режиме клавиатуры.
          </DialogDescription>
        </DialogHeader>
        <ol className='space-y-3 text-sm'>
          <li>
            <b>1.</b> Подключите 2D-сканер и включите английскую раскладку.
          </li>
          <li>
            <b>2.</b> Выберите товар, нажмите поле сканирования.
          </li>
          <li>
            <b>3.</b> Наведите сканер на Data Matrix одной упаковки.
          </li>
          <li>
            <b>4.</b> Сканер введёт код и отправит Enter; позиция появится в
            списке.
          </li>
        </ol>
        <Alert>
          <Focus />
          <AlertDescription>
            Сканируйте отдельный код с каждой фактической упаковки. Обычный
            линейный сканер штрихкодов Data Matrix не прочитает.
          </AlertDescription>
        </Alert>
        <a
          href='https://markirovka.ru/knowledge/fast_start/start/proverka-skanera-data-matrix-instruktsiya'
          target='_blank'
          rel='noreferrer'
          className='text-primary inline-flex items-center text-sm hover:underline'
        >
          Официальная проверка сканера «Честного знака» ↗
        </a>
      </DialogContent>
    </Dialog>
  );
}

function ScannerDiagnostic({
  projectId,
  orderId,
  itemId,
  productName,
  expectedGtin
}: {
  projectId: string;
  orderId: string;
  itemId: string;
  productName?: string;
  expectedGtin?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [testing, setTesting] = useState(false);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<{
    gtin: string;
    serial: string;
    rawLength: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    if (!itemId || !value) return;
    setTesting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/marking`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderItemId: itemId,
            code: value,
            validateOnly: true
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Код не распознан');
      setResult(data.validation);
      setCount((current) => current + 1);
      setValue('');
    } catch (validationError) {
      setResult(null);
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Код не распознан'
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' disabled={!itemId}>
          <ScanLine /> Проверить сканер
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Диагностика 2D-сканера</DialogTitle>
          <DialogDescription>
            Код будет только проверен и не сохранится в заказе. Официальная
            рекомендация — сделать 20 последовательных считываний.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='rounded-lg border p-3 text-sm'>
            <div className='font-medium'>
              {productName || 'Товар не выбран'}
            </div>
            <div className='text-muted-foreground'>
              Ожидаемый GTIN: {expectedGtin || 'не настроен'}
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='scanner-test'>Поле диагностики</Label>
            <Input
              id='scanner-test'
              autoFocus
              value={value}
              placeholder='Отсканируйте Data Matrix и нажмите Enter'
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void validate();
                }
              }}
            />
          </div>
          <Progress value={Math.min(100, count * 5)} />
          <div className='text-muted-foreground text-sm'>
            Успешных считываний: {count} из 20
          </div>
          {result && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Сканер работает правильно</AlertTitle>
              <AlertDescription>
                GTIN {result.gtin}; серийный номер {result.serial}; длина строки{' '}
                {result.rawLength}. Ничего не сохранено.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant='destructive'>
              <AlertCircle />
              <AlertTitle>Проверка не пройдена</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Закрыть
          </Button>
          <Button disabled={!value || testing} onClick={() => void validate()}>
            {testing ? <Loader2 className='animate-spin' /> : <ScanLine />}
            Проверить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
