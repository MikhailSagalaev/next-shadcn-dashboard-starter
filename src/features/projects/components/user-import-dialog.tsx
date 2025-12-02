/**
 * @file: src/features/projects/components/user-import-dialog.tsx
 * @description: Диалог импорта пользователей из CSV файла
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-12-02
 * @author: AI Assistant + User
 */

'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface UserImportDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ImportResult {
  success: boolean;
  stats: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  errors: string[];
}

export function UserImportDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess
}: UserImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [bonusExpiryDays, setBonusExpiryDays] = useState(90);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: 'Неверный формат',
          description: 'Пожалуйста, выберите CSV файл',
          variant: 'destructive'
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.csv')) {
      setFile(droppedFile);
      setResult(null);
    } else {
      toast({
        title: 'Неверный формат',
        description: 'Пожалуйста, выберите CSV файл',
        variant: 'destructive'
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('updateExisting', String(updateExisting));
      formData.append('bonusExpiryDays', String(bonusExpiryDays));

      const response = await fetch(`/api/projects/${projectId}/users/import`, {
        method: 'POST',
        body: formData
      });

      const data: ImportResult = await response.json();
      setResult(data);

      if (data.success) {
        toast({
          title: 'Импорт завершен',
          description: `Создано: ${data.stats.created}, обновлено: ${data.stats.updated}`
        });
        onSuccess?.();
      } else {
        toast({
          title: 'Ошибка импорта',
          description: data.errors[0] || 'Неизвестная ошибка',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить импорт',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  const successRate = result?.stats.total
    ? Math.round(
        ((result.stats.created + result.stats.updated) / result.stats.total) *
          100
      )
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Импорт пользователей из CSV</DialogTitle>
          <DialogDescription>
            Загрузите CSV файл с пользователями. Поддерживаемые поля: Email,
            Name, phone, bonuses
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Зона загрузки файла */}
          <div
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              file
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-muted-foreground/25 hover:border-primary'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type='file'
              accept='.csv'
              onChange={handleFileChange}
              className='hidden'
            />
            {file ? (
              <div className='flex items-center justify-center gap-2'>
                <FileText className='h-8 w-8 text-green-600' />
                <div className='text-left'>
                  <p className='font-medium'>{file.name}</p>
                  <p className='text-muted-foreground text-sm'>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className='text-muted-foreground mx-auto h-10 w-10' />
                <p className='text-muted-foreground mt-2 text-sm'>
                  Перетащите CSV файл сюда или нажмите для выбора
                </p>
              </>
            )}
          </div>

          {/* Настройки импорта */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='updateExisting' className='flex flex-col gap-1'>
                <span>Обновлять существующих</span>
                <span className='text-muted-foreground text-xs font-normal'>
                  Обновить данные если пользователь уже существует
                </span>
              </Label>
              <Switch
                id='updateExisting'
                checked={updateExisting}
                onCheckedChange={setUpdateExisting}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='bonusExpiry'>Срок действия бонусов (дней)</Label>
              <Input
                id='bonusExpiry'
                type='number'
                min={1}
                max={365}
                value={bonusExpiryDays}
                onChange={(e) => setBonusExpiryDays(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Результат импорта */}
          {result && (
            <div className='space-y-3'>
              <Progress value={successRate} className='h-2' />

              <div className='grid grid-cols-4 gap-2 text-center text-sm'>
                <div className='bg-muted rounded p-2'>
                  <div className='font-bold'>{result.stats.total}</div>
                  <div className='text-muted-foreground text-xs'>Всего</div>
                </div>
                <div className='rounded bg-green-100 p-2 dark:bg-green-900'>
                  <div className='font-bold text-green-600'>
                    {result.stats.created}
                  </div>
                  <div className='text-muted-foreground text-xs'>Создано</div>
                </div>
                <div className='rounded bg-blue-100 p-2 dark:bg-blue-900'>
                  <div className='font-bold text-blue-600'>
                    {result.stats.updated}
                  </div>
                  <div className='text-muted-foreground text-xs'>Обновлено</div>
                </div>
                <div className='rounded bg-red-100 p-2 dark:bg-red-900'>
                  <div className='font-bold text-red-600'>
                    {result.stats.errors}
                  </div>
                  <div className='text-muted-foreground text-xs'>Ошибок</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>
                    <div className='max-h-24 overflow-y-auto text-xs'>
                      {result.errors.slice(0, 5).map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                      {result.errors.length > 5 && (
                        <div>...и еще {result.errors.length - 5} ошибок</div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {result.success && result.stats.errors === 0 && (
                <Alert>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                  <AlertDescription>Импорт успешно завершен!</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose}>
            {result ? 'Закрыть' : 'Отмена'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Импорт...
                </>
              ) : (
                <>
                  <Upload className='mr-2 h-4 w-4' />
                  Импортировать
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
