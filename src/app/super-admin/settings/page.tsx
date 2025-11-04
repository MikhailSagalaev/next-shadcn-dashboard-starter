/**
 * @file: src/app/super-admin/settings/page.tsx
 * @description: Страница системных настроек
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuperAdminSettingsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Системные настройки</h1>
        <p className='text-muted-foreground'>
          Управление настройками системы и feature flags
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            Форма с feature flags, глобальными лимитами, системной информацией будет добавлена в следующих итерациях.
          </p>
          {/* TODO: Добавить форму с настройками */}
        </CardContent>
      </Card>
    </div>
  );
}
