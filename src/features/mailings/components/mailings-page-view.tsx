/**
 * @file: src/features/mailings/components/mailings-page-view.tsx
 * @description: Компонент страницы управления рассылками
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { MailingFormDialog } from './mailing-form-dialog';

interface MailingsPageViewProps {
  projectId: string;
}

export function MailingsPageView({ projectId }: MailingsPageViewProps) {
  const router = useRouter();
  const [mailings, setMailings] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMailing, setEditingMailing] = useState<any>(null);

  useEffect(() => {
    // Загрузка рассылок и сегментов
    Promise.all([
      fetch(`/api/projects/${projectId}/mailings`).then((res) => res.json()),
      fetch(`/api/projects/${projectId}/segments`).then((res) => res.json())
    ])
      .then(([mailingsData, segmentsData]) => {
        setMailings(mailingsData.mailings || mailingsData.segments || []);
        setSegments(segmentsData.segments || segmentsData.mailings || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  const handleCreate = () => {
    setEditingMailing(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingMailing(null);
    // Обновляем список рассылок
    fetch(`/api/projects/${projectId}/mailings`)
      .then((res) => res.json())
      .then((data) => {
        setMailings(data.mailings || []);
      });
  };

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex items-center justify-between'>
        <Heading title='Рассылки' description='Управление рассылками' />
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          Создать рассылку
        </Button>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Рассылки</CardTitle>
          <CardDescription>Всего: {mailings.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Загрузка...</div>
          ) : mailings.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              Нет рассылок
            </div>
          ) : (
            <div className='space-y-2'>
              {mailings.map((mailing) => (
                <div key={mailing.id} className='border rounded p-4'>
                  <div className='font-medium'>{mailing.name}</div>
                  <div className='text-sm text-muted-foreground'>{mailing.type}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MailingFormDialog
        projectId={projectId}
        open={formOpen}
        onOpenChange={setFormOpen}
        mailing={editingMailing}
        segments={segments}
      />
    </div>
  );
}

