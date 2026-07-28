'use client';

import { useState } from 'react';
import { CheckCircle2, FileCheck2, Loader2 } from 'lucide-react';
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

export function ManualComplianceConfirmDialog({
  projectId,
  documentId,
  documentNumber,
  onConfirmed,
  triggerLabel = 'Подтвердить результат'
}: {
  projectId: string;
  documentId: string;
  documentNumber?: string | null;
  onConfirmed: () => Promise<void>;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/compliance-documents/${documentId}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalId: externalId.trim(),
            confirmed: true
          })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось подтвердить документ');
      }
      toast.success('Документ подтверждён, складской реестр обновлён');
      setOpen(false);
      setExternalId('');
      await onConfirmed();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось подтвердить документ'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size='sm' onClick={() => setOpen(true)}>
        <FileCheck2 />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Подтверждение внешнего документа</DialogTitle>
            <DialogDescription>
              Документ {documentNumber || documentId} должен быть подписан УКЭП
              и принят оператором. Только после этого Gupil изменит состояние
              конкретной упаковки.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <CheckCircle2 />
            <AlertTitle>Проверьте квитанцию перед подтверждением</AlertTitle>
            <AlertDescription>
              Введите номер или идентификатор принятого документа из ЭДО/ГИС МТ.
              Созданный черновик и отправленный документ — не одно и то же.
            </AlertDescription>
          </Alert>
          <div className='space-y-2'>
            <Label htmlFor={`external-document-${documentId}`}>
              Номер документа или квитанции
            </Label>
            <Input
              id={`external-document-${documentId}`}
              value={externalId}
              onChange={(event) => setExternalId(event.target.value)}
              placeholder='Например, 2f8e… или УПД-1547'
              autoComplete='off'
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={() => void confirm()}
              disabled={saving || externalId.trim().length < 3}
            >
              {saving ? <Loader2 className='animate-spin' /> : <FileCheck2 />}
              Документ принят
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
