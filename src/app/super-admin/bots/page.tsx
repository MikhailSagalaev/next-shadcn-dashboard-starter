/**
 * @file: src/app/super-admin/bots/page.tsx
 * @description: Страница управления ботами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BotsTable } from '@/components/super-admin/bots-table';

export default function SuperAdminBotsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Управление ботами</h1>
        <p className='text-muted-foreground'>
          Управление Telegram ботами всех проектов
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список ботов</CardTitle>
        </CardHeader>
        <CardContent>
          <BotsTable />
        </CardContent>
      </Card>
    </div>
  );
}
