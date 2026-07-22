'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

interface CatalogImportDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void> | void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function CatalogImportDialog({
  projectId,
  open,
  onOpenChange,
  onImported
}: CatalogImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Выберите файл в формате CSV');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      toast.error('Размер CSV не должен превышать 5 МБ');
      return;
    }
    setFile(nextFile);
    setResult(null);
  }

  function downloadTemplate() {
    const csv = [
      'name;price;sku;externalId;gtin;markingStatus;vatCode;stockOnHand',
      'Название товара;1990;SKU-001;tilda-product-id;04601234567890;MARKED_REQUIRED;4;10'
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gupil-catalog-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv() {
    if (!file) return;
    setImporting(true);
    setResult(null);
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
      if (!response.ok && response.status !== 207) {
        throw new Error(data.error || 'Не удалось импортировать каталог');
      }
      const nextResult: ImportResult = {
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        errors: data.errors ?? []
      };
      setResult(nextResult);
      await onImported();
      toast.success(
        `Импорт завершён: создано ${nextResult.created}, обновлено ${nextResult.updated}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Ошибка импорта каталога'
      );
    } finally {
      setImporting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !importing) {
      setFile(null);
      setResult(null);
      setDragging(false);
      if (inputRef.current) inputRef.current.value = '';
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Импорт товаров из CSV</DialogTitle>
          <DialogDescription>
            Массово добавьте товары или обновите GTIN, НДС, тип маркировки и
            остатки. Существующие позиции ищутся сначала по External ID Tilda,
            затем по SKU; отсутствующие позиции создаются.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <Alert>
            <FileSpreadsheet />
            <AlertTitle>Что должно быть в файле</AlertTitle>
            <AlertDescription>
              <p>
                Обязательные колонки: <b>name</b> и <b>price</b>. Допустимы{' '}
                <b>sku</b>, <b>externalId</b>, <b>gtin</b>, <b>markingStatus</b>
                , <b>vatCode</b> и <b>stockOnHand</b>. Разделитель — запятая или
                точка с запятой, до 10 000 строк и 5 МБ.
              </p>
              <Button
                type='button'
                variant='link'
                className='h-auto px-0'
                onClick={downloadTemplate}
              >
                <Download className='h-4 w-4' /> Скачать готовый шаблон
              </Button>
            </AlertDescription>
          </Alert>

          <div
            role='button'
            tabIndex={0}
            className={cn(
              'focus-visible:ring-ring flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors outline-none focus-visible:ring-2',
              dragging && 'border-primary bg-primary/5',
              file && 'border-green-600 bg-green-50/60 dark:bg-green-950/20'
            )}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type='file'
              accept='.csv,text/csv'
              className='hidden'
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            {file ? (
              <>
                <FileSpreadsheet className='mb-3 h-10 w-10 text-green-600' />
                <div className='font-medium'>{file.name}</div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  {(file.size / 1024).toFixed(1)} КБ · нажмите, чтобы заменить
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='mt-3'
                  onClick={(event) => {
                    event.stopPropagation();
                    setFile(null);
                    setResult(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                >
                  <X className='h-4 w-4' /> Убрать файл
                </Button>
              </>
            ) : (
              <>
                <Upload className='text-muted-foreground mb-3 h-10 w-10' />
                <div className='font-medium'>Перетащите CSV сюда</div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  или нажмите, чтобы выбрать файл
                </div>
              </>
            )}
          </div>

          {result && (
            <Alert variant={result.errors.length ? 'destructive' : 'default'}>
              {result.errors.length ? <AlertCircle /> : <CheckCircle2 />}
              <AlertTitle>
                Создано: {result.created} · обновлено: {result.updated}
              </AlertTitle>
              <AlertDescription>
                {result.errors.length ? (
                  <div className='max-h-28 overflow-y-auto'>
                    {result.errors.slice(0, 10).map((error, index) => (
                      <div key={`${index}-${error}`}>{error}</div>
                    ))}
                    {result.errors.length > 10 && (
                      <div>И ещё ошибок: {result.errors.length - 10}</div>
                    )}
                  </div>
                ) : (
                  'Все строки обработаны без ошибок.'
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={importing}
            onClick={() => handleOpenChange(false)}
          >
            {result ? 'Закрыть' : 'Отмена'}
          </Button>
          <Button
            type='button'
            disabled={!file || importing}
            onClick={() => void importCsv()}
          >
            {importing ? <Loader2 className='animate-spin' /> : <Upload />}
            {importing ? 'Импортируем…' : 'Импортировать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
