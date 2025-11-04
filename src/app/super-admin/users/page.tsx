/**
 * @file: src/app/super-admin/users/page.tsx
 * @description: Страница управления пользователями (AdminAccount)
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminUsersTable } from '@/components/super-admin/admin-users-table';

export default function SuperAdminUsersPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Управление пользователями</h1>
        <p className='text-muted-foreground'>
          Управление администраторами системы
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список администраторов</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminUsersTable />
        </CardContent>
      </Card>
    </div>
  );
}
