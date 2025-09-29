/**
 * @file: bonus-management-page-refactored.tsx
 * @description: Улучшенная версия страницы управления бонусами
 * @project: SaaS Bonus System
 * @dependencies: react, hooks, ui components
 * @created: 2025-01-27
 * @author: AI Assistant + User
 */

'use client';

import { useState, useMemo, useCallback, memo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Search,
  Download,
  Settings,
  Plus,
  RefreshCw,
  AlertCircle,
  Users,
  Filter,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

// Hooks
import { useProjects } from '../hooks/use-projects';
import { useProjectUsers } from '../hooks/use-project-users';

// Components
import { BonusStatsCards } from './bonus-stats-cards';
import { UserCreateDialog } from './user-create-dialog';
import { BulkActionsToolbar } from './bulk-actions-toolbar';
import { EnhancedBulkActionsToolbar } from './enhanced-bulk-actions-toolbar';
import { RichNotificationDialog } from './rich-notification-dialog';
import { UsersTable } from './users-table';

// Types
import type { DisplayUser as User } from '../types';

interface BonusManagementPageProps {
  className?: string;
}

export function BonusManagementPageRefactored({
  className
}: BonusManagementPageProps = {}) {
  const router = useRouter();
  const { toast } = useToast();

  // Local state
  const [searchTerm, setSearchTermState] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showRichNotificationDialog, setShowRichNotificationDialog] =
    useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Custom hooks
  const {
    projects,
    currentProjectId,
    currentProject,
    isLoading: projectsLoading,
    error: projectsError,
    selectProject
  } = useProjects({
    autoSelectFirst: true,
    fallbackProjectId: 'cmdkloj85000cv8o0611rblp3' // Fallback project ID
  });

  // Создаем стабильные значения для useProjectUsers
  const stableProjectId = useMemo(() => currentProjectId, [currentProjectId]);
  const stablePageSize = useMemo(() => pageSize, [pageSize]);
  const stableSearchTerm = useMemo(() => searchTerm, [searchTerm]);

  const {
    users,
    isLoading: usersLoading,
    error: usersError,
    totalUsers,
    activeUsers,
    totalBonuses,
    currentPage,
    totalPages,
    totalCount,
    loadUsers,
    createUser,
    refreshUsers,
    searchUsers,
    setSearchTerm,
    exportUsers
  } = useProjectUsers({
    projectId: stableProjectId,
    pageSize: stablePageSize,
    searchTerm: stableSearchTerm
  });

  // Обработчики пагинации и поиска
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

  // Memoized values
  const filteredUsers = useMemo(() => {
    return searchUsers(searchTerm);
  }, [searchUsers, searchTerm]);

  const statsData = useMemo(
    () => ({
      totalUsers,
      activeUsers,
      totalBonuses,
      expiringSoonBonuses: Math.floor(totalBonuses * 0.15), // Mock для демо
      monthlyGrowth: 12 // Mock для демо
    }),
    [totalUsers, activeUsers, totalBonuses]
  );

  const isLoading = projectsLoading || usersLoading || exportLoading;
  const hasError = projectsError || usersError;

  // Event handlers
  const handleSearch = useCallback(
    (term: string) => {
      setSearchTermState(term);
      setSearchTerm(term); // Устанавливаем search term в хуке
      setSelectedUsers([]); // Сбрасываем выбор при поиске

      // При поиске возвращаемся на первую страницу
      loadUsers(1);

      logger.debug(
        'Users search performed',
        {
          searchTerm: term,
          projectId: currentProjectId
        },
        'bonus-management'
      );
    },
    [loadUsers, currentProjectId, setSearchTerm]
  );

  const handleUserSelection = useCallback(
    (userId: string, selected: boolean) => {
      setSelectedUsers((prev) => {
        if (selected) {
          return prev.includes(userId) ? prev : [...prev, userId];
        } else {
          return prev.filter((id) => id !== userId);
        }
      });
    },
    []
  );

  const handleProfileClick = useCallback((user: User) => {
    setProfileUser(user);
  }, []);

  const openHistory = useCallback(
    async (userId: string, page = 1) => {
      if (!currentProjectId) return;
      setHistoryLoading(true);
      setHistoryUserId(userId);
      try {
        const res = await fetch(
          `/api/projects/${currentProjectId}/users/${userId}/bonuses?page=${page}&limit=20&aggregate=true`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        setHistoryItems(data?.transactions || []);
        setHistoryTotal(data?.total || data?.originalTotal || 0);
        setHistoryPage(page);
      } finally {
        setHistoryLoading(false);
      }
    },
    [currentProjectId]
  );

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedUsers(filteredUsers.map((user) => user.id));
      } else {
        setSelectedUsers([]);
      }
    },
    [filteredUsers]
  );

  const handleCreateUser = useCallback(
    async (userData: any) => {
      try {
        // Если пришёл уже созданный пользователь (из диалога), не создаём повторно
        const alreadyCreated = userData && typeof userData.id === 'string';

        if (!alreadyCreated) {
          logger.info(
            'Creating new user',
            { projectId: currentProjectId },
            'bonus-management'
          );
          await createUser(userData);
        }

        await refreshUsers();
        setShowCreateUserDialog(false);

        toast({
          title: 'Пользователь создан',
          description: `Пользователь ${userData.firstName || userData.email} успешно добавлен`
        });

        logger.info(
          'User created successfully',
          {
            projectId: currentProjectId,
            userEmail: userData.email
          },
          'bonus-management'
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        toast({
          title: 'Ошибка создания пользователя',
          description: errorMessage,
          variant: 'destructive'
        });

        logger.error(
          'Failed to create user',
          {
            projectId: currentProjectId,
            error: errorMessage
          },
          'bonus-management'
        );
      }
    },
    [createUser, refreshUsers, currentProjectId, toast]
  );

  const handleExport = useCallback(async () => {
    try {
      logger.info(
        'Exporting users',
        {
          projectId: currentProjectId,
          count: users.length
        },
        'bonus-management'
      );

      await exportUsers();

      toast({
        title: 'Экспорт завершен',
        description: `Данные ${users.length} пользователей экспортированы в CSV`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      toast({
        title: 'Ошибка экспорта',
        description: errorMessage,
        variant: 'destructive'
      });

      logger.error(
        'Failed to export users',
        {
          projectId: currentProjectId,
          error: errorMessage
        },
        'bonus-management'
      );
    }
  }, [exportUsers, users.length, currentProjectId, toast]);

  // Функция для экспорта всех пользователей
  const handleExportAll = useCallback(async () => {
    try {
      if (!currentProjectId) {
        toast({
          title: 'Ошибка',
          description: 'Не выбран проект',
          variant: 'destructive'
        });
        return;
      }

      setExportLoading(true);

      // Получаем общее количество пользователей для расчета страниц
      const totalResponse = await fetch(
        `/api/projects/${currentProjectId}/users?page=1&limit=1`
      );
      if (!totalResponse.ok) {
        throw new Error('Не удалось получить информацию о пользователях');
      }
      const totalData = await totalResponse.json();
      const totalUsers = totalData.pagination?.total || 0;
      const totalPages = totalData.pagination?.pages || 0;

      if (totalUsers === 0) {
        toast({
          title: 'Нет данных',
          description: 'В проекте нет пользователей для экспорта',
          variant: 'destructive'
        });
        return;
      }

      // Загружаем все страницы параллельно (по 10 страниц одновременно)
      const pageSize = 100;
      const pages = Math.ceil(totalUsers / pageSize);
      const batchSize = 10;

      const allUsers: any[] = [];

      for (let i = 0; i < pages; i += batchSize) {
        const batchPromises = [];
        for (let j = 0; j < batchSize && i + j < pages; j++) {
          const page = i + j + 1;
          batchPromises.push(
            fetch(
              `/api/projects/${currentProjectId}/users?page=${page}&limit=${pageSize}`
            )
              .then((res) => (res.ok ? res.json() : []))
              .then((data) => data.users || [])
          );
        }

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((users) => allUsers.push(...users));

        // Обновляем прогресс
        const progress = Math.min(((i + batchSize) / pages) * 100, 100);
        toast({
          title: 'Экспорт в процессе...',
          description: `Загружено ${allUsers.length} из ${totalUsers} пользователей (${Math.round(progress)}%)`
        });
      }

      // Подготавливаем данные для CSV
      const csvData = allUsers.map((user: any) => ({
        ID: user.id || '',
        Имя:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.email || '',
        Email: user.email || '',
        Телефон: user.phone || '',
        'Баланс бонусов': user.bonusBalance || 0,
        'Всего заработано': user.totalEarned || 0,
        'Дата регистрации': user.createdAt
          ? new Date(user.createdAt).toLocaleDateString('ru-RU')
          : '',
        Уровень: user.currentLevel || 'Базовый',
        'Реферальный код': user.referralCode || '',
        Telegram: user.telegramUsername ? `@${user.telegramUsername}` : '',
        Активный: user.isActive ? 'Да' : 'Нет'
      }));

      // Используем papaparse для создания CSV
      import('papaparse').then(({ unparse }) => {
        const csvContent = unparse(csvData, {
          delimiter: ';',
          header: true
        });

        // Создаем и скачиваем файл
        const blob = new Blob(['\ufeff' + csvContent], {
          type: 'text/csv;charset=utf-8;'
        });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `users-${currentProjectId}-${new Date().toISOString().split('T')[0]}.csv`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Экспорт завершен',
          description: `Экспортировано ${allUsers.length} пользователей`
        });

        logger.info(
          'All users exported successfully',
          { projectId: currentProjectId, count: allUsers.length },
          'bonus-management'
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      toast({
        title: 'Ошибка экспорта',
        description: errorMessage,
        variant: 'destructive'
      });

      logger.error(
        'Failed to export all users',
        {
          projectId: currentProjectId,
          error: errorMessage
        },
        'bonus-management'
      );
    } finally {
      setExportLoading(false);
    }
  }, [currentProjectId, toast]);

  const handleRefresh = useCallback(async () => {
    try {
      logger.info(
        'Refreshing users data',
        { projectId: currentProjectId },
        'bonus-management'
      );

      await refreshUsers();
      setSelectedUsers([]); // Сбрасываем выбор

      toast({
        title: 'Данные обновлены',
        description: 'Список пользователей успешно обновлен'
      });
    } catch (error) {
      toast({
        title: 'Ошибка обновления',
        description: 'Не удалось обновить данные',
        variant: 'destructive'
      });
    }
  }, [refreshUsers, currentProjectId, toast]);

  const handleProjectSettings = useCallback(() => {
    if (currentProjectId) {
      router.push(`/dashboard/projects/${currentProjectId}/settings`);
    }
  }, [currentProjectId, router]);

  // Render error state
  if (hasError && !isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{projectsError || usersError}</AlertDescription>
        </Alert>

        <div className='flex justify-center'>
          <Button onClick={() => window.location.reload()} variant='outline'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-6 ${className ?? ''}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Управление бонусами
          </h1>
          <p className='text-muted-foreground'>
            {currentProject
              ? `Проект: ${currentProject.name}`
              : 'Управление пользователями и бонусной программой'}
          </p>
        </div>

        <div className='flex items-center space-x-2'>
          {projects.length > 1 && (
            <Select
              value={currentProjectId || ''}
              onValueChange={selectProject}
              disabled={isLoading}
            >
              <SelectTrigger className='w-[200px]'>
                <SelectValue placeholder='Выберите проект' />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Обновить
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <BonusStatsCards
        stats={statsData}
        isLoading={isLoading}
        error={hasError ? projectsError || usersError : null}
      />

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center space-x-2'>
                <Users className='h-5 w-5' />
                <span>Пользователи</span>
                {!isLoading && (
                  <Badge variant='secondary'>
                    {filteredUsers.length} из {totalUsers}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Управление пользователями бонусной программы
              </CardDescription>
            </div>

            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleProjectSettings}
                disabled={!currentProjectId}
              >
                <Settings className='mr-2 h-4 w-4' />
                Настройки
              </Button>

              <Button
                size='sm'
                onClick={() => setShowCreateUserDialog(true)}
                disabled={!currentProjectId}
              >
                <Plus className='mr-2 h-4 w-4' />
                Добавить пользователя
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className='flex items-center space-x-4'>
            <div className='relative max-w-sm flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform' />
              <Input
                placeholder='Поиск по имени, email или телефону...'
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className='pl-10'
                disabled={isLoading}
              />
            </div>

            {selectedUsers.length > 0 && (
              <Badge variant='default'>Выбрано: {selectedUsers.length}</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Подсказка по рассылкам */}
          {filteredUsers.length > 0 && selectedUsers.length === 0 && (
            <div className='mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
              <div className='flex items-center gap-2 text-sm text-blue-700'>
                <MessageSquare className='h-4 w-4' />
                <span className='font-medium'>💡 Как отправить рассылку:</span>
              </div>
              <p className='mt-1 text-sm text-blue-600'>
                1. Выберите пользователей (поставьте галочки) 2. Снизу появится
                панель с кнопкой &quot;Уведомления&quot; 3. Выберите &quot;📢
                Расширенные уведомления&quot; для отправки рассылок с картинками
                и кнопками
              </p>
            </div>
          )}

          {/* Users List */}
          <UsersTable
            data={filteredUsers}
            onExport={handleExportAll}
            onSelectionChange={setSelectedUsers}
            onProfileClick={handleProfileClick}
            onHistoryClick={openHistory}
            loading={isLoading}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </CardContent>
      </Card>

      {/* Enhanced Bulk Actions Toolbar */}
      <EnhancedBulkActionsToolbar
        selectedUserIds={selectedUsers}
        selectedCount={selectedUsers.length}
        onClearSelection={() => setSelectedUsers([])}
        onShowRichNotifications={() => setShowRichNotificationDialog(true)}
      />

      {/* Create User Dialog */}
      <UserCreateDialog
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        onSuccess={handleCreateUser}
        projectId={currentProjectId || ''}
      />

      {/* Rich Notification Dialog */}
      <RichNotificationDialog
        open={showRichNotificationDialog}
        onOpenChange={setShowRichNotificationDialog}
        selectedUserIds={selectedUsers}
        projectId={currentProjectId || ''}
      />

      {/* User Profile Dialog */}
      <Dialog
        open={!!profileUser}
        onOpenChange={(o) => !o && setProfileUser(null)}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Профиль пользователя</DialogTitle>
          </DialogHeader>
          {profileUser && (
            <div className='space-y-6'>
              <div className='flex items-center space-x-4'>
                <Avatar className='h-16 w-16'>
                  <AvatarImage
                    src={`https://api.slingacademy.com/public/sample-users/${(parseInt(profileUser.id.slice(-2), 16) % 10) + 1}.png`}
                  />
                  <AvatarFallback className='text-lg'>
                    {profileUser.firstName?.[0] || ''}
                    {profileUser.lastName?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className='text-xl font-semibold'>{profileUser.name}</h3>
                  <p className='text-muted-foreground'>
                    ID: {profileUser.id.slice(0, 8)}...
                  </p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label className='text-sm font-medium'>Email</Label>
                  <p className='text-muted-foreground text-sm'>
                    {profileUser.email || 'Не указан'}
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>Телефон</Label>
                  <p className='text-muted-foreground text-sm'>
                    {profileUser.phone || 'Не указан'}
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>Активные бонусы</Label>
                  <p className='text-muted-foreground text-sm'>
                    {profileUser.bonusBalance} ₽
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>
                    Всего заработано
                  </Label>
                  <p className='text-muted-foreground text-sm'>
                    {profileUser.totalEarned} ₽
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>
                    Дата регистрации
                  </Label>
                  <p className='text-muted-foreground text-sm'>
                    {new Date(profileUser.createdAt).toLocaleDateString(
                      'ru-RU'
                    )}
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>Telegram</Label>
                  <p className='text-muted-foreground text-sm'>
                    {profileUser.telegramUsername
                      ? `@${profileUser.telegramUsername}`
                      : 'Не подключен'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* История операций пользователя */}
      <Dialog
        open={!!historyUserId}
        onOpenChange={(o) => !o && setHistoryUserId(null)}
      >
        <DialogContent className='flex max-h-[80vh] max-w-4xl flex-col'>
          <DialogHeader>
            <div className='flex items-start justify-between gap-3'>
              <DialogTitle>История операций</DialogTitle>
              <DialogClose className='hover:bg-muted rounded-md border px-3 py-1 text-xs font-medium transition-colors'>
                Закрыть
              </DialogClose>
            </div>
          </DialogHeader>
          <div className='flex-1 overflow-hidden'>
            {historyLoading ? (
              <div className='text-muted-foreground p-6 text-sm'>Загрузка…</div>
            ) : historyItems.length === 0 ? (
              <div className='text-muted-foreground p-6 text-sm'>
                Нет операций
              </div>
            ) : (
              <div className='flex h-full flex-col space-y-3'>
                <div className='flex-1 overflow-auto rounded-lg border'>
                  <Table>
                    <TableHeader className='bg-background sticky top-0 z-10'>
                      <TableRow>
                        <TableHead className='w-[160px]'>Дата</TableHead>
                        <TableHead className='w-[120px] text-center'>
                          Тип
                        </TableHead>
                        <TableHead className='w-[120px] text-right'>
                          Сумма
                        </TableHead>
                        <TableHead className='min-w-[250px]'>
                          Описание
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyItems.map((t) => (
                        <Fragment key={t.id}>
                          <TableRow>
                            <TableCell className='text-sm'>
                              {new Date(t.createdAt).toLocaleString('ru-RU')}
                            </TableCell>
                            <TableCell className='text-center'>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  t.type === 'EARN'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {t.type === 'EARN' ? 'Начисление' : 'Списание'}
                              </span>
                            </TableCell>
                            <TableCell className='text-right font-medium'>
                              {t.type === 'EARN' ? '+' : '-'}
                              {Number(t.amount).toFixed(2)}₽
                            </TableCell>
                            <TableCell
                              className='text-sm break-words'
                              title={t.description || ''}
                            >
                              {t.description || '-'}
                              {t.metadata?.spendAggregatedCount ? (
                                <span className='text-muted-foreground ml-2 text-xs'>
                                  (совмещено {t.metadata.spendAggregatedCount}{' '}
                                  операций)
                                </span>
                              ) : null}
                              {Array.isArray(t.aggregatedTransactions) &&
                              t.aggregatedTransactions.length > 0 ? (
                                <div className='border-muted-foreground/30 bg-muted/50 text-muted-foreground mt-2 space-y-1 rounded-md border border-dashed p-2 text-xs'>
                                  {t.aggregatedTransactions.map(
                                    (child: any) => (
                                      <div
                                        key={child.id}
                                        className='flex flex-wrap items-center justify-between gap-2'
                                      >
                                        <span>
                                          {new Date(
                                            child.createdAt
                                          ).toLocaleString('ru-RU')}
                                        </span>
                                        <span className='text-destructive font-medium'>
                                          -{Number(child.amount).toFixed(2)}₽
                                        </span>
                                        {child.metadata?.spentFromBonusId ? (
                                          <span className='opacity-70'>
                                            ID бонуса:{' '}
                                            {child.metadata.spentFromBonusId}
                                          </span>
                                        ) : null}
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className='flex items-center justify-between border-t pt-4 text-sm'>
                  <span className='text-muted-foreground'>
                    Показано{' '}
                    {historyItems.length > 0 ? (historyPage - 1) * 20 + 1 : 0}–
                    {historyItems.length > 0
                      ? Math.min(historyPage * 20, historyTotal)
                      : 0}{' '}
                    из {historyTotal}
                  </span>
                  <div className='space-x-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={historyPage <= 1}
                      onClick={() =>
                        openHistory(historyUserId!, historyPage - 1)
                      }
                    >
                      Назад
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={historyPage * 20 >= historyTotal}
                      onClick={() =>
                        openHistory(historyUserId!, historyPage + 1)
                      }
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Компонент отображения списка пользователей
 */
interface UsersDisplayAreaProps {
  users: User[];
  selectedUsers: string[];
  isLoading: boolean;
  onUserSelection: (userId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpenHistory: (userId: string) => void;
}

const UsersDisplayArea = memo<UsersDisplayAreaProps>(
  ({
    users,
    selectedUsers,
    isLoading,
    onUserSelection,
    onSelectAll,
    onOpenHistory
  }) => {
    if (isLoading) {
      return (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12'>
                  <div className='bg-muted h-4 w-4 animate-pulse rounded' />
                </TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Бонусы</TableHead>
                <TableHead>Регистрация</TableHead>
                <TableHead className='w-12'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className='bg-muted h-4 w-4 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center space-x-3'>
                      <div className='bg-muted h-8 w-8 animate-pulse rounded-full' />
                      <div className='bg-muted h-4 w-32 animate-pulse rounded' />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-48 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-32 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-16 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-24 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-6 w-6 animate-pulse rounded' />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className='py-12 text-center'>
          <Users className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
          <h3 className='mb-2 text-lg font-semibold'>
            Пользователей не найдено
          </h3>
          <p className='text-muted-foreground mb-4'>
            Попробуйте изменить условия поиска или добавьте первого пользователя
          </p>
        </div>
      );
    }

    return (
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <Checkbox
                  checked={
                    selectedUsers.length === users.length && users.length > 0
                  }
                  onCheckedChange={(checked) => onSelectAll(checked as boolean)}
                />
              </TableHead>
              <TableHead>Пользователь</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Бонусы</TableHead>
              <TableHead>Регистрация</TableHead>
              <TableHead className='w-12'>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={selectedUsers.includes(user.id) ? 'bg-muted/50' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) =>
                      onUserSelection(user.id, checked as boolean)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className='flex items-center space-x-3'>
                    <div className='h-8 w-8 overflow-hidden rounded-full'>
                      <Image
                        src={user.avatar}
                        alt={user.name}
                        width={32}
                        height={32}
                        className='h-full w-full object-cover'
                      />
                    </div>
                    <div>
                      <div className='font-medium'>{user.name}</div>
                      <div className='text-muted-foreground text-sm'>
                        ID: {user.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='font-mono text-sm'>
                  {user.email || '-'}
                </TableCell>
                <TableCell className='font-mono text-sm'>
                  {user.phone || '-'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.bonusBalance > 0 ? 'default' : 'secondary'}
                  >
                    {user.bonusBalance.toFixed(0)} ₽
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {user.createdAt.toLocaleDateString('ru-RU')}
                </TableCell>
                <TableCell>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => onOpenHistory(user.id)}
                    className='h-8 w-8 p-0'
                  >
                    <MessageSquare className='h-4 w-4' />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
);

UsersDisplayArea.displayName = 'UsersDisplayArea';

export default BonusManagementPageRefactored;
