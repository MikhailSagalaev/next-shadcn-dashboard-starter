'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, CheckCircle2, ReceiptText, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

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
  const firstIncomplete = required.find(
    (item) => (item.markedUnits?.length ?? 0) < item.quantity
  );
  const firstIncompleteId = firstIncomplete?.id;
  const [itemId, setItemId] = useState(
    firstIncomplete?.id ?? required[0]?.id ?? ''
  );
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (firstIncompleteId) setItemId(firstIncompleteId);
  }, [firstIncompleteId]);

  async function scan() {
    if (!itemId || !code.trim() || busy) return;
    setBusy(true);
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
      toast.error(
        error instanceof Error ? error.message : 'Ошибка сканирования'
      );
      setCode('');
      inputRef.current?.focus();
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
    toast.success('Скан отменён');
    await onChanged();
  }

  async function fiscalize() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/fiscalize`,
        {
          method: 'POST'
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Чек не поставлен в очередь');
      toast.success('Закрывающий чек поставлен в очередь');
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Ошибка фискализации'
      );
    } finally {
      setBusy(false);
    }
  }

  const settlement = order.fiscalReceipts?.find(
    (receipt) => receipt.type === 'SETTLEMENT'
  );
  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Barcode className='h-5 w-5' /> Сборка и маркировка
            </CardTitle>
            <CardDescription>
              Сканируйте Data Matrix с каждой фактической упаковки.
            </CardDescription>
          </div>
          <div className='flex gap-2'>
            <Badge variant='outline'>{order.markingState}</Badge>
            <Badge variant='outline'>{order.fiscalState}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>
        {order.markingState === 'UNCONFIGURED' && (
          <div className='text-destructive rounded-md border border-current p-3 text-sm'>
            В каталоге не настроены GTIN или статус маркировки для части
            товаров.
          </div>
        )}
        {required.length > 0 && (
          <>
            <div className='grid gap-3 md:grid-cols-[1fr_2fr_auto]'>
              <Select value={itemId} onValueChange={setItemId}>
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
              <Input
                ref={inputRef}
                autoFocus
                value={code}
                placeholder='Отсканируйте Data Matrix и нажмите Enter'
                disabled={busy}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void scan();
                  }
                }}
              />
              <Button
                disabled={!code.trim() || busy}
                onClick={() => void scan()}
              >
                Добавить
              </Button>
            </div>
            <div className='space-y-3'>
              {required.map((item) => (
                <div key={item.id} className='rounded-md border p-3'>
                  <div className='flex justify-between gap-2'>
                    <span className='font-medium'>{item.name}</span>
                    <span>
                      {item.markedUnits?.length ?? 0} / {item.quantity}
                    </span>
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    GTIN: {item.gtin || 'не настроен'}
                  </div>
                  <div className='mt-2 flex flex-wrap gap-2'>
                    {item.markedUnits?.map((unit) => (
                      <Badge
                        key={unit.id}
                        variant='secondary'
                        className='gap-1'
                      >
                        {unit.serial || unit.gtin}
                        <button
                          aria-label='Удалить скан'
                          onClick={() => void remove(unit.id)}
                        >
                          <Trash2 className='h-3 w-3' />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {order.markingState === 'COMPLETE' ||
        order.markingState === 'NOT_REQUIRED' ? (
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border p-3'>
            <div className='flex items-center gap-2 text-sm'>
              <CheckCircle2 className='h-5 w-5 text-green-600' /> Комплектация
              готова
            </div>
            <Button
              disabled={busy || Boolean(settlement)}
              onClick={() => void fiscalize()}
            >
              <ReceiptText className='mr-2 h-4 w-4' />
              {settlement
                ? `Чек: ${settlement.status}`
                : 'Сформировать полный расчёт'}
            </Button>
          </div>
        ) : null}
        {settlement?.lastError && (
          <div className='text-destructive text-sm'>{settlement.lastError}</div>
        )}
      </CardContent>
    </Card>
  );
}
