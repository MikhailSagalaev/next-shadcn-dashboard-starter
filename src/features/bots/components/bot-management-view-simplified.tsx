/**
 * @file: src/features/bots/components/bot-management-view-simplified.tsx
 * @description: Упрощенный компонент управления Telegram ботом (только токен и статус)
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, API
 * @created: 2025-01-12
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Loader2,
  Play,
  Power,
  Edit,
  Save,
  Workflow,
  AlertCircle,
  Check,
  RefreshCw
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
import { Badge } from '@/components/ui/badge';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/types/bonus';

interface BotManagementViewProps {
  projectId: string;
}

interface BotStatus {
  configured: boolean;
  status: string; // 'ACTIVE' | 'INACTIVE' | 'ERROR'
  message: string;
  bot?: {
    id: number;
    username: string;
    firstName: string;
  };
}

export function BotManagementView({ projectId }: BotManagementViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [editingToken, setEditingToken] = useState(false);

  // Form state для настроек токена
  const [tokenForm, setTokenForm] = useState({
    botToken: '',
    botUsername: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем проект
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProject(projectData);
        setTokenForm({
          botToken: projectData.botToken || '',
          botUsername: projectData.botUsername || ''
        });
      }

      // Загружаем статус бота
      await checkBotStatus();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Проверяем статус каждые 10 секунд
    const interval = setInterval(checkBotStatus, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  const checkBotStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/bot/status`);
      if (response.ok) {
        const status = await response.json();
        setBotStatus(status);
      }
    } catch (error) {
      console.error('Error checking bot status:', error);
    }
  };

  const handleSaveToken = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectId}/bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tokenForm.botToken,
          botUsername: tokenForm.botUsername
        })
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Токен бота успешно сохранён'
        });
        setEditingToken(false);
        await loadData();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось сохранить токен',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при сохранении токена',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBot = async () => {
    const isActive = botStatus?.status === 'ACTIVE';
    
    try {
      setToggling(true);
      
      if (isActive) {
        // Останавливаем бота
        const response = await fetch(`/api/projects/${projectId}/bot/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stop: true })
        });

        if (response.ok) {
          toast({
            title: 'Успех',
            description: 'Бот остановлен'
          });
        } else {
          const error = await response.json();
          toast({
            title: 'Ошибка',
            description: error.error || 'Не удалось остановить бота',
            variant: 'destructive'
          });
        }
      } else {
        // Запускаем бота
        const response = await fetch(`/api/projects/${projectId}/bot/setup`, {
          method: 'POST'
        });

        if (response.ok) {
          toast({
            title: 'Успех',
            description: 'Бот успешно запущен'
          });
        } else {
          const error = await response.json();
          toast({
            title: 'Ошибка',
            description: error.error || 'Не удалось запустить бота',
            variant: 'destructive'
          });
        }
      }
      
      await checkBotStatus();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка',
        variant: 'destructive'
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  const isActive = botStatus?.status === 'ACTIVE';
  const isConfigured = botStatus?.configured;

  return (
    <div className='space-y-6'>
      {/* Заголовок */}
      <div className='flex items-center justify-between'>
        <div>
          <Heading
            title='Настройка Telegram бота'
            description='Подключите бота и настройте его поведение через конструктор workflow'
          />
        </div>
      </div>

      <Separator />

      {/* Токен бота */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Подключение бота</CardTitle>
              <CardDescription>
                Получите токен у{' '}
                <a 
                  href="https://t.me/botfather" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                >
                  @BotFather
                </a>{' '}
                в Telegram
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              {isConfigured && (
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {isActive ? (
                    <>
                      <Check className='mr-1 h-3 w-3' />
                      Активен
                    </>
                  ) : (
                    <>
                      <AlertCircle className='mr-1 h-3 w-3' />
                      Неактивен
                    </>
                  )}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='botToken'>Токен бота</Label>
            <div className='flex space-x-2'>
              <Input
                id='botToken'
                value={
                  editingToken
                    ? tokenForm.botToken
                    : project?.botToken
                      ? project.botToken.replace(/./g, '•')
                      : ''
                }
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, botToken: e.target.value })
                }
                disabled={!editingToken}
                type={editingToken ? 'text' : 'password'}
                placeholder={
                  project?.botToken
                    ? undefined
                    : '1234567890:ABCdefGHIjklmnoPQRstuvwxyz'
                }
              />
              {!editingToken && project?.botToken && (
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    // Подтягиваем токен из проекта при входе в режим редактирования
                    if (project?.botToken && !tokenForm.botToken) {
                      setTokenForm({
                        botToken: project.botToken,
                        botUsername: project.botUsername || ''
                      });
                    }
                    setEditingToken(true);
                  }}
                  title="Редактировать токен"
                >
                  <Edit className='h-4 w-4' />
                </Button>
              )}
              {!editingToken && !project?.botToken && (
                <Button
                  variant='outline'
                  onClick={() => setEditingToken(true)}
                  disabled={saving}
                >
                  <Edit className='h-4 w-4 mr-2' />
                  Добавить токен
                </Button>
              )}
              {editingToken && (
                <>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setEditingToken(false);
                      setTokenForm({
                        botToken: project?.botToken || '',
                        botUsername: project?.botUsername || ''
                      });
                    }}
                    disabled={saving}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={handleSaveToken}
                    disabled={saving}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='botUsername'>Имя пользователя бота</Label>
            <Input
              id='botUsername'
              value={tokenForm.botUsername}
              onChange={(e) =>
                setTokenForm({ ...tokenForm, botUsername: e.target.value })
              }
              disabled={!editingToken}
              placeholder='mybot'
            />
          </div>

          {editingToken && (
            <div className='flex space-x-2'>
              <Button onClick={handleSaveToken} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Сохранить токен
                  </>
                )}
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  setEditingToken(false);
                  setTokenForm({
                    botToken: project?.botToken || '',
                    botUsername: project?.botUsername || ''
                  });
                }}
                disabled={saving}
              >
                Отмена
              </Button>
            </div>
          )}

          {botStatus?.bot && (
            <Alert>
              <Bot className='h-4 w-4' />
              <AlertDescription>
                <strong>@{botStatus.bot.username}</strong> • {botStatus.bot.firstName}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Управление ботом */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Управление ботом</CardTitle>
            <CardDescription>
              Запустите или остановите бота
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium'>Статус бота</p>
                <p className='text-muted-foreground text-sm'>
                  {isActive 
                    ? 'Бот запущен и обрабатывает сообщения' 
                    : 'Бот остановлен'}
                </p>
              </div>
              <Button
                onClick={handleToggleBot}
                disabled={toggling}
                variant={isActive ? 'destructive' : 'default'}
              >
                {toggling ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : isActive ? (
                  <Power className='mr-2 h-4 w-4' />
                ) : (
                  <Play className='mr-2 h-4 w-4' />
                )}
                {isActive ? 'Остановить' : 'Запустить'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Конструктор Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Настройка поведения бота</CardTitle>
          <CardDescription>
            Используйте конструктор workflow для создания логики бота
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className='mb-4'>
            <Workflow className='h-4 w-4' />
            <AlertDescription>
              Все сообщения, команды и действия бота настраиваются через конструктор workflow.
              Это позволяет гибко управлять поведением бота без конфликтов.
            </AlertDescription>
          </Alert>
          
          <Button
            onClick={() => router.push(`/dashboard/projects/${projectId}/workflow`)}
            size='lg'
            className='w-full'
          >
            <Workflow className='mr-2 h-4 w-4' />
            Открыть конструктор Workflow
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

