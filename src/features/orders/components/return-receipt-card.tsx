'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ScanLine
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
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { OrderWithRelations } from '@/types/orders';
import {
  RECEIPT_STATUS_LABELS,
  friendlyFiscalError
} from './order-workflow-ui';

type RefundMode = 'FULL' | 'SELECTED';

export function ReturnReceiptCard({
  projectId,
  orderId,
  order,
  onChanged
}: {
  projectId: string;
  orderId: string;
  order: OrderWithRelations;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RefundMode>('FULL');
  const [reason, setReason] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [returnCode, setReturnCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const settlement = order.fiscalReceipts?.find(
    (receipt) => receipt.type === 'SETTLEMENT'
  );
  const refunds = (order.fiscalReceipts ?? []).filter(
    (receipt) => receipt.type === 'REFUND'
  );
  const activeRefund = refunds.find((receipt) =>
    ['NEW', 'PENDING'].includes(receipt.status)
  );
  const successfulRefunds = refunds.filter(
    (receipt) => receipt.status === 'SUCCEEDED'
  );
  const markedUnits = useMemo(
    () =>
      order.items.flatMap((item) =>
        (item.markedUnits ?? [])
          .filter((unit) => unit.status === 'SOLD')
          .map((unit) => ({
            ...unit,
            itemName: item.name
          }))
      ),
    [order.items]
  );
  const settlementSucceeded = settlement?.status === 'SUCCEEDED';
  const canCreateRefund =
    settlementSucceeded && !activeRefund && markedUnits.length > 0;
  const selectedModeUnavailable = markedUnits.length === 0;
  const selectedUnitsInvalid =
    mode === 'SELECTED' && selectedUnitIds.length === 0;
  const submitDisabled =
    submitting || !reason.trim() || selectedUnitsInvalid || !canCreateRefund;

  useEffect(() => {
    if (!activeRefund) return;
    const timer = window.setInterval(() => void onChanged(), 4000);
    return () => window.clearInterval(timer);
  }, [activeRefund, onChanged]);

  useEffect(() => {
    if (successfulRefunds.length) setMode('SELECTED');
  }, [successfulRefunds.length]);

  async function scanReturnedUnit() {
    if (!returnCode.trim()) return;
    setScanning(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/refund/validate-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: returnCode })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Упаковка не найдена в заказе');
      setSelectedUnitIds((current) => [...new Set([...current, data.unit.id])]);
      setReturnCode('');
      toast.success(`Добавлено к возврату: ${data.unit.itemName}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось проверить код'
      );
    } finally {
      setScanning(false);
    }
  }

  async function createRefund() {
    if (submitDisabled) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: reason.trim(),
            ...(mode === 'SELECTED' ? { unitIds: selectedUnitIds } : {})
          })
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error || 'Не удалось поставить возвратный чек в очередь'
        );
      }

      toast.success('Возвратный чек поставлен в очередь');
      setOpen(false);
      setReason('');
      setSelectedUnitIds([]);
      setMode('FULL');
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось создать возвратный чек'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <RotateCcw className='h-5 w-5' />
                Возврат покупателю
              </CardTitle>
              <CardDescription className='mt-1'>
                Возвратный чек создаётся только после успешного чека полного
                расчёта.
              </CardDescription>
            </div>
            {activeRefund && (
              <Badge variant='outline'>
                {RECEIPT_STATUS_LABELS[activeRefund.status] ||
                  activeRefund.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {!settlementSucceeded ? (
            <Alert>
              <ReceiptText />
              <AlertTitle>Возврат пока недоступен</AlertTitle>
              <AlertDescription>
                Сначала должен успешно зарегистрироваться чек полного расчёта.
                До этого деньги и коды маркировки нельзя возвращать через этот
                сценарий.
              </AlertDescription>
            </Alert>
          ) : activeRefund ? (
            <RefundReceiptState refund={activeRefund} />
          ) : markedUnits.length ? (
            <div className='flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <div className='font-medium'>
                  {successfulRefunds.length
                    ? 'Можно оформить следующий частичный возврат'
                    : 'Чек продажи зарегистрирован'}
                </div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  Осталось проданных упаковок: {markedUnits.length}.
                  Одновременно обрабатывается только один возврат.
                </div>
              </div>
              <Button onClick={() => setOpen(true)}>
                <RotateCcw />
                Оформить возврат
              </Button>
            </div>
          ) : (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Возвращаемых упаковок не осталось</AlertTitle>
              <AlertDescription>
                Все маркированные упаковки заказа уже возвращены или ожидают
                проверки.
              </AlertDescription>
            </Alert>
          )}

          {refunds.length > 0 && !activeRefund && (
            <div className='space-y-2'>
              <div className='text-sm font-medium'>История возвратов</div>
              {refunds.map((item, index) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
                >
                  <span>Возврат № {refunds.length - index}</span>
                  <Badge
                    variant={
                      ['FAILED', 'CANCELED'].includes(item.status)
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {RECEIPT_STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <Alert>
            <PackageCheck />
            <AlertTitle>Что произойдёт с Data Matrix</AlertTitle>
            <AlertDescription>
              Возвращённые маркированные упаковки перейдут в карантин. Их нельзя
              снова резервировать и продавать, пока сотрудник не проверит
              упаковку и код маркировки.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Оформить возвратный чек</DialogTitle>
            <DialogDescription>
              Проверьте состав возврата. Следующий частичный возврат можно
              оформить только после завершения текущего и только для оставшихся
              проданных упаковок.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-5'>
            <RadioGroup
              value={mode}
              className='grid gap-3 sm:grid-cols-2'
              onValueChange={(value) => setMode(value as RefundMode)}
            >
              <Label
                htmlFor='refund-full'
                className='flex cursor-pointer items-start gap-3 rounded-lg border p-4'
              >
                <RadioGroupItem
                  id='refund-full'
                  value='FULL'
                  disabled={successfulRefunds.length > 0}
                />
                <span>
                  <span className='block font-medium'>Весь заказ</span>
                  <span className='text-muted-foreground mt-1 block text-sm font-normal'>
                    Вернуть все позиции и все связанные коды маркировки.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor='refund-selected'
                className='flex cursor-pointer items-start gap-3 rounded-lg border p-4'
              >
                <RadioGroupItem
                  id='refund-selected'
                  value='SELECTED'
                  disabled={selectedModeUnavailable}
                />
                <span>
                  <span className='block font-medium'>Отдельные упаковки</span>
                  <span className='text-muted-foreground mt-1 block text-sm font-normal'>
                    Выбрать конкретные Data Matrix для частичного возврата.
                  </span>
                </span>
              </Label>
            </RadioGroup>

            {successfulRefunds.length > 0 && (
              <Alert>
                <AlertCircle />
                <AlertTitle>Ранее уже был частичный возврат</AlertTitle>
                <AlertDescription>
                  Выберите конкретные оставшиеся упаковки. Это защищает от
                  повторного возврата уже выплаченной суммы.
                </AlertDescription>
              </Alert>
            )}

            {mode === 'SELECTED' && (
              <div className='space-y-3'>
                <div>
                  <div className='font-medium'>Упаковки к возврату</div>
                  <div className='text-muted-foreground text-sm'>
                    Выбрано {selectedUnitIds.length} из {markedUnits.length}
                  </div>
                </div>
                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
                  <Input
                    className='font-mono'
                    value={returnCode}
                    onChange={(event) => setReturnCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void scanReturnedUnit();
                      }
                    }}
                    placeholder='Отсканируйте Data Matrix возвращённой упаковки'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    disabled={scanning || !returnCode.trim()}
                    onClick={() => void scanReturnedUnit()}
                  >
                    {scanning ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <ScanLine />
                    )}
                    Проверить
                  </Button>
                </div>
                <div className='max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3'>
                  {markedUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className='flex items-start justify-between gap-3 rounded-md p-2'
                    >
                      <span className='min-w-0'>
                        <span className='block truncate text-sm font-medium'>
                          {unit.itemName}
                        </span>
                        <span className='text-muted-foreground block font-mono text-xs'>
                          GTIN {unit.gtin}
                          {unit.serial ? ` · серийный № ${unit.serial}` : ''}
                        </span>
                      </span>
                      {selectedUnitIds.includes(unit.id) ? (
                        <div className='flex items-center gap-2'>
                          <Badge variant='secondary'>Отсканирована</Badge>
                          <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            onClick={() =>
                              setSelectedUnitIds((current) =>
                                current.filter((id) => id !== unit.id)
                              )
                            }
                          >
                            Убрать
                          </Button>
                        </div>
                      ) : (
                        <Badge variant='outline'>Ожидает сканирования</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {selectedUnitsInvalid && (
                  <p className='text-destructive text-sm'>
                    Выберите хотя бы одну возвращаемую упаковку.
                  </p>
                )}
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='refund-reason'>Причина возврата</Label>
              <Textarea
                id='refund-reason'
                value={reason}
                maxLength={500}
                rows={4}
                placeholder='Например: покупатель отказался от товара, упаковка не вскрыта'
                onChange={(event) => setReason(event.target.value)}
              />
              <div className='text-muted-foreground text-right text-xs'>
                {reason.length}/500
              </div>
            </div>

            <Alert variant='destructive'>
              <AlertCircle />
              <AlertTitle>Проверьте физические упаковки</AlertTitle>
              <AlertDescription>
                Отсканируйте или сверьте Data Matrix фактически полученной
                упаковки. После успеха можно создать следующий возврат только
                для оставшихся проданных упаковок.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button
              variant='destructive'
              disabled={submitDisabled}
              onClick={() => void createRefund()}
            >
              {submitting ? (
                <Loader2 className='animate-spin' />
              ) : (
                <RotateCcw />
              )}
              Создать возвратный чек
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RefundReceiptState({
  refund
}: {
  refund: NonNullable<OrderWithRelations['fiscalReceipts']>[number];
}) {
  if (refund.status === 'SUCCEEDED') {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Возврат зарегистрирован</AlertTitle>
        <AlertDescription>
          Маркированные упаковки ожидают проверки в карантине. Если в заказе
          остались другие проданные упаковки, для них можно оформить следующий
          частичный возврат.
          {refund.succeededAt && (
            <span className='mt-1 block'>
              Завершён {formatDate(refund.succeededAt)}.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (refund.status === 'FAILED' || refund.status === 'CANCELED') {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>Возвратный чек не зарегистрирован</AlertTitle>
        <AlertDescription>
          <p>
            Новый возврат создавать нельзя: сначала нужно разобраться с уже
            созданным чеком.
          </p>
          {refund.lastError && (
            <>
              <p className='mt-2'>{friendlyFiscalError(refund.lastError)}</p>
              <details className='mt-2'>
                <summary className='cursor-pointer'>
                  Технические подробности
                </summary>
                <pre className='bg-muted mt-2 max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap'>
                  {refund.lastError}
                </pre>
              </details>
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <Loader2 className='animate-spin' />
      <AlertTitle>Возврат обрабатывается</AlertTitle>
      <AlertDescription>
        Возвратный чек уже создан. Не оформляйте возврат повторно и дождитесь
        результата ЮKassa.
      </AlertDescription>
    </Alert>
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
