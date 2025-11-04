/**
 * @file: src/app/super-admin/projects/page.tsx
 * @description: Страница управления проектами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectsTable } from '@/components/super-admin/projects-table';

export default function SuperAdminProjectsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Управление проектами</h1>
        <p className='text-muted-foreground'>
          Управление всеми проектами системы
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список проектов</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsTable />
        </CardContent>
      </Card>
    </div>
  );
}
