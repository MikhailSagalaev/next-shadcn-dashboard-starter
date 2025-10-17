/**
 * @file: src/features/projects/components/project-variables-manager.tsx
 * @description: Компонент для управления переменными проекта
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Copy, RefreshCw } from 'lucide-react';

interface ProjectVariable {
  key: string;
  value: string;
  description?: string;
  isSystem: boolean;
}

interface ProjectVariablesManagerProps {
  projectId: string;
}

export function ProjectVariablesManager({ projectId }: ProjectVariablesManagerProps) {
  const [variables, setVariables] = useState<ProjectVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<ProjectVariable | null>(null);

  // Форма для новой переменной
  const [newVariable, setNewVariable] = useState({
    key: '',
    value: '',
    description: ''
  });

  // Загрузка переменных
  const loadVariables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/variables`);
      const data = await response.json();
      
      if (response.ok) {
        setVariables(data.variables);
      } else {
        toast.error('Ошибка загрузки переменных');
      }
    } catch (error) {
      console.error('Error loading variables:', error);
      toast.error('Ошибка загрузки переменных');
    } finally {
      setLoading(false);
    }
  };

  // Инициализация системных переменных
  const initializeSystemVariables = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/variables/initialize`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success('Системные переменные инициализированы');
        await loadVariables();
      } else {
        toast.error('Ошибка инициализации переменных');
      }
    } catch (error) {
      console.error('Error initializing variables:', error);
      toast.error('Ошибка инициализации переменных');
    }
  };

  // Создание новой переменной
  const handleCreateVariable = async () => {
    if (!newVariable.key || !newVariable.value) {
      toast.error('Заполните ключ и значение переменной');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVariable)
      });

      if (response.ok) {
        toast.success('Переменная создана');
        setIsAddDialogOpen(false);
        setNewVariable({ key: '', value: '', description: '' });
        await loadVariables();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Ошибка создания переменной');
      }
    } catch (error) {
      console.error('Error creating variable:', error);
      toast.error('Ошибка создания переменной');
    }
  };

  // Обновление переменной
  const handleUpdateVariable = async () => {
    if (!editingVariable) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/variables/${editingVariable.key}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value: editingVariable.value,
            description: editingVariable.description
          })
        }
      );

      if (response.ok) {
        toast.success('Переменная обновлена');
        setIsEditDialogOpen(false);
        setEditingVariable(null);
        await loadVariables();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Ошибка обновления переменной');
      }
    } catch (error) {
      console.error('Error updating variable:', error);
      toast.error('Ошибка обновления переменной');
    }
  };

  // Удаление переменной
  const handleDeleteVariable = async (key: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту переменную?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/variables/${key}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Переменная удалена');
        await loadVariables();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Ошибка удаления переменной');
      }
    } catch (error) {
      console.error('Error deleting variable:', error);
      toast.error('Ошибка удаления переменной');
    }
  };

  // Копирование переменной в буфер обмена
  const copyVariableToClipboard = (key: string) => {
    navigator.clipboard.writeText(`{${key}}`);
    toast.success(`Скопировано: {${key}}`);
  };

  useEffect(() => {
    loadVariables();
  }, [projectId]);

  if (loading) {
    return <div className="p-4">Загрузка переменных...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Переменные проекта</CardTitle>
            <CardDescription>
              Используйте переменные в сообщениях бота: {'{'}variable_name{'}'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={initializeSystemVariables}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Инициализировать
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить переменную
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новая переменная</DialogTitle>
                  <DialogDescription>
                    Создайте новую переменную для использования в сообщениях бота
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="key">Ключ переменной</Label>
                    <Input
                      id="key"
                      placeholder="company_name"
                      value={newVariable.key}
                      onChange={(e) =>
                        setNewVariable({ ...newVariable, key: e.target.value })
                      }
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Только буквы, цифры и подчеркивание
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="value">Значение</Label>
                    <Input
                      id="value"
                      placeholder="Моя компания"
                      value={newVariable.value}
                      onChange={(e) =>
                        setNewVariable({ ...newVariable, value: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Описание (опционально)</Label>
                    <Textarea
                      id="description"
                      placeholder="Название компании для использования в сообщениях"
                      value={newVariable.description}
                      onChange={(e) =>
                        setNewVariable({
                          ...newVariable,
                          description: e.target.value
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleCreateVariable}>Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {variables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Нет переменных</p>
            <p className="text-sm mt-2">
              Нажмите "Инициализировать" для создания системных переменных
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключ</TableHead>
                <TableHead>Значение</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable) => (
                <TableRow key={variable.key}>
                  <TableCell className="font-mono text-sm">
                    {'{'}
                    {variable.key}
                    {'}'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {variable.value}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {variable.description || '—'}
                  </TableCell>
                  <TableCell>
                    {variable.isSystem ? (
                      <Badge variant="secondary">Системная</Badge>
                    ) : (
                      <Badge variant="outline">Пользовательская</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyVariableToClipboard(variable.key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingVariable(variable);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!variable.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVariable(variable.key)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Диалог редактирования */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Редактировать переменную</DialogTitle>
              <DialogDescription>
                Изменить значение переменной {editingVariable?.key}
              </DialogDescription>
            </DialogHeader>
            {editingVariable && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-value">Значение</Label>
                  <Input
                    id="edit-value"
                    value={editingVariable.value}
                    onChange={(e) =>
                      setEditingVariable({
                        ...editingVariable,
                        value: e.target.value
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Описание</Label>
                  <Textarea
                    id="edit-description"
                    value={editingVariable.description || ''}
                    onChange={(e) =>
                      setEditingVariable({
                        ...editingVariable,
                        description: e.target.value
                      })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingVariable(null);
                }}
              >
                Отмена
              </Button>
              <Button onClick={handleUpdateVariable}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

