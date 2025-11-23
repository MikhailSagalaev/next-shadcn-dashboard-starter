/**
 * @file: src/features/segments/components/segments-page-view.tsx
 * @description: Компонент страницы управления сегментами
 * @project: SaaS Bonus System
 * @dependencies: React, SegmentsTable
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { SegmentsTable } from './segments-table';
import { SegmentFormDialog } from './segment-form-dialog';
import { useToast } from '@/hooks/use-toast';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';

interface SegmentsPageViewProps {
  projectId: string;
}

interface Segment {
  id: string;
  name: string;
  description?: string | null;
  type: 'MANUAL' | 'AUTO' | 'DYNAMIC';
  isActive: boolean;
  memberCount: number;
  rules?: any;
  createdAt: Date;
  _count?: {
    members: number;
  };
}

export function SegmentsPageView({ projectId }: SegmentsPageViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  const fetchSegments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      if (search) {
        params.append('search', search);
      }

      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      if (activeFilter !== 'all') {
        params.append('isActive', activeFilter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(
        `/api/projects/${projectId}/segments?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Ошибка загрузки сегментов');
      }

      const data = await response.json();
      setSegments(data.segments || []);
      setTotalCount(data.pagination?.total || 0);
    } catch (error) {
      console.error('Ошибка загрузки сегментов:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить сегменты',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize, search, typeFilter, activeFilter, toast]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const handleDelete = async (segmentId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот сегмент?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/segments/${segmentId}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка удаления сегмента');
      }

      toast({
        title: 'Успешно',
        description: 'Сегмент удален'
      });

      fetchSegments();
    } catch (error) {
      console.error('Ошибка удаления сегмента:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить сегмент',
        variant: 'destructive'
      });
    }
  };

  const handleSegmentClick = (segment: Segment) => {
    router.push(`/dashboard/projects/${projectId}/segments/${segment.id}`);
  };

  const handleEdit = (segment: Segment) => {
    setEditingSegment(segment);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingSegment(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingSegment(null);
    fetchSegments();
  };

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <Heading
            title='Сегменты пользователей'
            description='Управление сегментами пользователей для таргетированных рассылок'
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          Создать сегмент
        </Button>
      </div>

      <Separator />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-4'>
            <div className='min-w-[200px] flex-1'>
              <div className='relative'>
                <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
                <Input
                  placeholder='Поиск по названию...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='pl-8'
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Тип сегмента' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все типы</SelectItem>
                <SelectItem value='MANUAL'>Ручной</SelectItem>
                <SelectItem value='AUTO'>Автоматический</SelectItem>
                <SelectItem value='DYNAMIC'>Динамический</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Статус' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все статусы</SelectItem>
                <SelectItem value='active'>Активные</SelectItem>
                <SelectItem value='inactive'>Неактивные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Сегменты</CardTitle>
          <CardDescription>
            Список всех сегментов проекта. Всего: {totalCount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SegmentsTable
            data={segments}
            loading={loading}
            totalCount={totalCount}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onSegmentClick={handleSegmentClick}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <SegmentFormDialog
        projectId={projectId}
        open={formOpen}
        onOpenChange={setFormOpen}
        segment={editingSegment || undefined}
      />
    </div>
  );
}
