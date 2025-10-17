/**
 * @file: src/features/workflow/components/workflow-header.tsx
 * @description: Компонент заголовка для конструктора workflow, включает управление workflow
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, lucide-react
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  Loader2,
  Play,
  Square
} from 'lucide-react';
import type { Workflow } from '@/types/workflow';

interface WorkflowHeaderProps {
  projectId: string;
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  selectedWorkflowId: string | null;
  onWorkflowSelect: (id: string) => void;
  onWorkflowCreate: (name: string, description?: string) => Promise<Workflow | undefined>;
  onWorkflowLoad: (id: string) => void;
  onWorkflowSave: () => void;
  onWorkflowDelete: (id: string) => void;
  onWorkflowExport: (workflow: Workflow) => void;
  onWorkflowImport: (file: File) => void;
  onWorkflowToggleActive: (id: string, isActive: boolean) => void;
  isSaving?: boolean;
}

export function WorkflowHeader({
  projectId,
  workflows,
  currentWorkflow,
  selectedWorkflowId,
  onWorkflowSelect,
  onWorkflowCreate,
  onWorkflowLoad,
  onWorkflowSave,
  onWorkflowDelete,
  onWorkflowExport,
  onWorkflowImport,
  onWorkflowToggleActive,
  isSaving = false
}: WorkflowHeaderProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Имя workflow не может быть пустым.',
        variant: 'destructive'
      });
      return;
    }
    await onWorkflowCreate(newWorkflowName, newWorkflowDescription);
    setIsCreateDialogOpen(false);
    setNewWorkflowName('');
    setNewWorkflowDescription('');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      await onWorkflowImport(file);
      setIsImportDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the input
      }
    }
  };

  return (
    <header className='flex items-center justify-between border-b bg-background p-3 shadow-sm'>
      <div className='flex items-center gap-3'>
        <h1 className='text-xl font-bold'>Конструктор Workflow</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' className='flex items-center gap-2'>
              {currentWorkflow ? currentWorkflow.name : 'Выберите workflow'}
              <ChevronDown className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Мои workflow</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workflows.length > 0 ? (
              workflows.map((workflow) => (
                <DropdownMenuItem
                  key={workflow.id}
                  onSelect={() => onWorkflowLoad(workflow.id)}
                  className={currentWorkflow?.id === workflow.id ? 'bg-accent' : ''}
                >
                  {workflow.name}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>Нет workflow</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setIsCreateDialogOpen(true)}>
              <Plus className='mr-2 h-4 w-4' /> Создать новый
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsImportDialogOpen(true)}>
              <Upload className='mr-2 h-4 w-4' /> Импортировать
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='flex items-center gap-2'>
        {currentWorkflow && (
          <>
            <Button
              variant={currentWorkflow.isActive ? 'default' : 'outline'}
              onClick={() => onWorkflowToggleActive(currentWorkflow.id, !currentWorkflow.isActive)}
            >
              {currentWorkflow.isActive ? (
                <Square className='mr-2 h-4 w-4' />
              ) : (
                <Play className='mr-2 h-4 w-4' />
              )}
              {currentWorkflow.isActive ? 'Деактивировать' : 'Активировать'}
            </Button>
            <Button
              variant='outline'
              onClick={onWorkflowSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Save className='mr-2 h-4 w-4' />
              )}
              Сохранить
            </Button>
            <Button
              variant='outline'
              onClick={() => onWorkflowExport(currentWorkflow)}
            >
              <Download className='mr-2 h-4 w-4' /> Экспорт
            </Button>
            <Button
              variant='destructive'
              onClick={() => onWorkflowDelete(currentWorkflow.id)}
            >
              <Trash2 className='mr-2 h-4 w-4' /> Удалить
            </Button>
          </>
        )}
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новый workflow</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='name' className='text-right'>
                Имя
              </Label>
              <Input
                id='name'
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                className='col-span-3'
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='description' className='text-right'>
                Описание
              </Label>
              <Textarea
                id='description'
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                className='col-span-3'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsCreateDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateWorkflow}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Workflow Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импортировать workflow</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <Label htmlFor='workflowFile' className='text-center'>
              Выберите JSON файл workflow для импорта
            </Label>
            <Input
              id='workflowFile'
              type='file'
              accept='.json'
              onChange={handleFileChange}
              ref={fileInputRef}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsImportDialogOpen(false)}>
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
