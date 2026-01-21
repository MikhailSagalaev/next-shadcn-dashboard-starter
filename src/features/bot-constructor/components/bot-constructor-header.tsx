/**
 * @file: src/features/bot-constructor/components/bot-constructor-header.tsx
 * @description: Заголовок конструктора бота с управлением потоками
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui components
 * @created: 2025-09-30
 * @updated: 2025-10-03
 * @author: AI Assistant + User
 */

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Plus,
  Eye,
  EyeOff,
  MoreHorizontal,
  Download,
  Upload,
  Trash2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import type { BotFlow, CreateFlowRequest } from '@/types/bot-constructor';

interface BotConstructorHeaderProps {
  projectId: string;
  flows: BotFlow[];
  currentFlow: BotFlow | null;
  selectedFlowId: string | null;
  onFlowSelect: (flowId: string | null) => void;
  onFlowCreate: (data: CreateFlowRequest) => Promise<BotFlow>;
  onFlowLoad: (flowId: string) => Promise<BotFlow | null>;
  onFlowSave: () => Promise<void>;
  onFlowDelete: (flowId: string) => Promise<void>;
  onFlowExport: () => Promise<void>;
  onFlowImport: (file: File) => Promise<BotFlow>;
  onFlowPublish: () => void;
  isPreviewMode: boolean;
  onPreviewToggle: () => void;
  isSaving?: boolean;
}

export function BotConstructorHeader({
  projectId,
  flows,
  currentFlow,
  selectedFlowId,
  onFlowSelect,
  onFlowCreate,
  onFlowLoad,
  onFlowSave,
  onFlowDelete,
  onFlowExport,
  onFlowImport,
  onFlowPublish,
  isPreviewMode,
  onPreviewToggle,
  isSaving = false
}: BotConstructorHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle flow selection
  const handleFlowSelect = async (flowId: string) => {
    onFlowSelect(flowId);
    await onFlowLoad(flowId);
  };

  // Handle create flow
  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название потока',
        variant: 'destructive'
      });
      return;
    }

    try {
      await onFlowCreate({
        name: newFlowName.trim(),
        description: newFlowDescription.trim() || undefined
      });

      setShowCreateDialog(false);
      setNewFlowName('');
      setNewFlowDescription('');

      toast({
        title: 'Успех',
        description: 'Поток создан'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать поток',
        variant: 'destructive'
      });
    }
  };

  // Handle delete flow
  const handleDeleteFlow = async () => {
    if (!currentFlow) return;

    try {
      await onFlowDelete(currentFlow.id);
      setShowDeleteDialog(false);

      toast({
        title: 'Успех',
        description: 'Поток удалён'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить поток',
        variant: 'destructive'
      });
    }
  };

  // Handle file import
  const handleFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await onFlowImport(file);

      toast({
        title: 'Успех',
        description: 'Поток импортирован'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось импортировать поток',
        variant: 'destructive'
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Header */}
      <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur'>
        <div className='flex h-16 items-center px-4'>
          {/* Back button */}
          <Button
            variant='ghost'
            size='sm'
            onClick={() => router.back()}
            className='mr-4'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Назад
          </Button>

          {/* Title */}
          <div className='flex-1'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Конструктор бота
            </h1>
            {currentFlow && (
              <p className='text-muted-foreground text-sm'>
                {currentFlow.description || 'Редактирование потока'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className='flex items-center space-x-2'>
            {/* Flow selector */}
            <Select
              value={selectedFlowId || ''}
              onValueChange={handleFlowSelect}
            >
              <SelectTrigger className='w-[200px]'>
                <SelectValue placeholder='Выберите поток' />
              </SelectTrigger>
              <SelectContent>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    <div className='flex items-center gap-2'>
                      <span>{flow.name}</span>
                      {flow.isActive && (
                        <Badge variant='default' className='ml-2'>
                          Активен
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Create flow */}
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className='mr-2 h-4 w-4' />
              Новый поток
            </Button>

            {/* Export/Import */}
            {currentFlow && (
              <>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={onFlowExport}
                  disabled={isSaving}
                >
                  <Download className='mr-2 h-4 w-4' />
                  Экспорт
                </Button>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  <Upload className='mr-2 h-4 w-4' />
                  Импорт
                </Button>

                {/* Hidden file input for import */}
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.json'
                  style={{ display: 'none' }}
                  onChange={handleFileImport}
                />
              </>
            )}

            {/* Preview toggle */}
            <Button
              variant={isPreviewMode ? 'default' : 'outline'}
              size='sm'
              onClick={onPreviewToggle}
            >
              {isPreviewMode ? (
                <>
                  <EyeOff className='mr-2 h-4 w-4' />
                  Выйти из превью
                </>
              ) : (
                <>
                  <Eye className='mr-2 h-4 w-4' />
                  Превью
                </>
              )}
            </Button>

            {/* Publish */}
            <Button
              variant='default'
              size='sm'
              onClick={onFlowPublish}
              disabled={!currentFlow || isSaving}
            >
              <Upload className='mr-2 h-4 w-4' />
              Опубликовать
            </Button>

            {/* Save */}
            <Button
              variant='outline'
              size='sm'
              onClick={onFlowSave}
              disabled={!currentFlow || isSaving}
            >
              <Save className='mr-2 h-4 w-4' />
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>

            {/* More actions */}
            {currentFlow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm'>
                    <MoreHorizontal className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={onFlowExport}>
                    <Download className='mr-2 h-4 w-4' />
                    Экспорт в JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className='text-destructive'
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Удалить поток
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Create Flow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новый поток</DialogTitle>
            <DialogDescription>
              Создайте новый поток для вашего Telegram бота
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='flow-name'>Название потока</Label>
              <Input
                id='flow-name'
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder='Например: Основной чатбот'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='flow-description'>Описание (опционально)</Label>
              <Textarea
                id='flow-description'
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                placeholder='Краткое описание назначения потока'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowCreateDialog(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleCreateFlow}>Создать поток</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Flow Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить поток</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить поток "{currentFlow?.name}"? Это
              действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowDeleteDialog(false)}
            >
              Отмена
            </Button>
            <Button variant='destructive' onClick={handleDeleteFlow}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
