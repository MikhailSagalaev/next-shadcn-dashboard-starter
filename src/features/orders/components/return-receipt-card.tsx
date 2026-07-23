'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PackageCheck,
  ReceiptText,
  RotateCcw
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  const [submitting, setSubmitting] = useState(false);

  const settlement = order.fiscalReceipts?.find(
    (receipt) => receipt.type === 'SETTLEMENT'
  );
  const refund = order.fiscalReceipts?.find(
    (receipt) => receipt.type === 'REFUND'
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
  const canCreateRefund = settlementSucceeded && !refund;
  const selectedModeUnavailable = markedUnits.length === 0;
  const selectedUnitsInvalid =
    mode === 'SELECTED' && selectedUnitIds.length === 0;
  const submitDisabled =
    submitting || !reason.trim() || selectedUnitsInvalid || !canCreateRefund;

  useEffect(() => {
    if (!refund || !['NEW', 'PENDING'].includes(refund.status)) return;
    const timer = window.setInterval(() => void onChanged(), 4000);
    return () => window.clearInterval(timer);
  }, [onChanged, refund]);

  function toggleUnit(unitId: string, checked: boolean) {
    setSelectedUnitIds((current) =>
      checked
        ? [...new Set([...current, unitId])]
        : current.filter((id) => id !== unitId)
    );
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
            {refund && (
              <Badge
                variant={refund.status === 'FAILED' ? 'destructive' : 'outline'}
              >
                {RECEIPT_STATUS_LABELS[refund.status] || refund.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {refund ? (
            <RefundReceiptState refund={refund} />
          ) : !settlementSucceeded ? (
            <Alert>
              <ReceiptText />
              <AlertTitle>Возврат пока недоступен</AlertTitle>
              <AlertDescription>
                Сначала должен успешно зарегистрироваться чек полного расчёта.
                До этого деньги и коды маркировки нельзя возвращать через этот
                сценарий.
              </AlertDescription>
            </Alert>
          ) : (
            <div className='flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <div className='font-medium'>Чек продажи зарегистрирован</div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  Можно оформить один полный или частичный возврат по этому
                  заказу.
                </div>
              </div>
              <Button onClick={() => setOpen(true)}>
                <RotateCcw />
                Оформить возврат
              </Button>
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
              Проверьте состав возврата. После отправки создать второй
              возвратный чек для этого заказа будет нельзя.
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
                <RadioGroupItem id='refund-full' value='FULL' />
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

            {mode === 'SELECTED' && (
              <div className='space-y-3'>
                <div>
                  <div className='font-medium'>Упаковки к возврату</div>
                  <div className='text-muted-foreground text-sm'>
                    Выбрано {selectedUnitIds.length} из {markedUnits.length}
                  </div>
                </div>
                <div className='max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3'>
                  {markedUnits.map((unit) => (
                    <Label
                      key={unit.id}
                      htmlFor={`refund-unit-${unit.id}`}
                      className='hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2'
                    >
                      <Checkbox
                        id={`refund-unit-${unit.id}`}
                        checked={selectedUnitIds.includes(unit.id)}
                        onCheckedChange={(checked) =>
                          toggleUnit(unit.id, checked === true)
                        }
                      />
                      <span className='min-w-0'>
                        <span className='block truncate text-sm font-medium'>
                          {unit.itemName}
                        </span>
                        <span className='text-muted-foreground block font-mono text-xs'>
                          GTIN {unit.gtin}
                          {unit.serial ? ` · серийный № ${unit.serial}` : ''}
                        </span>
                      </span>
                    </Label>
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
              <AlertTitle>Действие нельзя повторить</AlertTitle>
              <AlertDescription>
                После подтверждения система создаст единственный возвратный чек
                для заказа. Проверьте причину и выбранные упаковки.
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
          Повторный возвратный чек для этого заказа создать нельзя.
          Маркированные упаковки ожидают проверки в карантине.
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
