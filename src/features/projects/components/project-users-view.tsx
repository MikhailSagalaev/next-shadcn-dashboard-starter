/**
 * @file: src/features/projects/components/project-users-view.tsx
 * @description: Компонент управления пользователями проекта
 * @project: SaaS Bonus System
 * @dependencies: React, data table components
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectUsers } from '@/features/bonuses/hooks/use-project-users';
import { BonusStatsCards } from '@/features/bonuses/components/bonus-stats-cards';
import {
  ArrowLeft,
  Plus,
  Users,
  Search,
  Gift,
  Minus,
  Calendar,
  Phone,
  Mail,
  User as UserIcon,
  Badge as BadgeIcon,
  Target,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Project, User, Bonus } from '@/types/bonus';
import { UserCreateDialog } from './user-create-dialog';
import { UsersTable } from '../../bonuses/components/users-table';
import { BonusAwardDialog } from './bonus-award-dialog';
import { EnhancedBulkActionsToolbar } from '@/features/bonuses/components/enhanced-bulk-actions-toolbar';
import { RichNotificationDialog } from '@/features/bonuses/components/rich-notification-dialog';

interface ProjectUsersViewProps {
  projectId: string;
}

interface UserWithBonuses extends User {
  totalBonuses: number;
  activeBonuses: number;
  lastActivity: Date | null;
  level?: any; // BonusLevel
  progressToNext?: {
    nextLevel: any; // BonusLevel
    amountNeeded: number;
    progressPercent: number;
  };
}

export function ProjectUsersView({ projectId }: ProjectUsersViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<
    'bonus_award' | 'bonus_deduct' | 'notification'
  >('bonus_award');

  // Users management hook
  const {
    users,
    isLoading: usersLoading,
    error: usersError,
    totalUsers,
    activeUsers,
    totalBonuses,
    currentPage,
    totalPages,
    loadUsers
  } = useProjectUsers({
    projectId,
    pageSize
  });

  // Обработчики пагинации
  const handlePageChange = useCallback(
    (page: number) => {
      loadUsers(page);
    },
    [loadUsers]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize);
      // При изменении размера страницы возвращаемся на первую страницу
      loadUsers(1);
    },
    [loadUsers]
  );

  // Stats data
  const statsData = {
    totalUsers,
    activeUsers,
    totalBonuses,
    expiringSoonBonuses: Math.floor(totalBonuses * 0.15), // Mock для демо
    monthlyGrowth: 12 // Mock для демо
  };

  // Dialog states
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showRichNotificationDialog, setShowRichNotificationDialog] =
    useState(false);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [showDeductionDialog, setShowDeductionDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithBonuses | null>(
    null
  );
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionDescription, setDeductionDescription] = useState('');
  const [isDeducting, setIsDeducting] = useState(false);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) return;
    if (!confirm(`Удалить выбранных пользователей (${selectedUsers.length})?`))
      return;
    try {
      const responses = await Promise.all(
        selectedUsers.map((uid) =>
          fetch(`/api/projects/${projectId}/users/${uid}`, { method: 'DELETE' })
        )
      );
      const ok = responses.every((r) => r.ok);
      if (ok) {
        setUsers((prev) => prev.filter((u) => !selectedUsers.includes(u.id)));
        setSelectedUsers([]);
        toast({ title: 'Пользователи удалены' });
      } else {
        toast({
          title: 'Часть пользователей не удалена',
          variant: 'destructive'
        });
      }
    } catch (e) {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  // Select all users
  const selectAllUsers = () => {
    setSelectedUsers(users.map((user) => user.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedUsers([]);
  };

  // Search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // TODO: Implement server-side search
    // For now, just update the state
  }, []);

  // Загружаем проект при монтировании
  useEffect(() => {
    const loadProject = async () => {
      try {
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProject(projectData);
        }
      } catch (error) {
        console.error('Ошибка загрузки проекта:', error);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // Функция для экспорта всех пользователей
  const handleExportAll = useCallback(async () => {
    try {
      setLoading(true);

      // Получаем все данные без пагинации
      const response = await fetch(
        `/api/projects/${projectId}/users?limit=10000`
      );
      if (!response.ok) {
        throw new Error('Не удалось получить данные пользователей');
      }

      const allUsers = await response.json();
      const usersArray = Array.isArray(allUsers?.users) ? allUsers.users : [];

      // Создаем CSV
      const headers = [
        'ID',
        'Имя',
        'Email',
        'Телефон',
        'Активные бонусы',
        'Всего бонусов',
        'Дата регистрации',
        'Статус',
        'Уровень'
      ];

      const csvData = usersArray.map((user: any) => [
        user.id || '',
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.email || '',
        user.email || '',
        user.phone || '',
        user.activeBonuses || 0,
        user.totalBonuses || 0,
        user.registeredAt
          ? new Date(user.registeredAt).toLocaleDateString('ru-RU')
          : '',
        user.isActive ? 'Активен' : 'Неактивен',
        user.currentLevel || 'Базовый'
      ]);

      // Добавляем заголовки
      csvData.unshift(headers);

      // Конвертируем в CSV строку
      const csvContent = csvData
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

      // Создаем и скачиваем файл
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `project-users-${projectId}-${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Экспорт завершен',
        description: `Экспортировано ${usersArray.length} пользователей`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      toast({
        title: 'Ошибка экспорта',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  const handleCreateUser = (newUser: UserWithBonuses) => {
    console.log('Создан новый пользователь в проекте:', newUser); // Для отладки

    // Добавляем пользователя в локальный список для мгновенного отображения
    setUsers((prevUsers) => [newUser, ...prevUsers]);

    // Перезагружаем данные из API через небольшую задержку для синхронизации
    setTimeout(() => {
      console.log('Перезагружаем пользователей проекта из API...');
      loadData();
    }, 1000);

    toast({
      title: 'Успех',
      description: 'Пользователь успешно добавлен'
    });
  };

  const handleBonusSuccess = () => {
    loadData(); // Перезагружаем данные для обновления балансов
    setSelectedUser(null);
  };

  const handleOpenBonusDialog = (user: UserWithBonuses) => {
    setSelectedUser(user);
    setShowBonusDialog(true);
  };

  const handleOpenDeductionDialog = (user: UserWithBonuses) => {
    setSelectedUser(user);
    setDeductionAmount('');
    setDeductionDescription('');
    setShowDeductionDialog(true);
  };

  const handleDeductionSubmit = async () => {
    if (!selectedUser || !deductionAmount || parseFloat(deductionAmount) <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Введите корректную сумму для списания',
        variant: 'destructive'
      });
      return;
    }

    if (parseFloat(deductionAmount) > selectedUser.activeBonuses) {
      toast({
        title: 'Ошибка',
        description: 'Недостаточно бонусов на балансе пользователя',
        variant: 'destructive'
      });
      return;
    }

    setIsDeducting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/users/${selectedUser.id}/bonuses/deduct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: parseFloat(deductionAmount),
            description:
              deductionDescription || 'Ручное списание через админ-панель'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка списания бонусов');
      }

      const result = await response.json();

      toast({
        title: 'Успешно',
        description: `Списано ${result.deducted.amount} бонусов`
      });

      setShowDeductionDialog(false);
      setDeductionAmount('');
      setDeductionDescription('');
      loadData(); // Перезагружаем данные
    } catch (error) {
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive'
      });
    } finally {
      setIsDeducting(false);
    }
  };

  // Фильтрация пользователей
  // Фильтрация теперь происходит на стороне API

  if (usersLoading) {
    return (
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-1/3 rounded bg-gray-200'></div>
          <div className='h-4 w-1/2 rounded bg-gray-200'></div>
          <div className='h-32 rounded bg-gray-200'></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 flex-col space-y-6 ${selectedUsers.length > 0 ? 'pb-24' : ''}`}
    >
      {/* Back Button */}
      <div>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => router.push('/dashboard/projects')}
          className='mb-4'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Назад к проектам
        </Button>
      </div>

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <Heading
            title={`Пользователи: ${project?.name || 'Проект'}`}
            description={`Управление пользователями и их бонусами (${totalUsers} пользователей)`}
          />
        </div>
        <div className='flex items-center space-x-2'>
          <Button onClick={() => setShowCreateUserDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Добавить пользователя
          </Button>
        </div>
      </div>

      <Separator />

      {/* Statistics */}
      <BonusStatsCards
        stats={statsData}
        isLoading={usersLoading}
        error={usersError}
      />

      {/* Legacy Stats Cards - temporarily hidden */}
      {/*
      <div className='grid grid-cols-1 gap-6 overflow-x-hidden pr-2 md:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Всего пользователей
            </CardTitle>
            <Users className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Активных пользователей
            </CardTitle>
            <Users className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {users.filter((u) => u.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>С уровнями</CardTitle>
            <Target className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {users.filter((u) => u.level).length}
            </div>
            <p className='text-muted-foreground text-xs'>
              {
                users.filter((u) => u.level && u.level.name !== 'Базовый')
                  .length
              }{' '}
              выше базового
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Всего бонусов</CardTitle>
            <Gift className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {Number(
                users.reduce((sum, user) => sum + (user.totalBonuses || 0), 0)
              ).toFixed(2)}
              ₽
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Активных бонусов
            </CardTitle>
            <Gift className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {Number(
                users.reduce((sum, user) => sum + (user.activeBonuses || 0), 0)
              ).toFixed(2)}
              ₽
            </div>
          </CardContent>
        </Card>
      </div>
      */}

      {/* Search */}
      <div className='flex items-center space-x-2'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
          <Input
            placeholder='Поиск пользователей...'
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className='pl-8'
          />
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Список пользователей</CardTitle>
              <CardDescription>
                Управление пользователями проекта и их бонусными счетами
              </CardDescription>
            </div>
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={selectAllUsers}
                disabled={users.length === 0}
              >
                Выбрать все
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Подсказка по рассылкам */}
          {users.length > 0 && selectedUsers.length === 0 && (
            <div className='mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
              <div className='flex items-center gap-2 text-sm text-blue-700'>
                <MessageSquare className='h-4 w-4' />
                <span className='font-medium'>
                  📢 Как отправить рассылку пользователям:
                </span>
              </div>
              <p className='mt-1 text-sm text-blue-600'>
                1. Выберите пользователей (поставьте галочки) 2. Снизу появится
                панель с кнопкой &quot;Уведомления&quot; 3. Выберите &quot;📢
                Расширенные уведомления&quot; для отправки рассылок с картинками
                и кнопками
              </p>
            </div>
          )}

          {usersLoading ? (
            <div className='space-y-4 pr-2'>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className='bg-muted h-20 animate-pulse rounded' />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className='py-8 text-center'>
              <Users className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
              <p className='text-muted-foreground'>Пользователи не найдены</p>
              <p className='text-muted-foreground mt-2 text-sm'>
                {users.length === 0
                  ? 'В проекте пока нет пользователей'
                  : 'Попробуйте изменить поисковый запрос'}
              </p>
            </div>
          ) : (
            <UsersTable
              data={users.map((user) => ({
                ...user,
                name:
                  user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`.trim()
                    : user.email || 'Без имени',
                bonusBalance: user.activeBonuses || 0,
                totalEarned: user.totalBonuses || 0,
                createdAt: new Date(user.registeredAt),
                updatedAt: new Date(user.registeredAt)
              }))}
              onHistoryClick={(userId) => {
                const user = users.find((u) => u.id === userId);
                if (user) handleOpenBonusDialog(user);
              }}
              onExport={handleExportAll}
              loading={usersLoading}
              totalCount={totalUsers}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserCreateDialog
        projectId={projectId}
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        onSuccess={handleCreateUser}
      />

      {selectedUser && (
        <BonusAwardDialog
          projectId={projectId}
          userId={selectedUser.id}
          userName={
            selectedUser.firstName || selectedUser.lastName
              ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
              : 'Без имени'
          }
          userContact={
            selectedUser.email ||
            selectedUser.phone ||
            `ID: ${selectedUser.id.slice(0, 8)}...`
          }
          open={showBonusDialog}
          onOpenChange={setShowBonusDialog}
          onSuccess={handleBonusSuccess}
        />
      )}

      {/* Диалог списания бонусов */}
      {selectedUser && (
        <Dialog
          open={showDeductionDialog}
          onOpenChange={setShowDeductionDialog}
        >
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Списать бонусы</DialogTitle>
              <DialogDescription>
                Списание бонусов у пользователя{' '}
                {selectedUser.firstName || selectedUser.lastName
                  ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
                  : 'Без имени'}
                <br />
                Доступно: {selectedUser.activeBonuses}₽
              </DialogDescription>
            </DialogHeader>

            <div className='grid gap-4 py-4'>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='amount' className='text-right'>
                  Сумма
                </Label>
                <Input
                  id='amount'
                  type='number'
                  placeholder='0'
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(e.target.value)}
                  className='col-span-3'
                  min='0'
                  max={selectedUser.activeBonuses}
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='description' className='text-right'>
                  Описание
                </Label>
                <Textarea
                  id='description'
                  placeholder='Причина списания (необязательно)'
                  value={deductionDescription}
                  onChange={(e) => setDeductionDescription(e.target.value)}
                  className='col-span-3'
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setShowDeductionDialog(false)}
                disabled={isDeducting}
              >
                Отмена
              </Button>
              <Button
                onClick={handleDeductionSubmit}
                disabled={
                  isDeducting ||
                  !deductionAmount ||
                  parseFloat(deductionAmount) <= 0
                }
                variant='destructive'
              >
                {isDeducting ? 'Списываем...' : 'Списать бонусы'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Диалог массовых операций */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>
              {bulkOperation === 'bonus_award' && 'Массовое начисление бонусов'}
              {bulkOperation === 'bonus_deduct' && 'Массовое списание бонусов'}
              {bulkOperation === 'notification' &&
                'Массовая отправка уведомлений'}
            </DialogTitle>
            <DialogDescription>
              Операция будет выполнена для {selectedUsers.length} выбранных
              пользователей
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {(bulkOperation === 'bonus_award' ||
              bulkOperation === 'bonus_deduct') && (
              <>
                <div className='grid grid-cols-4 items-center gap-4'>
                  <Label htmlFor='bulk-amount' className='text-right'>
                    Сумма
                  </Label>
                  <Input
                    id='bulk-amount'
                    type='number'
                    placeholder='0'
                    className='col-span-3'
                    min='0'
                  />
                </div>
                <div className='grid grid-cols-4 items-center gap-4'>
                  <Label htmlFor='bulk-description' className='text-right'>
                    Описание
                  </Label>
                  <Textarea
                    id='bulk-description'
                    placeholder='Описание операции'
                    className='col-span-3'
                    rows={3}
                  />
                </div>
                {bulkOperation === 'bonus_award' && (
                  <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor='bulk-expires' className='text-right'>
                      Истекает
                    </Label>
                    <Input
                      id='bulk-expires'
                      type='date'
                      className='col-span-3'
                    />
                  </div>
                )}
              </>
            )}

            {bulkOperation === 'notification' && (
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='bulk-message' className='text-right'>
                  Сообщение
                </Label>
                <Textarea
                  id='bulk-message'
                  placeholder='Текст уведомления для отправки через Telegram бота'
                  className='col-span-3'
                  rows={5}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setShowBulkDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                // Логика выполнения массовой операции
                console.log('Выполняем массовую операцию:', {
                  operation: bulkOperation,
                  users: selectedUsers
                  // Здесь будут данные из формы
                });
                setShowBulkDialog(false);
                clearSelection();
              }}
            >
              {bulkOperation === 'bonus_award' && 'Начислить'}
              {bulkOperation === 'bonus_deduct' && 'Списать'}
              {bulkOperation === 'notification' && 'Отправить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Bulk Actions Toolbar */}
      <EnhancedBulkActionsToolbar
        selectedUserIds={selectedUsers}
        selectedCount={selectedUsers.length}
        onClearSelection={() => setSelectedUsers([])}
        onShowRichNotifications={() => setShowRichNotificationDialog(true)}
        onBulkBonusAction={(action) => {
          setBulkOperation(action === 'ADD' ? 'bonus_award' : 'bonus_deduct');
          setShowBulkDialog(true);
        }}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Rich Notification Dialog */}
      <RichNotificationDialog
        open={showRichNotificationDialog}
        onOpenChange={setShowRichNotificationDialog}
        selectedUserIds={selectedUsers}
        projectId={projectId}
      />
    </div>
  );
}
