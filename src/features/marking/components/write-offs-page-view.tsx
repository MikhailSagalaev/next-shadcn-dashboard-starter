'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardMinus,
  FileSignature,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle
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
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { MarkingOperationsLinks } from './marking-operations-links';

interface WriteOffDocument {
  id: string;
  number?: string | null;
  reason?: string | null;
  status?: string | null;
  codesCount?: number | null;
  createdAt?: string | null;
  submittedAt?: string | null;
  comment?: string | null;
  error?: string | null;
}

const REASONS: Record<string, string> = {
  DAMAGED: 'Брак или повреждение',
  LOST: 'Утрата',
  EXPIRED: 'Истёк срок годности',
  OWN_USE: 'Собственные нужды',
  DESTROYED: 'Уничтожение',
  OTHER: 'Другая причина'
};

const STATUSES: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  DRAFT: { label: 'Черновик', variant: 'secondary' },
  READY: { label: 'Готов к отправке', variant: 'outline' },
  SUBMITTING: { label: 'Отправляется', variant: 'outline' },
  ACCEPTED: { label: 'Принят ГИС МТ', variant: 'default' },
  REJECTED: { label: 'Отклонён', variant: 'destructive' },
  FAILED: { label: 'Ошибка отправки', variant: 'destructive' }
};

export function WriteOffsPageView({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<WriteOffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [reason, setReason] = useState('all');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/write-offs`, {
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || 'Не удалось загрузить документы списания'
        );
      setDocuments(
        Array.isArray(data)
          ? data
          : (data.documents ?? data.writeOffs ?? data.items ?? [])
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить документы списания'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => void loadDocuments(), [loadDocuments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    return documents.filter((document) => {
      const matchesSearch =
        !query ||
        [document.number, document.comment, document.error]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase('ru').includes(query));
      return (
        matchesSearch &&
        (status === 'all' || document.status === status) &&
        (reason === 'all' || document.reason === reason)
      );
    });
  }, [documents, reason, search, status]);

  const submitDocument = async (documentId: string) => {
    setSubmittingId(documentId);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/write-offs/${documentId}/submit`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось отправить документ');
      toast.success('Документ передан оператору для подписания и отправки');
      await loadDocuments();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось отправить документ'
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const drafts = documents.filter((item) =>
    ['DRAFT', 'READY'].includes(item.status ?? 'DRAFT')
  ).length;
  const failed = documents.filter((item) =>
    ['FAILED', 'REJECTED'].includes(item.status ?? '')
  ).length;
  const accepted = documents.filter(
    (item) => item.status === 'ACCEPTED'
  ).length;

  return (
    <div className='space-y-6 md:px-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <Heading
          title='Списания маркированного товара'
          description='Оформляйте вывод из оборота по браку, утрате, истечению срока или собственным нуждам'
        />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Создать списание
        </Button>
      </div>
      <Separator />
      <MarkingOperationsLinks projectId={projectId} active='write-offs' />

      <Alert>
        <FileSignature />
        <AlertTitle>Для отправки документа нужна УКЭП</AlertTitle>
        <AlertDescription>
          Gupil подготовит документ и проверит коды, но юридически значимая
          отправка в ГИС МТ выполняется после подписания УКЭП. Убедитесь, что
          подключён оператор ЭДО/ГИС МТ и настроено рабочее место подписанта.
          Создание черновика само по себе не выводит товар из оборота.
        </AlertDescription>
      </Alert>

      <div className='grid gap-4 sm:grid-cols-3'>
        <MetricCard
          label='Черновики и готовые'
          value={drafts}
          icon={ClipboardMinus}
        />
        <MetricCard
          label='Требуют исправления'
          value={failed}
          icon={AlertTriangle}
          tone='danger'
        />
        <MetricCard
          label='Приняты ГИС МТ'
          value={accepted}
          icon={CheckCircle2}
          tone='success'
        />
      </div>

      <Card>
        <CardHeader className='gap-4'>
          <div>
            <CardTitle>Документы списания</CardTitle>
            <CardDescription>
              Сначала создайте черновик, добавьте полные Data Matrix и только
              затем передайте документ на подпись.
            </CardDescription>
          </div>
          <div className='flex flex-col gap-2 lg:flex-row'>
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                className='pl-9'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Номер документа, комментарий или ошибка'
              />
            </div>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className='w-full lg:w-56'>
                <SelectValue placeholder='Причина' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все причины</SelectItem>
                {Object.entries(REASONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className='w-full lg:w-52'>
                <SelectValue placeholder='Статус' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все статусы</SelectItem>
                {Object.entries(STATUSES).map(([value, item]) => (
                  <SelectItem key={value} value={value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant='outline' size='icon' onClick={loadDocuments}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              <span className='sr-only'>Обновить</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='space-y-3'>
              <Skeleton className='h-28 w-full' />
              <Skeleton className='h-28 w-full' />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyWriteOffs filtered={documents.length > 0} />
          ) : (
            <div className='space-y-3'>
              {filtered.map((document) => (
                <WriteOffCard
                  key={document.id}
                  document={document}
                  submitting={submittingId === document.id}
                  onSubmit={() => submitDocument(document.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateWriteOffDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadDocuments}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'default'
}: {
  label: string;
  value: number;
  icon: typeof ClipboardMinus;
  tone?: 'default' | 'success' | 'danger';
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
              : tone === 'success'
                ? 'text-emerald-600'
                : 'text-muted-foreground'
          }
        />
      </CardContent>
    </Card>
  );
}

function WriteOffCard({
  document,
  submitting,
  onSubmit
}: {
  document: WriteOffDocument;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const status = STATUSES[document.status ?? 'DRAFT'] ?? {
    label: document.status || 'Черновик',
    variant: 'outline' as const
  };
  const canSubmit = ['DRAFT', 'READY', 'FAILED', 'REJECTED'].includes(
    document.status ?? 'DRAFT'
  );

  return (
    <div className='flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-semibold'>
            {document.number || `Документ ${document.id.slice(0, 8)}`}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
          <Badge variant='outline'>
            {REASONS[document.reason ?? ''] ||
              document.reason ||
              'Причина не указана'}
          </Badge>
        </div>
        <div className='text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm'>
          <span>Кодов: {document.codesCount ?? 0}</span>
          <span>
            Создан:{' '}
            {document.createdAt
              ? new Date(document.createdAt).toLocaleString('ru-RU')
              : 'нет данных'}
          </span>
          {document.submittedAt && (
            <span>
              Отправлен:{' '}
              {new Date(document.submittedAt).toLocaleString('ru-RU')}
            </span>
          )}
        </div>
        {document.comment && <p className='mt-2 text-sm'>{document.comment}</p>}
        {document.error && (
          <div className='text-destructive mt-2 flex items-start gap-2 text-sm'>
            <XCircle className='mt-0.5 h-4 w-4 shrink-0' />
            <span>{document.error}</span>
          </div>
        )}
      </div>
      {canSubmit && (
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? <Loader2 className='animate-spin' /> : <Send />}
          {document.status === 'FAILED' || document.status === 'REJECTED'
            ? 'Отправить повторно'
            : 'Передать на подпись'}
        </Button>
      )}
    </div>
  );
}

function EmptyWriteOffs({ filtered }: { filtered: boolean }) {
  return (
    <div className='flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center'>
      <ClipboardMinus className='text-muted-foreground mb-4 h-10 w-10' />
      <h3 className='font-semibold'>
        {filtered
          ? 'По фильтрам ничего не найдено'
          : 'Документов списания пока нет'}
      </h3>
      <p className='text-muted-foreground mt-2 max-w-lg text-sm'>
        {filtered
          ? 'Измените поисковый запрос, причину или статус.'
          : 'Создавайте списание только при фактическом браке, утрате, истечении срока или другой подтверждённой причине. Для обычной продажи используется кассовый чек.'}
      </p>
    </div>
  );
}

function CreateWriteOffDialog({
  projectId,
  open,
  onOpenChange,
  onCreated
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [reason, setReason] = useState('DAMAGED');
  const [comment, setComment] = useState('');
  const [codesText, setCodesText] = useState('');
  const [saving, setSaving] = useState(false);
  const codes = codesText
    .split(/\r?\n/)
    .map((code) => code.trim())
    .filter(Boolean);

  const create = async () => {
    if (codes.length === 0) {
      toast.error('Добавьте хотя бы один полный код Data Matrix');
      return;
    }
    if (new Set(codes).size !== codes.length) {
      toast.error('В списке есть повторяющиеся коды');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/write-offs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, comment: comment.trim() || null, codes })
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось создать документ');
      toast.success('Черновик списания создан');
      setComment('');
      setCodesText('');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось создать документ'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Новое списание</DialogTitle>
          <DialogDescription>
            Добавьте фактически списываемые упаковки. Один полный Data Matrix —
            одна строка. После создания документ останется черновиком.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Причина вывода из оборота</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='write-off-codes'>Data Matrix</Label>
            <Textarea
              id='write-off-codes'
              value={codesText}
              onChange={(event) => setCodesText(event.target.value)}
              placeholder={'Отсканируйте первый код\nОтсканируйте второй код'}
              rows={7}
              className='font-mono text-xs'
            />
            <p className='text-muted-foreground text-xs'>
              Распознано уникальных строк: {new Set(codes).size}. GTIN без
              серийного номера не является кодом конкретной упаковки.
            </p>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='write-off-comment'>Основание или комментарий</Label>
            <Textarea
              id='write-off-comment'
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder='Например: акт о повреждении №…'
              rows={3}
            />
          </div>
          <Alert>
            <AlertTriangle />
            <AlertDescription>
              Проверьте физические упаковки и основание. После принятия
              документа ГИС МТ коды будут выведены из оборота.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={create} disabled={saving}>
            {saving && <Loader2 className='animate-spin' />}
            Создать черновик
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
