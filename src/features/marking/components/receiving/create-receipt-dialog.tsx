'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CreateReceiptDialog({
  projectId,
  onCreated
}: {
  projectId: string;
  onCreated: (id?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierInn, setSupplierInn] = useState('');
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [expectedUnits, setExpectedUnits] = useState('');
  const [notes, setNotes] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentNumber: documentNumber.trim() || undefined,
          supplierName: supplierName.trim(),
          supplierInn: supplierInn.trim() || undefined,
          documentDate,
          expectedUnits: expectedUnits ? Number(expectedUnits) : undefined,
          notes: notes.trim() || undefined
        })
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось создать приёмку');
      toast.success('Приёмка создана');
      setOpen(false);
      setDocumentNumber('');
      setSupplierName('');
      setSupplierInn('');
      setExpectedUnits('');
      setNotes('');
      onCreated(data.receipt?.id ?? data.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось создать приёмку'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Новая приёмка
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Новая приёмка</DialogTitle>
            <DialogDescription>
              Создайте рабочий документ, затем откройте его и отсканируйте Data
              Matrix каждой фактически полученной упаковки.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-5 sm:grid-cols-2'>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='supplier-name'>Поставщик</Label>
              <Input
                id='supplier-name'
                required
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder='Название организации или ИП'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='document-number'>Номер УПД</Label>
              <Input
                id='document-number'
                required
                value={documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
                placeholder='Например, УПД-184'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='supplier-inn'>ИНН поставщика</Label>
              <Input
                id='supplier-inn'
                inputMode='numeric'
                value={supplierInn}
                onChange={(event) => setSupplierInn(event.target.value)}
                placeholder='10 или 12 цифр'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='document-date'>Дата документа</Label>
              <Input
                id='document-date'
                type='date'
                required
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='expected-units'>Упаковок по документу</Label>
              <Input
                id='expected-units'
                type='number'
                min={0}
                value={expectedUnits}
                onChange={(event) => setExpectedUnits(event.target.value)}
                placeholder='Необязательно'
              />
            </div>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='receipt-notes'>Комментарий</Label>
              <Textarea
                id='receipt-notes'
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder='Номер поставки, склад, ответственный или особые условия'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={
                saving || !supplierName.trim() || !documentNumber.trim()
              }
            >
              {saving && <Loader2 className='animate-spin' />} Создать и
              сканировать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
