'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Package, Save } from 'lucide-react';
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
import { YOOKASSA_VAT_CODES } from '@/lib/yookassa/receipt-options';

type MarkingStatus =
  | 'UNKNOWN'
  | 'MARKED_REQUIRED'
  | 'LEGACY_UNMARKED_ALLOWED'
  | 'NOT_SUBJECT';

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  externalId: string | null;
  gtin: string | null;
  price: string | number;
  markingStatus: MarkingStatus;
  vatCode: number | null;
  paymentSubject: string | null;
  measure: string;
  stockOnHand: number;
  stockReserved: number;
}

const statusLabels: Record<MarkingStatus, string> = {
  UNKNOWN: 'Не настроен',
  MARKED_REQUIRED: 'Маркируемый',
  LEGACY_UNMARKED_ALLOWED: 'Старый остаток',
  NOT_SUBJECT: 'Не маркируется'
};

export function ProductsPageView({ projectId }: { projectId: string }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/products`);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось загрузить каталог');
      setProducts(data.products || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка каталога');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => void load(), [load]);

  const patchRow = (id: string, values: Partial<ProductRow>) =>
    setProducts((current) =>
      current.map((row) => (row.id === id ? { ...row, ...values } : row))
    );

  async function save(product: ProductRow) {
    setSavingId(product.id);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/products/${product.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: product.name,
            sku: product.sku || undefined,
            externalId: product.externalId || null,
            gtin: product.gtin || null,
            price: Number(product.price),
            markingStatus: product.markingStatus,
            vatCode: product.vatCode,
            paymentSubject: product.paymentSubject || null,
            measure: product.measure,
            stockOnHand: Number(product.stockOnHand)
          })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось сохранить товар');
      toast.success('Товар сохранён');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    } finally {
      setSavingId(null);
    }
  }

  async function importCsv(file: File) {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/products/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
          body: await file.text()
        }
      );
      const data = await response.json();
      if (!response.ok && response.status !== 207)
        throw new Error(data.error || 'Ошибка импорта');
      toast.success(
        `Импорт: создано ${data.created}, обновлено ${data.updated}`
      );
      if (data.errors?.length) toast.warning(`Ошибок: ${data.errors.length}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка импорта');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const unconfigured = products.filter(
    (product) => product.markingStatus === 'UNKNOWN'
  ).length;

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Heading
          title='Каталог и маркировка'
          description='GTIN, фискальные реквизиты и складские остатки'
        />
        <div>
          <input
            ref={fileRef}
            type='file'
            accept='.csv,text/csv'
            className='hidden'
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCsv(file);
            }}
          />
          <Button variant='outline' onClick={() => fileRef.current?.click()}>
            <FileUp className='mr-2 h-4 w-4' /> Импорт CSV
          </Button>
        </div>
      </div>
      <Separator />
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Позиций</CardDescription>
            <CardTitle>{products.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Требуют настройки</CardDescription>
            <CardTitle>{unconfigured}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Доступно единиц</CardDescription>
            <CardTitle>
              {products.reduce(
                (sum, product) =>
                  sum +
                  Math.max(0, product.stockOnHand - product.stockReserved),
                0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Package className='h-5 w-5' /> Товары
          </CardTitle>
          <CardDescription>
            Каждая строка — отдельная продаваемая позиция или вариант Tilda.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {loading ? (
            <div>Загрузка…</div>
          ) : products.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center'>
              Каталог пуст. Загрузите CSV из Tilda.
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className='space-y-3 rounded-lg border p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='font-medium'>{product.name}</div>
                  <Badge
                    variant={
                      product.markingStatus === 'UNKNOWN'
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {statusLabels[product.markingStatus]}
                  </Badge>
                </div>
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                  <Input
                    value={product.name}
                    aria-label='Название'
                    onChange={(e) =>
                      patchRow(product.id, { name: e.target.value })
                    }
                  />
                  <Input
                    value={product.sku ?? ''}
                    placeholder='SKU'
                    onChange={(e) =>
                      patchRow(product.id, { sku: e.target.value })
                    }
                  />
                  <Input
                    value={product.externalId ?? ''}
                    placeholder='External ID Tilda'
                    onChange={(e) =>
                      patchRow(product.id, { externalId: e.target.value })
                    }
                  />
                  <Input
                    value={product.gtin ?? ''}
                    placeholder='GTIN (14 цифр)'
                    inputMode='numeric'
                    onChange={(e) =>
                      patchRow(product.id, { gtin: e.target.value })
                    }
                  />
                  <Select
                    value={product.markingStatus}
                    onValueChange={(value: MarkingStatus) =>
                      patchRow(product.id, { markingStatus: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={product.vatCode ? String(product.vatCode) : 'unset'}
                    onValueChange={(value) =>
                      patchRow(product.id, {
                        vatCode: value === 'unset' ? null : Number(value)
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Ставка НДС' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='unset'>НДС не настроен</SelectItem>
                      {YOOKASSA_VAT_CODES.map((item) => (
                        <SelectItem key={item.value} value={String(item.value)}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={product.paymentSubject ?? ''}
                    placeholder='Предмет расчёта'
                    onChange={(e) =>
                      patchRow(product.id, { paymentSubject: e.target.value })
                    }
                  />
                  <Input
                    type='number'
                    min={0}
                    value={product.stockOnHand}
                    placeholder='Остаток'
                    onChange={(e) =>
                      patchRow(product.id, {
                        stockOnHand: Number(e.target.value)
                      })
                    }
                  />
                </div>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>
                    Резерв: {product.stockReserved} · Доступно:{' '}
                    {Math.max(0, product.stockOnHand - product.stockReserved)}
                  </span>
                  <Button
                    size='sm'
                    disabled={savingId === product.id}
                    onClick={() => void save(product)}
                  >
                    <Save className='mr-2 h-4 w-4' />
                    Сохранить
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
