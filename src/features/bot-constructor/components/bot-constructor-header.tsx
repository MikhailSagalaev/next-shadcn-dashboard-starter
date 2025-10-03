/**
 * @file: src/features/bot-constructor/components/bot-constructor-header.tsx
 * @description: Заголовок конструктора бота с управлением потоками
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useRef } from 'react';
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
  MoreHorizontal,
  Download,
  Upload,
  TestTube
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
  DropdownMenuSeparator,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

  // Handle file import
  const handleFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await onFlowImport(file);
    } catch (error) {
      // Error handled in hook
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
              🤖 Конструктор бота
            </h1>
            <div className='flex items-center gap-2'>
              {currentFlow && (
                <p className='text-muted-foreground text-sm'>
                  {currentFlow.description ||
                    'Визуальный конструктор Telegram ботов'}
                </p>
              )}
              <div className='text-muted-foreground bg-muted rounded px-2 py-1 text-xs'>
                💡 Поток - это сценарий работы бота (диалог, команды, условия)
              </div>
              <div className='rounded bg-blue-50 px-2 py-1 text-xs text-blue-600'>
                🔗 После создания поток нужно активировать в настройках бота
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center space-x-2'>
            {/* Flow selector */}
            <Select
              selectedKeys={selectedFlowId ? [selectedFlowId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                handleFlowSelect(selected);
              }}
              placeholder='Выберите поток'
              className='w-[200px]'
            >
              {flows.map((flow) => (
                <SelectItem key={flow.id} value={flow.id}>
                  <div className='flex w-full items-center justify-between'>
                    <span>{flow.name}</span>
                    {flow.isActive && (
                      <Badge color='success' size='sm' className='ml-2'>
                        Активен
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </Select>

            {/* Create flow */}
            <Button
              variant='bordered'
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
                  variant='bordered'
                  size='sm'
                  onClick={onFlowExport}
                  disabled={isSaving}
                >
                  <Download className='mr-2 h-4 w-4' />
                  Экспорт
                </Button>

                <Button
                  variant='bordered'
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
                <EyeOff className='mr-2 h-4 w-4' />
              ) : (
                <Eye className='mr-2 h-4 w-4' />
              )}
              {isPreviewMode ? 'Выйти из превью' : 'Превью'}
            </Button>

            {/* Save */}
            <Button
              variant='bordered'
              size='sm'
              onClick={onFlowSave}
              disabled={!currentFlow}
            >
              <Save className='mr-2 h-4 w-4' />
              Сохранить
            </Button>

            {/* More actions */}
            {currentFlow && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant='bordered' size='sm'>
                    <MoreHorizontal className='h-4 w-4' />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label='Flow actions'>
                  <DropdownSection>
                    <DropdownItem
                      key='export'
                      startContent={<FileText className='h-4 w-4' />}
                    >
                      Экспорт в JSON
                    </DropdownItem>
                    <DropdownItem
                      key='settings'
                      startContent={<Settings className='h-4 w-4' />}
                    >
                      Настройки потока
                    </DropdownItem>
                  </DropdownSection>
                  <DropdownSection>
                    <DropdownItem
                      key='delete'
                      className='text-danger'
                      color='danger'
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      Удалить поток
                    </DropdownItem>
                  </DropdownSection>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      {/* Create Flow Modal */}
      <Modal isOpen={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <ModalContent>
          <ModalHeader>
            <h3 className='text-lg font-semibold'>Создать новый поток</h3>
            <p className='text-muted-foreground text-sm'>
              Создайте новый поток для вашего Telegram бота
            </p>
          </ModalHeader>

          <ModalBody>
            <div className='space-y-4'>
              <div>
                <label className='text-sm font-medium'>Название потока</label>
                <Input
                  value={newFlowName}
                  onValueChange={setNewFlowName}
                  placeholder='Например: Основной чатбот'
                />
              </div>

              <div>
                <label className='text-sm font-medium'>
                  Описание (опционально)
                </label>
                <Input
                  value={newFlowDescription}
                  onValueChange={setNewFlowDescription}
                  placeholder='Краткое описание назначения потока'
                />
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              variant='bordered'
              onClick={() => setShowCreateDialog(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleCreateFlow}>Создать поток</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Flow Modal */}
      <Modal isOpen={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <ModalContent>
          <ModalHeader>
            <h3 className='text-lg font-semibold'>Удалить поток</h3>
            <p className='text-muted-foreground text-sm'>
              Вы уверены, что хотите удалить поток "{currentFlow?.name}"? Это
              действие нельзя отменить.
            </p>
          </ModalHeader>

          <ModalFooter>
            <Button
              variant='bordered'
              onClick={() => setShowDeleteDialog(false)}
            >
              Отмена
            </Button>
            <Button color='danger' onClick={handleDeleteFlow}>
              Удалить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
