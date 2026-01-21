/**
 * @file: projects-bonus-overview.tsx
 * @description: Обзор проектов с бонусами (Client Component)
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 */

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ExternalLink, Star, Users, Gift } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  userCount: number;
  bonusCount: number;
}

interface ProjectsBonusOverviewProps {
  projects: Project[];
}

export function ProjectsBonusOverview({
  projects
}: ProjectsBonusOverviewProps) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <Card className='h-full border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>Проекты</CardTitle>
          <CardDescription>Обзор бонусных программ</CardDescription>
        </CardHeader>
        <CardContent className='flex h-[200px] items-center justify-center text-sm text-zinc-500'>
          Нет активных проектов
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Проекты с бонусными программами
        </CardTitle>
        <CardDescription>Обзор активных программ лояльности</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {projects.map((project, index) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={project.id}
              className='group flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-4 transition-all hover:border-indigo-100 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900/50'
            >
              <div className='flex items-center space-x-4'>
                <div className='relative'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20'>
                    <Star className='h-6 w-6 fill-white/20' />
                  </div>
                </div>

                <div className='space-y-1'>
                  <p
                    className='cursor-pointer text-base leading-none font-medium text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400'
                    onClick={() =>
                      router.push(`/dashboard/projects/${project.id}`)
                    }
                  >
                    {project.name}
                  </p>
                  <div className='flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400'>
                    <div className='flex items-center gap-1.5'>
                      <Users className='h-4 w-4' />
                      <span>{project.userCount} пользователей</span>
                    </div>
                    <span className='h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700' />
                    <div className='flex items-center gap-1.5'>
                      <Gift className='h-4 w-4' />
                      <span>{project.bonusCount} бонусов</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100'>
                <button
                  onClick={() =>
                    router.push(`/dashboard/projects/${project.id}`)
                  }
                  className='rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
                >
                  <ExternalLink className='h-4 w-4' />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
