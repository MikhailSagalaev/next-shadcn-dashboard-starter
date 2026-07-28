'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
  Search,
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
import { MarkingWorkspaceNav } from './marking-workspace-nav';

interface Discrepancy {
  id: string;
  type?: string | null;
  severity?: string | null;
  status?: string | null;
  code?: string | null;
  gtin?: string | null;
  productName?: string | null;
  gupilStatus?: string | null;
  externalStatus?: string | null;
  source?: string | null;
  details?: string | null;
  orderId?: string | null;
  detectedAt?: string | null;
}

interface ReconciliationRun {
  id?: string;
  status?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  checkedCount?: number | null;
  discrepanciesCount?: number | null;
  error?: string | null;
  discrepancies?: Discrepancy[];
}

const TYPE_LABELS: Record<string, string> = {
  GUPIL_ONLY: 'Есть только в Gupil',
  EXTERNAL_ONLY: 'Есть только во внешней системе',
  CHZ_ONLY: 'Есть только в «Честном знаке»',
  STATUS_MISMATCH: 'Не совпадает статус кода',
  FISCAL_MISMATCH: 'Не совпадает чек или выбытие',
  RESERVATION_MISMATCH: 'Не совпадает резерв',
  QUANTITY_MISMATCH: 'Не совпадает количество',
  UNIT_WITHOUT_RECEIPT: 'Упаковка без приёмки',
  COMPLIANCE_DOCUMENT_FAILED: 'Ошибка документа ЭДО/ГИС МТ',
  YOOKASSA_UNAVAILABLE: 'ЮKassa недоступна',
  GIS_MT_UNAVAILABLE: 'ГИС МТ недоступна'
};

export function ReconciliationPageView({ projectId }: { projectId: string }) {
  const [run, setRun] = useState<ReconciliationRun | null>(null);
  const [history, setHistory] = useState<ReconciliationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [severity, setSeverity] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/reconciliation`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось загрузить результаты сверки');
      const runs = Array.isArray(data)
        ? data
        : (data.runs ?? data.reconciliations ?? data.history ?? []);
      const latest =
        data.latest ??
        data.reconciliation ??
        (data.discrepancies ? data : null) ??
        runs[0] ??
        null;
      setRun(latest);
      setHistory(runs);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить результаты сверки'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (run?.status !== 'RUNNING' && run?.status !== 'PENDING') return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load, run?.status]);

  const start = async () => {
    setStarting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/reconciliation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: ['GUPIL', 'YOOKASSA', 'GIS_MT']
          })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось запустить сверку');
      toast.success('Сверка запущена. Результаты обновятся автоматически');
      setRun(data.reconciliation ?? data.run ?? data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось запустить сверку'
      );
    } finally {
      setStarting(false);
    }
  };

  const discrepancies = useMemo(
    () => run?.discrepancies ?? [],
    [run?.discrepancies]
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    return discrepancies.filter((item) => {
      const matchesSearch =
        !query ||
        [item.code, item.gtin, item.productName, item.details]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase('ru').includes(query));
      return (
        matchesSearch &&
        (type === 'all' || item.type === type) &&
        (severity === 'all' || item.severity === severity)
      );
    });
  }, [discrepancies, search, severity, type]);

  const critical = discrepancies.filter(
    (item) => item.severity === 'CRITICAL' || item.severity === 'HIGH'
  ).length;
  const unresolved = discrepancies.filter(
    (item) => !['RESOLVED', 'IGNORED'].includes(item.status ?? 'OPEN')
  ).length;

  return (
    <div className='space-y-6 md:px-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <Heading
          title='Сверка маркировки'
          description='Сопоставляйте склад Gupil, чеки ЮKassa и статусы кодов в «Честном знаке»'
        />
        <Button
          onClick={start}
          disabled={
            starting || run?.status === 'RUNNING' || run?.status === 'PENDING'
          }
        >
          {starting ||
          run?.status === 'RUNNING' ||
          run?.status === 'PENDING' ? (
            <Loader2 className='animate-spin' />
          ) : (
            <RefreshCw />
          )}
          {run?.status === 'RUNNING' || run?.status === 'PENDING'
            ? 'Сверка выполняется'
            : 'Запустить сверку'}
        </Button>
      </div>
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='reconciliation' />

      <Alert>
        <ShieldAlert />
        <AlertTitle>
          Данные ГИС МТ доступны только через оператора и УКЭП
        </AlertTitle>
        <AlertDescription>
          Для полной сверки требуется действующее подключение к ГИС МТ и
          авторизация подписанта. Без него можно сопоставить Gupil и ЮKassa, но
          статус кода в «Честном знаке» останется непроверенным. Сверка ничего
          не списывает и не исправляет автоматически.
        </AlertDescription>
      </Alert>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard
          label='Проверено кодов'
          value={run?.checkedCount ?? 0}
          icon={Scale}
        />
        <SummaryCard
          label='Расхождений'
          value={discrepancies.length || run?.discrepanciesCount || 0}
          icon={AlertTriangle}
          tone={discrepancies.length > 0 ? 'warning' : 'default'}
        />
        <SummaryCard
          label='Критичных'
          value={critical}
          icon={ShieldAlert}
          tone={critical > 0 ? 'danger' : 'default'}
        />
        <SummaryCard
          label='Не разобрано'
          value={unresolved}
          icon={CircleHelp}
        />
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle>Последняя сверка</CardTitle>
              <CardDescription>
                {run?.completedAt
                  ? `Завершена ${new Date(run.completedAt).toLocaleString('ru-RU')}`
                  : run?.startedAt
                    ? `Запущена ${new Date(run.startedAt).toLocaleString('ru-RU')}`
                    : 'Сверка ещё не запускалась'}
              </CardDescription>
            </div>
            {run?.status && <RunStatus status={run.status} />}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {run?.error && (
            <Alert variant='destructive'>
              <AlertTriangle />
              <AlertTitle>Сверка завершилась с ошибкой</AlertTitle>
              <AlertDescription>{run.error}</AlertDescription>
            </Alert>
          )}

          <div className='flex flex-col gap-2 lg:flex-row'>
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                className='pl-9'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Data Matrix, GTIN, товар или описание'
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className='w-full lg:w-64'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все типы расхождений</SelectItem>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className='w-full lg:w-48'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Любая важность</SelectItem>
                <SelectItem value='CRITICAL'>Критично</SelectItem>
                <SelectItem value='HIGH'>Высокая</SelectItem>
                <SelectItem value='MEDIUM'>Средняя</SelectItem>
                <SelectItem value='LOW'>Низкая</SelectItem>
              </SelectContent>
            </Select>
            <Button variant='outline' size='icon' onClick={load}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              <span className='sr-only'>Обновить</span>
            </Button>
          </div>

          {loading ? (
            <div className='space-y-3'>
              <Skeleton className='h-40 w-full' />
              <Skeleton className='h-40 w-full' />
            </div>
          ) : !run ? (
            <EmptyReconciliation onStart={start} starting={starting} />
          ) : filtered.length === 0 ? (
            discrepancies.length === 0 ? (
              <AllClear checked={run.checkedCount ?? 0} />
            ) : (
              <div className='rounded-lg border border-dashed p-8 text-center'>
                <p className='font-medium'>По выбранным фильтрам ничего нет</p>
                <p className='text-muted-foreground mt-1 text-sm'>
                  Измените запрос, тип или важность расхождения.
                </p>
              </div>
            )
          ) : (
            <div className='space-y-3'>
              {filtered.map((item) => (
                <DiscrepancyCard
                  key={item.id}
                  projectId={projectId}
                  item={item}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 1 && (
        <p className='text-muted-foreground text-center text-xs'>
          Сохранено запусков сверки: {history.length}. На странице показан
          последний результат.
        </p>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = 'default'
}: {
  label: string;
  value: number;
  icon: typeof Scale;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <Card>
      <CardContent className='flex items-center justify-between p-5'>
        <div>
          <div className='text-muted-foreground text-sm'>{label}</div>
          <div className='mt-1 text-2xl font-semibold'>{value}</div>
        </div>
        <Icon
          className={
            tone === 'danger'
              ? 'text-destructive'
              : tone === 'warning'
                ? 'text-amber-600'
                : 'text-muted-foreground'
          }
        />
      </CardContent>
    </Card>
  );
}

function RunStatus({ status }: { status: string }) {
  const map: Record<
    string,
    {
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }
  > = {
    PENDING: { label: 'В очереди', variant: 'outline' },
    RUNNING: { label: 'Выполняется', variant: 'outline' },
    COMPLETED: { label: 'Завершена', variant: 'default' },
    FAILED: { label: 'Ошибка', variant: 'destructive' }
  };
  const item = map[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

function DiscrepancyCard({
  projectId,
  item
}: {
  projectId: string;
  item: Discrepancy;
}) {
  const isCritical = item.severity === 'CRITICAL' || item.severity === 'HIGH';
  const resolution = getResolution(item.type);

  return (
    <div
      className={
        isCritical
          ? 'rounded-lg border border-red-300 bg-red-50/60 p-4 dark:bg-red-950/10'
          : 'rounded-lg border p-4'
      }
    >
      <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={isCritical ? 'destructive' : 'secondary'}>
              {item.severity === 'CRITICAL'
                ? 'Критично'
                : item.severity === 'HIGH'
                  ? 'Высокая важность'
                  : item.severity === 'MEDIUM'
                    ? 'Средняя важность'
                    : 'Низкая важность'}
            </Badge>
            <span className='font-semibold'>
              {TYPE_LABELS[item.type ?? ''] || item.type || 'Расхождение'}
            </span>
          </div>
          <p className='mt-2 font-medium'>
            {item.productName || 'Товар не определён'}
          </p>
          <div className='text-muted-foreground mt-1 space-y-1 text-sm'>
            {item.gtin && <p>GTIN: {item.gtin}</p>}
            {item.code && (
              <p className='font-mono text-xs break-all'>Код: {item.code}</p>
            )}
            {item.detectedAt && (
              <p>
                Обнаружено: {new Date(item.detectedAt).toLocaleString('ru-RU')}
              </p>
            )}
          </div>
        </div>
        {item.orderId && (
          <Button variant='outline' size='sm' asChild>
            <Link
              href={`/dashboard/projects/${projectId}/orders/${item.orderId}`}
            >
              Открыть заказ
              <ExternalLink />
            </Link>
          </Button>
        )}
      </div>

      <div className='mt-4 grid gap-3 md:grid-cols-2'>
        <StatusBox label='В Gupil' value={item.gupilStatus || 'Нет данных'} />
        <StatusBox
          label={item.source || 'Во внешней системе'}
          value={item.externalStatus || 'Нет данных'}
        />
      </div>

      {item.details && <p className='mt-3 text-sm'>{item.details}</p>}
      <div className='mt-3 rounded-md bg-white/70 p-3 text-sm dark:bg-black/20'>
        <span className='font-medium'>Что сделать: </span>
        {resolution}
      </div>
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-background rounded-md border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 font-medium'>{value}</div>
    </div>
  );
}

function getResolution(type?: string | null) {
  switch (type) {
    case 'GUPIL_ONLY':
      return 'проверьте, был ли код принят ГИС МТ, и повторите обмен с оператором. Не списывайте код повторно.';
    case 'EXTERNAL_ONLY':
    case 'CHZ_ONLY':
      return 'найдите документ приёмки, возврата или списания и восстановите недостающую складскую операцию в Gupil.';
    case 'STATUS_MISMATCH':
      return 'приостановите продажу упаковки, проверьте последний принятый документ ГИС МТ и затем синхронизируйте статус.';
    case 'FISCAL_MISMATCH':
      return 'сопоставьте payment_id и статус чека ЮKassa. Квитанцию ОФД проверьте в кабинете кассового/ОФД-провайдера: Gupil не выдаёт ответ ЮKassa за отдельную проверку ОФД.';
    case 'UNIT_WITHOUT_RECEIPT':
      return 'найдите исходный УПД или акт ввода остатков. До восстановления основания не переводите упаковку в доступный склад.';
    case 'COMPLIANCE_DOCUMENT_FAILED':
      return 'откройте связанный заказ, карантин или списание, устраните причину и повторите отправку документа. Не создавайте второй документ с теми же кодами.';
    case 'YOOKASSA_UNAVAILABLE':
      return 'проверьте реквизиты магазина и повторите сверку. Состояние чека пока не подтверждено.';
    case 'GIS_MT_UNAVAILABLE':
      return 'проверьте шлюз оператора и УКЭП, затем повторите сверку. Локальная сверка не заменяет ответ ГИС МТ.';
    case 'RESERVATION_MISMATCH':
      return 'откройте связанный заказ и проверьте, не зарезервирована ли упаковка одновременно в другом процессе.';
    default:
      return 'сверьте первичный документ и историю операций. Автоматическое исправление отключено, чтобы не создать повторное выбытие.';
  }
}

function EmptyReconciliation({
  onStart,
  starting
}: {
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <div className='flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center'>
      <Scale className='text-muted-foreground mb-4 h-10 w-10' />
      <h3 className='font-semibold'>Сверка ещё не выполнялась</h3>
      <p className='text-muted-foreground mt-2 max-w-lg text-sm'>
        Запустите проверку, чтобы сопоставить конкретные упаковки, кассовые чеки
        и статусы в ГИС МТ. Операция только читает данные и ничего не списывает.
      </p>
      <Button className='mt-4' onClick={onStart} disabled={starting}>
        {starting ? <Loader2 className='animate-spin' /> : <RefreshCw />}
        Запустить первую сверку
      </Button>
    </div>
  );
}

function AllClear({ checked }: { checked: number }) {
  return (
    <div className='flex min-h-56 flex-col items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50/60 p-8 text-center dark:bg-emerald-950/10'>
      <CheckCircle2 className='mb-4 h-10 w-10 text-emerald-600' />
      <h3 className='font-semibold'>Расхождений не обнаружено</h3>
      <p className='text-muted-foreground mt-2 text-sm'>
        Проверено кодов: {checked}. Результат относится к моменту последней
        завершённой сверки.
      </p>
    </div>
  );
}
