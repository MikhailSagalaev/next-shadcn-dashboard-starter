/**
 * @file: src/features/projects/components/project-settings-view.tsx
 * @description: Компонент настроек проекта
 * @project: SaaS Bonus System
 * @dependencies: React, form handling
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Bot,
  Users,
  BarChart3,
  Settings,
  Coins,
  Share2,
  Code,
  Zap,
  BookOpen,
  Wrench,
  Library,
  Workflow,
  ShoppingCart,
  Package,
  ShoppingBag,
  Users2,
  Mail,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import type { Project } from '@/types/bonus';
import { ProjectDeleteDialog } from './project-delete-dialog';

interface ProjectSettingsViewProps {
  projectId: string;
}

export function ProjectSettingsView({ projectId }: ProjectSettingsViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    bonusPercentage: 1.0,
    bonusExpiryDays: 365,
    bonusBehavior: 'SPEND_AND_EARN' as 'SPEND_AND_EARN' | 'SPEND_ONLY' | 'EARN_ONLY',
    isActive: true,
    welcomeBonusAmount: 0
  });

  const loadProject = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const projectData = await response.json();
        setProject(projectData);
        setFormData({
          name: projectData.name || '',
          domain: projectData.domain || '',
          bonusPercentage: Number(projectData.bonusPercentage) || 1.0,
          bonusExpiryDays: projectData.bonusExpiryDays || 365,
          bonusBehavior: (projectData.bonusBehavior || 'SPEND_AND_EARN') as 'SPEND_AND_EARN' | 'SPEND_ONLY' | 'EARN_ONLY',
          isActive: projectData.isActive ?? true,
          welcomeBonusAmount: (() => {
            const metaStr = projectData?.referralProgram?.description || null;
            try {
              const meta = metaStr ? JSON.parse(metaStr) : {};
              return Number(meta.welcomeBonus || 0);
            } catch {
              return 0;
            }
          })()
        });
      } else if (response.status === 403) {
        // Проект не принадлежит текущему админу
        toast({
          title: 'Доступ запрещен',
          description: 'Этот проект не принадлежит вашему аккаунту. Если проект был создан до обновления, его нужно привязать через миграцию.',
          variant: 'destructive'
        });
      } else if (response.status === 404) {
        toast({
          title: 'Проект не найден',
          description: 'Проект с указанным ID не существует',
          variant: 'destructive'
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: 'Ошибка загрузки',
          description: errorData.error || 'Не удалось загрузить данные проекта',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки проекта:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные проекта',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]); // Добавляем projectId в зависимости вместо loadProject

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Название проекта обязательно',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.domain.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Домен сайта обязателен',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedProject = await response.json();
        setProject(updatedProject);

        toast({
          title: 'Успех',
          description: 'Настройки проекта обновлены'
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        router.push('/dashboard/projects');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('Ошибка удаления:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-1/3 rounded bg-gray-200'></div>
          <div className='h-4 w-1/2 rounded bg-gray-200'></div>
          <div className='h-32 rounded bg-gray-200'></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center space-y-4 p-8'>
        <div className='text-center space-y-4 max-w-md'>
          <h3 className='text-lg font-semibold'>Проект не найден</h3>
          <p className='text-muted-foreground text-sm'>
            Не удалось загрузить данные проекта. Возможно, проект не принадлежит вашему аккаунту.
          </p>
          <div className='p-4 bg-yellow-50 border border-yellow-200 rounded-md text-left'>
            <p className='text-sm text-yellow-800'>
              <strong>Примечание:</strong> Если проект был создан до обновления, 
              его нужно привязать к вашему аккаунту через миграцию. 
              Запустите: <code className='bg-yellow-100 px-2 py-1 rounded'>npm run migrate-owners migrate &lt;ваш_email&gt;</code>
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => router.push('/dashboard/projects')}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Вернуться к проектам
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      {/* Back Button */}
      <div>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => router.push('/dashboard/projects')}
          className='mb-4'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Назад к проектам
        </Button>
      </div>

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <Heading
            title={`Настройки: ${project?.name || 'Проект'}`}
            description='Основные параметры и конфигурация проекта'
          />
        </div>
        <div className='flex items-center space-x-2'>
          {project?.isActive ? (
            <Badge variant='default' className='bg-green-600'>
              Активен
            </Badge>
          ) : (
            <Badge variant='destructive'>Неактивен</Badge>
          )}
        </div>
      </div>

      <Separator />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Main form */}
        <div className='space-y-6 lg:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Settings className='mr-2 h-5 w-5' />
                Основные настройки
              </CardTitle>
              <CardDescription>
                Базовые параметры проекта бонусной системы
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='name'>Название проекта *</Label>
                    <Input
                      id='name'
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder='Мой интернет-магазин'
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='domain'>Домен сайта *</Label>
                    <Input
                      id='domain'
                      value={formData.domain}
                      onChange={(e) =>
                        setFormData({ ...formData, domain: e.target.value })
                      }
                      placeholder='example.com'
                      required
                    />
                  </div>
                </div>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='welcomeBonusAmount'>
                      Приветственный бонус при регистрации (₽)
                    </Label>
                    <Input
                      id='welcomeBonusAmount'
                      type='number'
                      step='0.01'
                      min='0'
                      value={formData.welcomeBonusAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          welcomeBonusAmount: parseFloat(e.target.value) || 0
                        })
                      }
                      placeholder='0.00'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='bonusBehavior'>Поведение бонусов</Label>
                    <Select
                      value={formData.bonusBehavior}
                      onValueChange={(value: 'SPEND_AND_EARN' | 'SPEND_ONLY' | 'EARN_ONLY') =>
                        setFormData({ ...formData, bonusBehavior: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Выберите поведение бонусов' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='SPEND_AND_EARN'>
                          💰 Списание и начисление (SPEND_AND_EARN)
                        </SelectItem>
                        <SelectItem value='SPEND_ONLY'>
                          💸 Только списание (SPEND_ONLY)
                        </SelectItem>
                        <SelectItem value='EARN_ONLY'>
                          🎁 Только начисление (EARN_ONLY)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className='text-muted-foreground text-xs'>
                      Определяет, можно ли списывать бонусы при покупке и начислять ли новые бонусы
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='bonusPercentage'>Процент бонусов (%)</Label>
                    <Input
                      id='bonusPercentage'
                      type='number'
                      min='0'
                      max='100'
                      step='0.01'
                      value={formData.bonusPercentage}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bonusPercentage: parseFloat(e.target.value) || 0
                        })
                      }
                      placeholder='1.0'
                    />
                    <p className='text-muted-foreground text-xs'>
                      Базовый процент бонусов за каждую покупку
                    </p>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='bonusExpiryDays'>
                      Срок действия бонусов (дни)
                    </Label>
                    <Input
                      id='bonusExpiryDays'
                      type='number'
                      min='1'
                      max='3650'
                      value={formData.bonusExpiryDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bonusExpiryDays: parseInt(e.target.value) || 365
                        })
                      }
                      placeholder='365'
                    />
                    <p className='text-muted-foreground text-xs'>
                      Количество дней до истечения бонусов
                    </p>
                  </div>
                </div>

                <div className='flex items-center space-x-2'>
                  <Switch
                    id='isActive'
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label htmlFor='isActive'>Проект активен</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className='flex justify-end'>
            <div className='flex items-center gap-2'>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
              <Button
                type='button'
                variant='destructive'
                onClick={() => setShowDeleteDialog(true)}
              >
                Удалить проект
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Link href={`/dashboard/projects/${projectId}/bot`}>
                <Button variant='outline' className='w-full justify-start'>
                  <Bot className='mr-2 h-4 w-4' />
                  Настройка Telegram бота
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/users`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Users className='mr-2 h-4 w-4' />
                  Управление пользователями
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/bonus-levels`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Coins className='mr-2 h-4 w-4' />
                  Уровни бонусов
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/referral`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Share2 className='mr-2 h-4 w-4' />
                  Реферальная программа
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/analytics`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <BarChart3 className='mr-2 h-4 w-4' />
                  Статистика и аналитика
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/workflow`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Workflow className='mr-2 h-4 w-4' />
                  Конструктор Workflow
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/integration`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Code className='mr-2 h-4 w-4' />
                  Интеграция на сайт
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Новый функционал - СКРЫТ */}
          {/* 
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Продажи и аналитика</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Link href={`/dashboard/projects/${projectId}/orders`}>
                <Button variant='outline' className='w-full justify-start'>
                  <ShoppingCart className='mr-2 h-4 w-4' />
                  Заказы
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/products`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Package className='mr-2 h-4 w-4' />
                  Товары
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/retailcrm`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <ShoppingBag className='mr-2 h-4 w-4' />
                  RetailCRM
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Маркетинг</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Link href={`/dashboard/projects/${projectId}/segments`}>
                <Button variant='outline' className='w-full justify-start'>
                  <Users2 className='mr-2 h-4 w-4' />
                  Сегменты
                </Button>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/mailings`}>
                <Button variant='outline' className='mt-2 w-full justify-start'>
                  <Mail className='mr-2 h-4 w-4' />
                  Рассылки
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Коммуникации</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Link href={`/dashboard/projects/${projectId}/chats`}>
                <Button variant='outline' className='w-full justify-start'>
                  <MessageSquare className='mr-2 h-4 w-4' />
                  Чаты
                </Button>
              </Link>
            </CardContent>
          </Card>
          */}

          {/* Project Info */}
          {project && (
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Информация о проекте</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div>
                  <Label className='text-sm font-medium'>ID проекта</Label>
                  <p className='text-muted-foreground font-mono text-sm'>
                    {project.id}
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>Webhook Secret</Label>
                  <p className='text-muted-foreground font-mono text-sm'>
                    {project.webhookSecret}
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>Создан</Label>
                  <p className='text-muted-foreground text-sm'>
                    {new Date(project.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div>
                  <Label className='text-sm font-medium'>Обновлен</Label>
                  <p className='text-muted-foreground text-sm'>
                    {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Integration info — удалено по требованию */}
        </div>
      </div>

      {/* Диалог удаления проекта */}
      {project && (
        <ProjectDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          projectName={project.name}
          onConfirm={handleDeleteProject}
        />
      )}
    </div>
  );
}
