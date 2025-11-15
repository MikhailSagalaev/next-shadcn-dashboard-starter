/**
 * @file: src/features/segments/components/segment-form-dialog.tsx
 * @description: Форма создания/редактирования сегмента с конструктором условий
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SegmentRuleBuilder, type SegmentRule } from './segment-rule-builder';
import { useToast } from '@/hooks/use-toast';

interface SegmentFormDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment?: {
    id: string;
    name: string;
    description?: string | null;
    type: 'MANUAL' | 'AUTO' | 'DYNAMIC';
    isActive: boolean;
    rules: any;
  } | null;
}

export function SegmentFormDialog({
  projectId,
  open,
  onOpenChange,
  segment
}: SegmentFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'MANUAL' | 'AUTO' | 'DYNAMIC'>('AUTO');
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<SegmentRule | SegmentRule[]>([]);

  useEffect(() => {
    if (segment) {
      setName(segment.name);
      setDescription(segment.description || '');
      setType(segment.type);
      setIsActive(segment.isActive);
      setRules(segment.rules || []);
    } else {
      setName('');
      setDescription('');
      setType('AUTO');
      setIsActive(true);
      setRules([]);
    }
  }, [segment, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = segment
        ? `/api/projects/${projectId}/segments/${segment.id}`
        : `/api/projects/${projectId}/segments`;
      const method = segment ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          type,
          isActive,
          rules: Array.isArray(rules) && rules.length === 0 ? [] : rules,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения сегмента');
      }

      toast({
        title: 'Успешно',
        description: segment ? 'Сегмент обновлен' : 'Сегмент создан',
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить сегмент',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{segment ? 'Редактировать сегмент' : 'Создать сегмент'}</DialogTitle>
          <DialogDescription>
            {segment
              ? 'Измените параметры сегмента'
              : 'Создайте новый сегмент пользователей с условиями'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='name'>Название *</Label>
              <Input
                id='name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder='Например: VIP клиенты'
              />
            </div>
            <div>
              <Label htmlFor='type'>Тип сегмента</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='MANUAL'>Ручной</SelectItem>
                  <SelectItem value='AUTO'>Автоматический</SelectItem>
                  <SelectItem value='DYNAMIC'>Динамический</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor='description'>Описание</Label>
            <Textarea
              id='description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Описание сегмента'
              rows={3}
            />
          </div>
          {type !== 'MANUAL' && (
            <div>
              <SegmentRuleBuilder rules={rules} onChange={setRules} />
            </div>
          )}
          <div className='flex items-center justify-between'>
            <Label htmlFor='isActive'>Активен</Label>
            <Switch id='isActive' checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type='submit' disabled={loading || !name}>
              {loading ? 'Сохранение...' : segment ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

