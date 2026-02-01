/**
 * @file: src/app/super-admin/widget-versions/components/widget-version-table.tsx
 * @description: Таблица проектов с управлением версиями виджета
 * @project: SaaS Bonus System
 * @created: 2026-02-01
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Search, ArrowUpDown } from 'lucide-react';
import type { ProjectWithVersion } from '../data-access';
import { WidgetVersionToggle } from './widget-version-toggle';

interface WidgetVersionTableProps {
  projects: ProjectWithVersion[];
}

type SortField = 'name' | 'createdAt' | 'updatedAt' | 'users' | 'activity';
type SortOrder = 'asc' | 'desc';
type FilterVersion = 'all' | 'legacy' | 'universal';

export function WidgetVersionTable({ projects }: WidgetVersionTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVersion, setFilterVersion] = useState<FilterVersion>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Фильтрация
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.owner?.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVersion =
      filterVersion === 'all' || project.widgetVersion === filterVersion;

    return matchesSearch && matchesVersion;
  });

  // Сортировка
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case 'updatedAt':
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        break;
      case 'users':
        comparison = a._count.users - b._count.users;
        break;
      case 'activity':
        comparison = a._count.webhookLogs - b._count.webhookLogs;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>Проекты</CardTitle>
        <CardDescription>
          Управление версиями виджета для всех проектов
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Фильтры */}
        <div className='mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='relative flex-1'>
            <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400' />
            <Input
              placeholder='Поиск по названию, домену или email...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
          <Select
            value={filterVersion}
            onValueChange={(value) => setFilterVersion(value as FilterVersion)}
          >
            <SelectTrigger className='w-full md:w-[200px]'>
              <SelectValue placeholder='Фильтр по версии' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Все версии</SelectItem>
              <SelectItem value='legacy'>Legacy</SelectItem>
              <SelectItem value='universal'>Universal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Таблица */}
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-zinc-200 dark:border-zinc-800'>
                <th className='pb-3 text-left'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => toggleSort('name')}
                    className='flex items-center gap-1 font-semibold'
                  >
                    Проект
                    <ArrowUpDown className='h-3 w-3' />
                  </Button>
                </th>
                <th className='pb-3 text-left'>
                  <span className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
                    Владелец
                  </span>
                </th>
                <th className='pb-3 text-left'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => toggleSort('users')}
                    className='flex items-center gap-1 font-semibold'
                  >
                    Пользователи
                    <ArrowUpDown className='h-3 w-3' />
                  </Button>
                </th>
                <th className='pb-3 text-left'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => toggleSort('activity')}
                    className='flex items-center gap-1 font-semibold'
                  >
                    Активность (7д)
                    <ArrowUpDown className='h-3 w-3' />
                  </Button>
                </th>
                <th className='pb-3 text-left'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => toggleSort('createdAt')}
                    className='flex items-center gap-1 font-semibold'
                  >
                    Создан
                    <ArrowUpDown className='h-3 w-3' />
                  </Button>
                </th>
                <th className='pb-3 text-left'>
                  <span className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
                    Версия виджета
                  </span>
                </th>
                <th className='pb-3 text-right'>
                  <span className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
                    Действия
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className='py-8 text-center text-sm text-zinc-500'
                  >
                    Проекты не найдены
                  </td>
                </tr>
              ) : (
                sortedProjects.map((project) => (
                  <tr
                    key={project.id}
                    className='border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50'
                  >
                    <td className='py-4'>
                      <div>
                        <p className='font-medium text-zinc-900 dark:text-zinc-100'>
                          {project.name}
                        </p>
                        {project.domain && (
                          <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                            {project.domain}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className='py-4'>
                      <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                        {project.owner?.email || 'Не указан'}
                      </p>
                    </td>
                    <td className='py-4'>
                      <Badge variant='secondary'>{project._count.users}</Badge>
                    </td>
                    <td className='py-4'>
                      <Badge
                        variant={
                          project._count.webhookLogs > 0
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {project._count.webhookLogs}
                      </Badge>
                    </td>
                    <td className='py-4'>
                      <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                        {formatDistanceToNow(new Date(project.createdAt), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </p>
                    </td>
                    <td className='py-4'>
                      <Badge
                        variant={
                          project.widgetVersion === 'universal'
                            ? 'default'
                            : 'secondary'
                        }
                        className={
                          project.widgetVersion === 'universal'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }
                      >
                        {project.widgetVersion === 'legacy'
                          ? 'Legacy'
                          : 'Universal'}
                      </Badge>
                    </td>
                    <td className='py-4 text-right'>
                      <WidgetVersionToggle
                        projectId={project.id}
                        projectName={project.name}
                        currentVersion={project.widgetVersion}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Итоги */}
        <div className='mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800'>
          <p className='text-sm text-zinc-500 dark:text-zinc-400'>
            Показано {sortedProjects.length} из {projects.length} проектов
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
