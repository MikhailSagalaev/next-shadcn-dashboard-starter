'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Layers3,
  Package,
  Pencil,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { CatalogImportDialog } from './catalog-import-dialog';
import { MarkingWorkspaceNav } from '@/features/marking/components/marking-workspace-nav';
import {
  type CatalogPagination,
  type CatalogSummary,
  MARKING_STATUS_LABELS,
  type ProductRow,
  productNeedsSetup
} from './product-catalog-types';
import { ProductEditDialog } from './product-edit-dialog';
import { ProductBulkEditDialog } from './product-bulk-edit-dialog';

const PAGE_SIZE = 25;
const EMPTY_SUMMARY: CatalogSummary = {
  total: 0,
  needsSetup: 0,
  availableUnits: 0
};

export function ProductsPageView({ projectId }: { projectId: string }) {
  const requestId = useRef(0);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState<CatalogSummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<CatalogPagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });
      if (search) params.set('search', search);
      if (status !== 'ALL') params.set('markingStatus', status);
      const response = await fetch(
        `/api/projects/${projectId}/products?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить каталог');
      }
      if (currentRequest !== requestId.current) return;
      setProducts(data.products ?? []);
      setSelectedIds(new Set());
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setPagination(data.pagination);
      if (page > data.pagination.totalPages)
        setPage(data.pagination.totalPages);
    } catch (error) {
      if (currentRequest === requestId.current) {
        toast.error(error instanceof Error ? error.message : 'Ошибка каталога');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, projectId, search, status]);

  useEffect(() => void load(), [load]);

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus);
    setPage(1);
  }

  const firstItem = pagination.total
    ? (pagination.page - 1) * pagination.pageSize + 1
    : 0;
  const lastItem = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Heading
          title='Каталог и маркировка'
          description='Настройте товары для чеков ЮKassa и работы с кодами маркировки'
        />
        <Button variant='outline' onClick={() => setImportOpen(true)}>
          <FileUp /> Импорт CSV
        </Button>
      </div>
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='catalog' />

      <div className='grid gap-4 md:grid-cols-3'>
        <SummaryCard label='Товаров в каталоге' value={summary.total} />
        <SummaryCard
          label='Требуют настройки'
          value={summary.needsSetup}
          tone={summary.needsSetup ? 'warning' : 'default'}
          active={status === 'NEEDS_SETUP'}
          onClick={() =>
            changeStatus(status === 'NEEDS_SETUP' ? 'ALL' : 'NEEDS_SETUP')
          }
        />
        <SummaryCard label='Доступно единиц' value={summary.availableUnits} />
      </div>

      <Card>
        <CardHeader className='gap-4'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Package className='h-5 w-5' /> Товары
            </CardTitle>
            <CardDescription className='mt-1'>
              Tilda создаёт и обновляет коммерческие данные. Здесь вы заполняете
              только реквизиты для чека и маркировки.
            </CardDescription>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                value={searchInput}
                className='pl-9'
                placeholder='Название, SKU, External ID или GTIN'
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <Select value={status} onValueChange={changeStatus}>
              <SelectTrigger className='w-full sm:w-64'>
                <SlidersHorizontal className='h-4 w-4' />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>Все товары</SelectItem>
                <SelectItem value='NEEDS_SETUP'>Требуют настройки</SelectItem>
                <SelectItem value='MARKED_REQUIRED'>Маркируемые</SelectItem>
                <SelectItem value='NOT_SUBJECT'>
                  Не подлежат маркировке
                </SelectItem>
                <SelectItem value='LEGACY_UNMARKED_ALLOWED'>
                  Старые остатки
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedIds.size > 0 && (
            <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'>
              <span className='text-sm font-medium'>
                Выбрано товаров: {selectedIds.size}
              </span>
              <div className='flex gap-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setSelectedIds(new Set())}
                >
                  Снять выбор
                </Button>
                <Button size='sm' onClick={() => setBulkOpen(true)}>
                  <Layers3 /> Изменить выбранные
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className='px-0'>
          {loading ? (
            <CatalogSkeleton />
          ) : products.length === 0 ? (
            <div className='flex flex-col items-center px-6 py-16 text-center'>
              <Package className='text-muted-foreground/60 mb-4 h-10 w-10' />
              <div className='font-medium'>Товары не найдены</div>
              <div className='text-muted-foreground mt-1 max-w-md text-sm'>
                {search || status !== 'ALL'
                  ? 'Измените запрос или сбросьте фильтр.'
                  : 'Товары появятся из заказов Tilda или после импорта CSV.'}
              </div>
              {(search || status !== 'ALL') && (
                <Button
                  variant='outline'
                  className='mt-4'
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    changeStatus('ALL');
                  }}
                >
                  Сбросить фильтры
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10 pl-6'>
                      <Checkbox
                        checked={
                          products.length > 0 &&
                          selectedIds.size === products.length
                        }
                        aria-label='Выбрать все товары на странице'
                        onCheckedChange={(checked) =>
                          setSelectedIds(
                            checked
                              ? new Set(products.map((product) => product.id))
                              : new Set()
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead>Готовность</TableHead>
                    <TableHead>Маркировка</TableHead>
                    <TableHead>НДС</TableHead>
                    <TableHead>Остаток</TableHead>
                    <TableHead className='pr-6 text-right'>Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const needsSetup = productNeedsSetup(product);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className='w-10 pl-6'>
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            aria-label={`Выбрать ${product.name}`}
                            onCheckedChange={(checked) =>
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (checked) next.add(product.id);
                                else next.delete(product.id);
                                return next;
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className='max-w-[28rem] py-3'>
                          <div className='truncate font-medium'>
                            {product.name}
                          </div>
                          <div className='text-muted-foreground mt-1 flex gap-3 text-xs'>
                            {product.sku && <span>SKU: {product.sku}</span>}
                            {product.externalId && (
                              <span className='max-w-48 truncate'>
                                Tilda: {product.externalId}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={needsSetup ? 'destructive' : 'secondary'}
                          >
                            {needsSetup ? 'Нужно настроить' : 'Готов'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            {MARKING_STATUS_LABELS[product.markingStatus]}
                          </div>
                          {product.gtin && (
                            <div className='text-muted-foreground mt-1 text-xs'>
                              GTIN {product.gtin}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {product.vatCode ? `Код ${product.vatCode}` : '—'}
                        </TableCell>
                        <TableCell>
                          <div>
                            {Math.max(
                              0,
                              product.stockOnHand - product.stockReserved
                            )}{' '}
                            доступно
                          </div>
                          {product.stockReserved > 0 && (
                            <div className='text-muted-foreground mt-1 text-xs'>
                              {product.stockReserved} в резерве
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='pr-6 text-right'>
                          <Button
                            variant={needsSetup ? 'default' : 'outline'}
                            size='sm'
                            onClick={() => setEditingProduct(product)}
                          >
                            <Pencil /> {needsSetup ? 'Настроить' : 'Изменить'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className='flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='text-muted-foreground text-sm'>
                  Показано {firstItem}–{lastItem} из {pagination.total}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    <ChevronLeft /> Назад
                  </Button>
                  <span className='min-w-20 text-center text-sm'>
                    {pagination.page} из {pagination.totalPages}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(pagination.totalPages, current + 1)
                      )
                    }
                  >
                    Далее <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CatalogImportDialog
        projectId={projectId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={async () => {
          if (page === 1) await load();
          else setPage(1);
        }}
      />
      <ProductEditDialog
        projectId={projectId}
        product={editingProduct}
        open={Boolean(editingProduct)}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null);
        }}
        onSaved={load}
      />
      <ProductBulkEditDialog
        projectId={projectId}
        ids={[...selectedIds]}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSaved={load}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
  active,
  onClick
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning';
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`${tone === 'warning' ? 'border-amber-300/70' : ''} ${
        onClick ? 'hover:bg-muted/40 cursor-pointer transition-colors' : ''
      } ${active ? 'ring-primary ring-2' : ''}`}
      onClick={onClick}
    >
      <CardHeader className='pb-3'>
        <CardDescription>{label}</CardDescription>
        <CardTitle className='text-3xl tabular-nums'>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function CatalogSkeleton() {
  return (
    <div className='space-y-1 px-6 pb-5'>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className='flex items-center gap-6 border-b py-4'>
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-2/3' />
            <Skeleton className='h-3 w-1/3' />
          </div>
          <Skeleton className='h-6 w-28' />
          <Skeleton className='h-8 w-24' />
        </div>
      ))}
    </div>
  );
}
