/**
 * @file: bonus-management-client.tsx
 * @description: Клиентский компонент управления бонусами с полным функционалом
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Plus, RefreshCw, Settings, Users, Upload } from 'lucide-react';
import { BonusStatsCards } from './bonus-stats-cards';
import { useProjectUsers } from '@/features/bonuses/hooks/use-project-users';
import { UsersTable } from '@/features/bonuses/components/users-table';
import { UserCreateDialog } from '@/features/projects/components/user-create-dialog';
import { UserImportDialog } from '@/features/projects/components/user-import-dialog';
import { BonusAwardDialog } from '@/features/projects/components/bonus-award-dialog';
import { EnhancedBulkActionsToolbar } from '@/features/bonuses/components/enhanced-bulk-actions-toolbar';
import { RichNotificationDialog } from '@/features/bonuses/components/rich-notification-dialog';
import { useToast } from '@/hooks/use-toast';
import type { BonusPageData } from '../data-access';
import type { DisplayUser } from '@/features/bonuses/types';

interface BonusManagementClientProps {
  initialData: BonusPageData;
}

export function BonusManagementClient({
  initialData
}: BonusManagementClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialData.projects[0]?.id || ''
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [showRichNotificationDialog, setShowRichNotificationDialog] =
    useState(false);
  const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Users management hook
  const {
    users,
    isLoading: usersLoading,
    totalUsers,
    totalBonuses,
    currentPage,
    totalCount,
    loadUsers,
    refreshUsers
  } = useProjectUsers({
    projectId: selectedProjectId,
    pageSize,
    searchTerm: ''
  });

  // Stats data
  const statsData = {
    totalProjects: initialData.projects.length,
    totalUsers,
    totalBonuses,
    activeBonuses: totalBonuses,
    expiringSoon: Math.floor(totalBonuses * 0.15)
  };

  const clearSelection = useCallback(() => {
    setSelectedUsers([]);
  }, []);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Введите название группы и выберите пользователей',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/segments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupName,
            description: `Группа из ${selectedUsers.length} пользователей`,
            type: 'MANUAL',
            rules: {}
          })
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка создания группы');
      }

      const segment = await response.json();

      const addMemberResponses = await Promise.all(
        selectedUsers.map((userId) =>
          fetch(
            `/api/projects/${selectedProjectId}/segments/${segment.id}/members`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
            }
          )
        )
      );

      const allAdded = addMemberResponses.every((r) => r.ok);
      if (!allAdded) {
        throw new Error('Не все пользователи были добавлены в группу');
      }

      toast({
        title: 'Успешно',
        description: `Группа "${groupName}" создана с ${selectedUsers.length} пользователями`
      });

      setShowCreateGroupDialog(false);
      setGroupName('');
      clearSelection();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать группу',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) return;
    if (!confirm(`Удалить выбранных пользователей (${selectedUsers.length})?`))
      return;
    try {
      const responses = await Promise.all(
        selectedUsers.map((uid) =>
          fetch(`/api/projects/${selectedProjectId}/users/${uid}`, {
            method: 'DELETE'
          })
        )
      );
      if (responses.every((r) => r.ok)) {
        clearSelection();
        refreshUsers();
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

  // Handlers
  const handlePageChange = useCallback(
    (page: number) => {
      loadUsers(page);
    },
    [loadUsers]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize);
      loadUsers(1);
    },
    [loadUsers]
  );

  const handleProjectChange = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      clearSelection();
    },
    [clearSelection]
  );

  const handleRefresh = useCallback(async () => {
    await refreshUsers();
    toast({
      title: 'Данные обновлены',
      description: 'Список пользователей успешно обновлен'
    });
  }, [refreshUsers, toast]);

  const handleProjectSettings = useCallback(() => {
    if (selectedProjectId) {
      router.push(`/dashboard/projects/${selectedProjectId}/settings`);
    }
  }, [selectedProjectId, router]);

  const handleCreateUser = useCallback(
    async (userData: any) => {
      await refreshUsers();
      setShowCreateUserDialog(false);
      toast({
        title: 'Пользователь создан',
        description: `Пользователь ${userData.firstName || userData.email} успешно добавлен`
      });
    },
    [refreshUsers, toast]
  );

  const handleBonusAwardClick = useCallback((user: DisplayUser) => {
    setSelectedUser(user);
    setShowBonusDialog(true);
  }, []);

  const handleBonusSuccess = useCallback(() => {
    refreshUsers();
    setSelectedUser(null);
  }, [refreshUsers]);

  const handleOpenHistoryDialog = useCallback(
    async (userId: string) => {
      router.push(
        `/dashboard/projects/${selectedProjectId}/users?userId=${userId}`
      );
    },
    [selectedProjectId, router]
  );

  const handleUserProfile = useCallback(
    (user: DisplayUser) => {
      router.push(
        `/dashboard/projects/${selectedProjectId}/users?userId=${user.id}`
      );
    },
    [selectedProjectId, router]
  );

  const handleDeleteUser = useCallback(
    async (user: DisplayUser) => {
      if (!confirm(`Удалить пользователя ${user.email || 'без email'}?`)) {
        return;
      }

      try {
        const response = await fetch(
          `/api/projects/${selectedProjectId}/users/${user.id}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          toast({
            title: 'Успех',
            description: 'Пользователь удален'
          });
          refreshUsers();
        } else {
          const error = await response.json();
          toast({
            title: 'Ошибка',
            description: error.error || 'Не удалось удалить пользователя',
            variant: 'destructive'
          });
        }
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Произошла ошибка при удалении пользователя',
          variant: 'destructive'
        });
      }
    },
    [selectedProjectId, refreshUsers, toast]
  );

  const handleExportAll = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/users?limit=10000`
      );
      if (!response.ok) {
        throw new Error('Не удалось получить данные пользователей');
      }

      const allUsers = await response.json();
      const usersArray = Array.isArray(allUsers?.users) ? allUsers.users : [];

      const headers = [
        'ID',
        'Имя',
        'Email',
        'Телефон',
        'Активные бонусы',
        'Всего бонусов',
        'Дата регистрации',
        'Статус'
      ];

      const csvData = usersArray.map((user: any) => [
        user.id || '',
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.email || '',
        user.email || '',
        user.phone || '',
        user.bonusBalance || 0,
        user.totalEarned || 0,
        user.registeredAt
          ? new Date(user.registeredAt).toLocaleDateString('ru-RU')
          : '',
        user.isActive ? 'Активен' : 'Неактивен'
      ]);

      csvData.unshift(headers);

      const csvContent = csvData
        .map((row: string[]) =>
          row
            .map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `users-${selectedProjectId}-${new Date().toISOString().split('T')[0]}.csv`
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
      toast({
        title: 'Ошибка экспорта',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  }, [selectedProjectId, toast]);

  if (!selectedProjectId) {
    return (
      <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
        <Heading
          title='Управление бонусами'
          description='Создайте проект для начала работы'
        />
        <Separator className='my-4' />
        <div className='flex h-[400px] items-center justify-center text-zinc-500'>
          Нет доступных проектов
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <Heading
          title='Управление бонусами'
          description={`Управление пользователями и бонусной программой (${totalUsers} пользователей)`}
        />
        <div className='flex items-center space-x-2'>
          {initialData.projects.length > 1 && (
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger className='w-[200px]'>
                <SelectValue placeholder='Выберите проект' />
              </SelectTrigger>
              <SelectContent>
                {initialData.projects.map((project) => (
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
            disabled={usersLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${usersLoading ? 'animate-spin' : ''}`}
            />
            Обновить
          </Button>

          <Button variant='outline' size='sm' onClick={handleProjectSettings}>
            <Settings className='mr-2 h-4 w-4' />
            Настройки
          </Button>

          {selectedUsers.length > 0 && (
            <Button
              variant='outline'
              onClick={() => setShowCreateGroupDialog(true)}
            >
              <Users className='mr-2 h-4 w-4' />
              Создать группу ({selectedUsers.length})
            </Button>
          )}

          <Button variant='outline' onClick={() => setShowImportDialog(true)}>
            <Upload className='mr-2 h-4 w-4' />
            Импорт CSV
          </Button>

          <Button onClick={() => setShowCreateUserDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Добавить пользователя
          </Button>
        </div>
      </div>

      <Separator className='my-4' />

      {/* Statistics */}
      <BonusStatsCards stats={statsData} />

      {/* Users Table */}
      <UsersTable
        data={users.map((user: any) => ({
          ...user,
          name:
            user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.email || 'Без имени',
          bonusBalance: user.bonusBalance || 0,
          totalEarned: user.totalEarned || 0,
          createdAt: user.registeredAt
            ? new Date(user.registeredAt)
            : new Date(),
          updatedAt: user.registeredAt
            ? new Date(user.registeredAt)
            : new Date(),
          isActive: user.isActive !== undefined ? user.isActive : false
        }))}
        projectId={selectedProjectId}
        onSelectionChange={setSelectedUsers}
        onBonusAwardClick={handleBonusAwardClick}
        onHistoryClick={handleOpenHistoryDialog}
        onProfileClick={handleUserProfile}
        onDeleteUser={handleDeleteUser}
        onUserUpdated={refreshUsers}
        onExport={handleExportAll}
        loading={usersLoading}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Enhanced Bulk Actions Toolbar */}
      <EnhancedBulkActionsToolbar
        selectedUserIds={selectedUsers}
        selectedCount={selectedUsers.length}
        onClearSelection={() => setSelectedUsers([])}
        onShowRichNotifications={() => setShowRichNotificationDialog(true)}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Dialogs */}
      <UserCreateDialog
        projectId={selectedProjectId}
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        onSuccess={handleCreateUser}
      />

      <UserImportDialog
        projectId={selectedProjectId}
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={() => loadUsers(1)}
      />

      <RichNotificationDialog
        open={showRichNotificationDialog}
        onOpenChange={setShowRichNotificationDialog}
        selectedUserIds={selectedUsers}
        projectId={selectedProjectId}
      />

      {selectedUser && (
        <BonusAwardDialog
          projectId={selectedProjectId}
          userId={selectedUser.id}
          userName={
            selectedUser.firstName || selectedUser.lastName
              ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
              : selectedUser.email || 'Без имени'
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
    </div>
  );
}
