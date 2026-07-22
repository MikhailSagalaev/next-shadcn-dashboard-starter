'use client';

import { useState } from 'react';
import { Layers3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { YOOKASSA_VAT_CODES } from '@/lib/yookassa/receipt-options';
import { MARKING_STATUS_LABELS } from './product-catalog-types';

export function ProductBulkEditDialog({
  projectId,
  ids,
  open,
  onOpenChange,
  onSaved
}: {
  projectId: string;
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [markingStatus, setMarkingStatus] = useState('unchanged');
  const [vatCode, setVatCode] = useState('unchanged');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (markingStatus === 'unchanged' && vatCode === 'unchanged') {
      return toast.error('Выберите, что изменить');
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/products/bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          ...(markingStatus === 'unchanged' ? {} : { markingStatus }),
          ...(vatCode === 'unchanged' ? {} : { vatCode: Number(vatCode) })
        })
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось обновить товары');
      toast.success(`Обновлено товаров: ${data.updated}`);
      onOpenChange(false);
      setMarkingStatus('unchanged');
      setVatCode('unchanged');
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось обновить товары'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Массовая настройка товаров</DialogTitle>
          <DialogDescription>
            Изменения применятся к {ids.length} выбранным товарам. GTIN остаётся
            индивидуальным и заполняется отдельно для каждой позиции.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-5 py-2'>
          <div className='space-y-2'>
            <Label>Статус маркировки</Label>
            <Select value={markingStatus} onValueChange={setMarkingStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='unchanged'>Не изменять</SelectItem>
                {Object.entries(MARKING_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>Ставка НДС</Label>
            <Select value={vatCode} onValueChange={setVatCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='unchanged'>Не изменять</SelectItem>
                {YOOKASSA_VAT_CODES.map((item) => (
                  <SelectItem key={item.value} value={String(item.value)}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className='animate-spin' /> : <Layers3 />}
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
