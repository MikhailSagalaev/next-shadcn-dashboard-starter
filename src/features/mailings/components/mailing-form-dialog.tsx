/**
 * @file: src/features/mailings/components/mailing-form-dialog.tsx
 * @description: Форма создания/редактирования рассылки с редактором писем
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { MailingTemplateEditor } from './mailing-template-editor';
import { useToast } from '@/hooks/use-toast';

interface MailingFormDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailing?: {
    id: string;
    name: string;
    type: 'EMAIL' | 'SMS' | 'TELEGRAM' | 'WHATSAPP' | 'VIBER';
    segmentId?: string | null;
    templateId?: string | null;
  } | null;
  segments?: Array<{ id: string; name: string }>;
}

export function MailingFormDialog({
  projectId,
  open,
  onOpenChange,
  mailing,
  segments = []
}: MailingFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'EMAIL' | 'SMS' | 'TELEGRAM' | 'WHATSAPP' | 'VIBER'>('EMAIL');
  const [segmentId, setSegmentId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (mailing) {
      setName(mailing.name);
      setType(mailing.type);
      setSegmentId(mailing.segmentId || '');
      // Загружаем шаблон если есть
      if (mailing.templateId) {
        // TODO: загрузить шаблон
      }
    } else {
      setName('');
      setType('EMAIL');
      setSegmentId('');
      setSubject('');
      setBody('');
    }
  }, [mailing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Сначала создаем/обновляем шаблон
      let templateId = mailing?.templateId;

      if (subject && body) {
        const templateResponse = await fetch(
          `/api/projects/${projectId}/mailings/templates`,
          {
            method: templateId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: templateId,
              projectId,
              name: `${name} - шаблон`,
              subject,
              body,
              type,
            }),
          }
        );

        if (templateResponse.ok) {
          const templateData = await templateResponse.json();
          templateId = templateData.template?.id || templateData.id;
        }
      }

      // Затем создаем/обновляем рассылку
      const url = mailing
        ? `/api/projects/${projectId}/mailings/${mailing.id}`
        : `/api/projects/${projectId}/mailings`;
      const method = mailing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          segmentId: segmentId || undefined,
          templateId: templateId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения рассылки');
      }

      toast({
        title: 'Успешно',
        description: mailing ? 'Рассылка обновлена' : 'Рассылка создана',
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить рассылку',
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
          <DialogTitle>{mailing ? 'Редактировать рассылку' : 'Создать рассылку'}</DialogTitle>
          <DialogDescription>
            {mailing
              ? 'Измените параметры рассылки'
              : 'Создайте новую рассылку для сегмента пользователей'}
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
                placeholder='Например: Приветственное письмо'
              />
            </div>
            <div>
              <Label htmlFor='type'>Тип рассылки</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='EMAIL'>Email</SelectItem>
                  <SelectItem value='SMS'>SMS</SelectItem>
                  <SelectItem value='TELEGRAM'>Telegram</SelectItem>
                  <SelectItem value='WHATSAPP'>WhatsApp</SelectItem>
                  <SelectItem value='VIBER'>Viber</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor='segmentId'>Сегмент</Label>
            <Select value={segmentId} onValueChange={setSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder='Выберите сегмент (необязательно)' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>Все пользователи</SelectItem>
                {segments.map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <MailingTemplateEditor
            subject={subject}
            body={body}
            onSubjectChange={setSubject}
            onBodyChange={setBody}
          />
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type='submit' disabled={loading || !name || !subject || !body}>
              {loading ? 'Сохранение...' : mailing ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

