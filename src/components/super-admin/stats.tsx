'use client';

/**
 * @file: src/components/super-admin/stats.tsx
 * @description: Компонент для отображения статистики и графиков
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

interface SuperAdminStatsProps {
  stats: any;
}

export default function SuperAdminStats({ stats }: SuperAdminStatsProps) {
  if (!stats) {
    return (
      <Card>
        <CardContent className='p-6'>
          <p className='text-muted-foreground'>Загрузка статистики...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Метрики производительности */}
      {stats.performance && (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Webhook запросы (24ч)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.performance.webhooks?.total24h || 0}</div>
              <p className='text-xs text-muted-foreground'>
                Успешных: {stats.performance.webhooks?.successful24h || 0} (
                {stats.performance.webhooks?.successRate || '0'}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Системные логи (24ч)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {(stats.performance.systemLogs?.info || 0) +
                  (stats.performance.systemLogs?.warn || 0) +
                  (stats.performance.systemLogs?.error || 0)}
              </div>
              <p className='text-xs text-muted-foreground'>
                Ошибок: {stats.performance.systemLogs?.error || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Транзакции (24ч)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.performance.transactions?.total24h || 0}</div>
              <p className='text-xs text-muted-foreground'>
                За последние 24 часа
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {Number(stats.metrics?.mrr || 0).toLocaleString('ru-RU')} ₽
              </div>
              <p className='text-xs text-muted-foreground'>
                Monthly Recurring Revenue
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className='grid gap-4 md:grid-cols-2'>
        {/* График регистраций */}
        <Card>
          <CardHeader>
            <CardTitle>Регистрации пользователей (30 дней)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='h-[300px] flex items-center justify-center'>
              <p className='text-muted-foreground'>
                График будет добавлен после установки recharts
              </p>
              {/* TODO: Добавить Line Chart с recharts */}
            </div>
          </CardContent>
        </Card>

        {/* Распределение по статусам ботов */}
        <Card>
          <CardHeader>
            <CardTitle>Статус ботов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex justify-between'>
                <span>Активных</span>
                <span className='font-bold'>{stats.charts?.botsByStatus?.active || 0}</span>
              </div>
              <div className='flex justify-between'>
                <span>Неактивных</span>
                <span className='font-bold'>{stats.charts?.botsByStatus?.inactive || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Топ проектов по активности */}
      {stats.performance?.topProjects && stats.performance.topProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Топ проектов по активности (24ч)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Проект</TableHead>
                  <TableHead>Домен</TableHead>
                  <TableHead className='text-right'>Webhook запросов</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.performance.topProjects.map((project: any) => (
                  <TableRow key={project.projectId}>
                    <TableCell className='font-medium'>{project.projectName}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {project.projectDomain || '-'}
                    </TableCell>
                    <TableCell className='text-right'>{project.requestCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Источники ошибок */}
      {stats.performance?.errorSources && Object.keys(stats.performance.errorSources).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Источники ошибок (24ч)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {Object.entries(stats.performance.errorSources).map(([source, count]) => (
                <div key={source} className='flex justify-between items-center'>
                  <span className='capitalize'>{source}</span>
                  <span className='font-bold text-destructive'>{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className='md:col-span-2'>
        <CardHeader>
          <CardTitle>Последняя активность</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='users' className='w-full'>
            <TabsList>
              <TabsTrigger value='users'>Пользователи</TabsTrigger>
              <TabsTrigger value='projects'>Проекты</TabsTrigger>
              <TabsTrigger value='errors'>Ошибки</TabsTrigger>
            </TabsList>
            <TabsContent value='users' className='mt-4'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead>Проект</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent?.users?.length > 0 ? (
                    stats.recent.users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>
                          {user.firstName || user.lastName
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : '-'}
                        </TableCell>
                        <TableCell>{user.project?.name || '-'}</TableCell>
                        <TableCell>
                          {new Date(user.registeredAt).toLocaleDateString('ru-RU')}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className='text-center text-muted-foreground'>
                        Нет данных
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value='projects' className='mt-4'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Домен</TableHead>
                    <TableHead>Владелец</TableHead>
                    <TableHead>Дата создания</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent?.projects?.length > 0 ? (
                    stats.recent.projects.map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell>{project.name}</TableCell>
                        <TableCell>{project.domain || '-'}</TableCell>
                        <TableCell>{project.owner?.email || '-'}</TableCell>
                        <TableCell>
                          {new Date(project.createdAt).toLocaleDateString('ru-RU')}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className='text-center text-muted-foreground'>
                        Нет данных
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value='errors' className='mt-4'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Уровень</TableHead>
                    <TableHead>Сообщение</TableHead>
                    <TableHead>Источник</TableHead>
                    <TableHead>Проект</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent?.errors?.length > 0 ? (
                    stats.recent.errors.map((error: any) => (
                      <TableRow key={error.id}>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            error.level === 'error' ? 'bg-red-100 text-red-800' :
                            error.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {error.level}
                          </span>
                        </TableCell>
                        <TableCell className='max-w-md truncate'>{error.message}</TableCell>
                        <TableCell>{error.source}</TableCell>
                        <TableCell>{error.project?.name || '-'}</TableCell>
                        <TableCell>
                          {new Date(error.createdAt).toLocaleDateString('ru-RU')}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className='text-center text-muted-foreground'>
                        Нет ошибок
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
