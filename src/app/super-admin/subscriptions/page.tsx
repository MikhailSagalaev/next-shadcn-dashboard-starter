/**
 * @file: src/app/super-admin/subscriptions/page.tsx
 * @description: Страница управления подписками
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionsTable } from '@/components/super-admin/subscriptions-table';
import { SubscriptionPlansTable } from '@/components/super-admin/subscription-plans-table';

export default function SuperAdminSubscriptionsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Управление подписками</h1>
        <p className='text-muted-foreground'>
          Управление тарифными планами и подписками пользователей
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Тарифные планы</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionPlansTable />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список подписок</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionsTable />
        </CardContent>
      </Card>
    </div>
  );
}
