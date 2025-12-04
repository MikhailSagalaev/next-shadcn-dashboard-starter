/**
 * @file: user-metadata-section.tsx
 * @description: Компонент для отображения и редактирования metadata пользователя
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-12-04
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserMetadataSectionProps {
  userId: string;
  projectId: string;
  initialMetadata?: Record<string, any>;
  readOnly?: boolean;
  onMetadataChange?: (metadata: Record<string, any>) => void;
}

interface MetadataEntry {
  key: string;
  value: string;
  isEditing?: boolean;
  isNew?: boolean;
}

export function UserMetadataSection({
  userId,
  projectId,
  initialMetadata = {},
  readOnly = false,
  onMetadataChange
}: UserMetadataSectionProps) {
  const { toast } = useToast();
  const [metadata, setMetadata] =
    useState<Record<string, any>>(initialMetadata);
  const [entries, setEntries] = useState<MetadataEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Загрузка metadata при монтировании
  useEffect(() => {
    loadMetadata();
  }, [userId, projectId]);

  // Преобразование metadata в entries
  useEffect(() => {
    const newEntries = Object.entries(metadata).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      isEditing: false,
      isNew: false
    }));
    setEntries(newEntries);
  }, [metadata]);

  const loadMetadata = async () => {
    if (!userId || !projectId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/users/${userId}/metadata`
      );

      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata || {});
      }
    } catch (error) {
      console.error('Failed to load metadata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMetadata = async (key: string, value: any) => {
    if (!userId || !projectId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/users/${userId}/metadata`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata || {});
        onMetadataChange?.(data.metadata || {});

        toast({
          title: 'Сохранено',
          description: `Поле "${key}" успешно обновлено`
        });
      } else {
        throw new Error('Failed to save metadata');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить данные',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMetadataKey = async (key: string) => {
    if (!userId || !projectId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/users/${userId}/metadata`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: null })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata || {});
        onMetadataChange?.(data.metadata || {});

        toast({
          title: 'Удалено',
          description: `Поле "${key}" удалено`
        });
      } else {
        throw new Error('Failed to delete metadata key');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить поле',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddField = async () => {
    if (!newKey.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название поля',
        variant: 'destructive'
      });
      return;
    }

    if (metadata[newKey] !== undefined) {
      toast({
        title: 'Ошибка',
        description: 'Поле с таким названием уже существует',
        variant: 'destructive'
      });
      return;
    }

    await saveMetadata(newKey.trim(), newValue.trim() || '');
    setNewKey('');
    setNewValue('');
  };

  const handleStartEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleSaveEdit = async () => {
    if (editingKey) {
      await saveMetadata(editingKey, editValue);
      setEditingKey(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  if (isLoading && entries.length === 0) {
    return (
      <div className='flex items-center justify-center py-4'>
        <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        <span className='text-muted-foreground ml-2 text-sm'>Загрузка...</span>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Label className='text-sm font-medium'>Дополнительные данные</Label>
        {entries.length > 0 && (
          <Badge variant='secondary'>{entries.length} полей</Badge>
        )}
      </div>

      {entries.length > 0 ? (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[40%]'>Поле</TableHead>
                <TableHead className='w-[40%]'>Значение</TableHead>
                {!readOnly && (
                  <TableHead className='w-[20%]'>Действия</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.key}>
                  <TableCell className='font-medium'>{entry.key}</TableCell>
                  <TableCell>
                    {editingKey === entry.key ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className='h-8'
                        autoFocus
                      />
                    ) : (
                      <span className='text-muted-foreground'>
                        {entry.value || '-'}
                      </span>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className='flex items-center gap-1'>
                        {editingKey === entry.key ? (
                          <>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={handleSaveEdit}
                              disabled={isLoading}
                            >
                              <Check className='h-4 w-4 text-green-600' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={handleCancelEdit}
                            >
                              <X className='h-4 w-4 text-red-600' />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={() =>
                                handleStartEdit(entry.key, entry.value)
                              }
                              disabled={isLoading}
                            >
                              <Edit2 className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='text-destructive hover:text-destructive h-7 w-7'
                              onClick={() => deleteMetadataKey(entry.key)}
                              disabled={isLoading}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className='text-muted-foreground py-2 text-sm'>
          Нет дополнительных данных
        </p>
      )}

      {/* Форма добавления нового поля */}
      {!readOnly && (
        <div className='flex items-end gap-2 border-t pt-2'>
          <div className='flex-1'>
            <Label className='text-muted-foreground text-xs'>
              Название поля
            </Label>
            <Input
              placeholder='например: comment'
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className='mt-1 h-8'
            />
          </div>
          <div className='flex-1'>
            <Label className='text-muted-foreground text-xs'>Значение</Label>
            <Input
              placeholder='значение'
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className='mt-1 h-8'
            />
          </div>
          <Button
            size='sm'
            onClick={handleAddField}
            disabled={isLoading || !newKey.trim()}
          >
            <Plus className='mr-1 h-4 w-4' />
            Добавить
          </Button>
        </div>
      )}
    </div>
  );
}
