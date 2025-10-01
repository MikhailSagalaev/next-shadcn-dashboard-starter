/**
 * @file: src/features/bot-constructor/components/bot-constructor-header.tsx
 * @description: Заголовок конструктора бота с управлением потоками
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Play,
  Settings,
  Plus,
  FileText,
  Eye,
  EyeOff,
  MoreHorizontal
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
  isPreviewMode: boolean;
  onPreviewToggle: (preview: boolean) => void;
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
  isPreviewMode,
  onPreviewToggle
}: BotConstructorHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');

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
    } catch (error) {
      // Error handled in hook
    }
  };

  // Handle delete flow
  const handleDeleteFlow = async () => {
    if (!currentFlow) return;

    try {
      await onFlowDelete(currentFlow.id);
      setShowDeleteDialog(false);
    } catch (error) {
      // Error handled in hook
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
              🤖 Конструктор бота
            </h1>
            {currentFlow && (
              <p className='text-muted-foreground text-sm'>
                {currentFlow.description ||
                  'Визуальный конструктор Telegram ботов'}
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
                    <div className='flex w-full items-center justify-between'>
                      <span>{flow.name}</span>
                      {flow.isActive && (
                        <Badge variant='secondary' className='ml-2 text-xs'>
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

            {/* Preview toggle */}
            <Button
              variant={isPreviewMode ? 'default' : 'outline'}
              size='sm'
              onClick={() => onPreviewToggle(!isPreviewMode)}
            >
              {isPreviewMode ? (
                <EyeOff className='mr-2 h-4 w-4' />
              ) : (
                <Eye className='mr-2 h-4 w-4' />
              )}
              {isPreviewMode ? 'Выйти из превью' : 'Превью'}
            </Button>

            {/* Save */}
            <Button
              variant='outline'
              size='sm'
              onClick={onFlowSave}
              disabled={!currentFlow}
            >
              <Save className='mr-2 h-4 w-4' />
              Сохранить
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
                  <DropdownMenuItem>
                    <FileText className='mr-2 h-4 w-4' />
                    Экспорт в JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className='mr-2 h-4 w-4' />
                    Настройки потока
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className='text-destructive'
                    onClick={() => setShowDeleteDialog(true)}
                  >
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
            <div>
              <Label htmlFor='flow-name'>Название потока</Label>
              <Input
                id='flow-name'
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder='Например: Основной чатбот'
              />
            </div>

            <div>
              <Label htmlFor='flow-description'>Описание (опционально)</Label>
              <Input
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
