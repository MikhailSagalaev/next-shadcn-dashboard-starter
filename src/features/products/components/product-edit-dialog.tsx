'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { YOOKASSA_VAT_CODES } from '@/lib/yookassa/receipt-options';
import {
  MARKING_STATUS_LABELS,
  type MarkingStatus,
  type ProductRow,
  productNeedsSetup
} from './product-catalog-types';

interface ProductEditDialogProps {
  projectId: string;
  product: ProductRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}

export function ProductEditDialog({
  projectId,
  product,
  open,
  onOpenChange,
  onSaved
}: ProductEditDialogProps) {
  const [draft, setDraft] = useState<ProductRow | null>(product);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(product), [product]);

  if (!draft) return null;

  function patch(values: Partial<ProductRow>) {
    setDraft((current) => (current ? { ...current, ...values } : current));
  }

  async function save() {
    const name = draft.name.trim();
    const gtin = draft.gtin?.trim().padStart(14, '0') || null;
    if (!name) return toast.error('Укажите название товара');
    if (!Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0) {
      return toast.error('Цена должна быть больше нуля');
    }
    if (gtin && !/^\d{8,14}$/.test(gtin)) {
      return toast.error('GTIN должен содержать от 8 до 14 цифр');
    }
    if (draft.markingStatus === 'MARKED_REQUIRED' && !gtin) {
      return toast.error('Для маркируемого товара укажите GTIN');
    }
    if (draft.markingStatus === 'UNKNOWN') {
      return toast.error('Выберите, подлежит ли товар маркировке');
    }
    if (!draft.vatCode) return toast.error('Выберите ставку НДС');

    setSaving(true);
    try {
      const paymentSubject =
        draft.markingStatus === 'MARKED_REQUIRED' ? 'marked' : 'commodity';
      const response = await fetch(
        `/api/projects/${projectId}/products/${draft.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            sku: draft.sku?.trim() || undefined,
            externalId: draft.externalId?.trim() || null,
            gtin,
            price: Number(draft.price),
            markingStatus: draft.markingStatus,
            vatCode: draft.vatCode,
            paymentSubject,
            measure: draft.measure || 'piece',
            stockOnHand: Number(draft.stockOnHand)
          })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось сохранить товар');
      toast.success('Товар сохранён');
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Ошибка сохранения товара'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Настройка товара</DialogTitle>
          <DialogDescription>
            Эти параметры попадут в чек ЮKassa. Название и цена продолжат
            обновляться из заказов Tilda.
          </DialogDescription>
        </DialogHeader>

        {productNeedsSetup(draft) && (
          <Alert>
            <AlertCircle />
            <AlertTitle>Товар пока не готов к маркировочному чеку</AlertTitle>
            <AlertDescription>
              Выберите тип маркировки и НДС. Для маркируемого товара также
              обязателен GTIN.
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-5 py-2 sm:grid-cols-2'>
          <div className='space-y-2 sm:col-span-2'>
            <Label htmlFor='product-name'>Название</Label>
            <Input
              id='product-name'
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='product-external-id'>External ID Tilda</Label>
            <Input
              id='product-external-id'
              value={draft.externalId ?? ''}
              onChange={(event) => patch({ externalId: event.target.value })}
            />
            <p className='text-muted-foreground text-xs'>
              Главный идентификатор для связи строки заказа Tilda с этим
              товаром. Не меняйте его без необходимости.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='product-sku'>SKU / артикул</Label>
            <Input
              id='product-sku'
              value={draft.sku ?? ''}
              onChange={(event) => patch({ sku: event.target.value })}
            />
            <p className='text-muted-foreground text-xs'>
              Резервный ключ сопоставления, если Tilda не передала External ID.
            </p>
          </div>

          <div className='space-y-2'>
            <Label>Маркировка</Label>
            <Select
              value={draft.markingStatus}
              onValueChange={(value: MarkingStatus) =>
                patch({
                  markingStatus: value,
                  paymentSubject:
                    value === 'MARKED_REQUIRED' ? 'marked' : 'commodity'
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MARKING_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='product-gtin'>GTIN</Label>
            <Input
              id='product-gtin'
              value={draft.gtin ?? ''}
              inputMode='numeric'
              maxLength={14}
              placeholder='8–14 цифр'
              onChange={(event) =>
                patch({ gtin: event.target.value.replace(/\D/g, '') })
              }
            />
            <p className='text-muted-foreground text-xs'>
              Код товара из «Честного знака», без Data Matrix и серийного
              номера.
            </p>
          </div>

          <div className='space-y-2'>
            <Label>Ставка НДС для чека</Label>
            <Select
              value={draft.vatCode ? String(draft.vatCode) : 'unset'}
              onValueChange={(value) =>
                patch({ vatCode: value === 'unset' ? null : Number(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='unset'>Не выбрана</SelectItem>
                {YOOKASSA_VAT_CODES.map((item) => (
                  <SelectItem key={item.value} value={String(item.value)}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-xs'>
              Должна соответствовать системе налогообложения магазина и
              настройкам кассы.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='product-price'>Цена, ₽</Label>
            <Input
              id='product-price'
              type='number'
              min={0.01}
              step={0.01}
              value={draft.price}
              onChange={(event) => patch({ price: event.target.value })}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='product-stock'>Остаток на складе</Label>
            <Input
              id='product-stock'
              type='number'
              min={0}
              step={1}
              value={draft.stockOnHand}
              onChange={(event) =>
                patch({ stockOnHand: Number(event.target.value) })
              }
            />
            <p className='text-muted-foreground text-xs'>
              Зарезервировано: {draft.stockReserved}; доступно:{' '}
              {Math.max(0, draft.stockOnHand - draft.stockReserved)}.
            </p>
          </div>

          <div className='bg-muted/50 space-y-1 rounded-lg border p-3 text-sm'>
            <div className='font-medium'>Предмет расчёта</div>
            <div className='text-muted-foreground'>
              {draft.markingStatus === 'MARKED_REQUIRED'
                ? 'Маркированный товар'
                : 'Товар'}{' '}
              · устанавливается автоматически.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type='button' disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className='animate-spin' /> : <Save />}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
