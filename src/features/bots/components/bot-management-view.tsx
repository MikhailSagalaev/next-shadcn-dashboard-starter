/**
 * @file: src/features/bots/components/bot-management-view.tsx
 * @description: Улучшенный компонент управления Telegram ботом с выбором workflow
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, API
 * @created: 2025-01-12
 * @updated: 2025-10-12
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Loader2,
  Play,
  Power,
  Edit,
  Save,
  Workflow as WorkflowIcon,
  AlertCircle,
  Check,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Eye,
  EyeOff
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project } from '@/types/bonus';

interface BotManagementViewProps {
  projectId: string;
}

interface BotStatus {
  configured: boolean;
  status: string;
  message: string;
  bot?: {
    id: number;
    username: string;
    firstName: string;
  };
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  nodes: any[];
  connections: any[];
  createdAt: string;
  updatedAt: string;
}

export function BotManagementView({ projectId }: BotManagementViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [editingToken, setEditingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');

  const STATUS_POLL_INTERVAL = 30000; // 30 секунд

  // Form state для настроек токена
  const [tokenForm, setTokenForm] = useState({
    botToken: '',
    botUsername: ''
  });

  const fetchBotStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/bot/status`);
      if (response.ok) {
        const status = await response.json();
        setBotStatus(status);
      }
    } catch (error) {
      console.error('Error checking bot status:', error);
    }
  }, [projectId]);

  const loadWorkflows = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflows`);
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
        
        // Найти активный workflow
        const activeWorkflow = data.workflows?.find((w: Workflow) => w.isActive);
        if (activeWorkflow) {
          setSelectedWorkflowId(activeWorkflow.id);
        }
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем проект
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      let projectData = null;
      if (projectResponse.ok) {
        projectData = await projectResponse.json();
        setProject(projectData);
      }

      // Загружаем настройки бота (токен может быть здесь)
      const botSettingsResponse = await fetch(`/api/projects/${projectId}/bot`);
      if (botSettingsResponse.ok) {
        const botSettingsData = await botSettingsResponse.json();
        // Обновляем проект с токеном из bot settings, если его нет в проекте
        const botToken = botSettingsData.botToken || projectData?.botToken || '';
        const botUsername = botSettingsData.botUsername || projectData?.botUsername || '';
        
        if (projectData) {
          setProject({
            ...projectData,
            botToken: botToken || projectData.botToken,
            botUsername: botUsername || projectData.botUsername
          });
        }
        
        setTokenForm({
          botToken: botToken,
          botUsername: botUsername
        });
      } else {
        // Если bot settings не найдены, используем данные из проекта
        setTokenForm({
          botToken: projectData?.botToken || '',
          botUsername: projectData?.botUsername || ''
        });
      }

      // Загружаем статус бота
      await fetchBotStatus();
      
      // Загружаем workflows
      await loadWorkflows();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить данные бота',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Периодическая проверка статуса
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchBotStatus();
    }, STATUS_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [projectId, fetchBotStatus]);

  const [statusRefreshing, setStatusRefreshing] = useState(false);
  
  const handleRefreshStatus = useCallback(async () => {
    setStatusRefreshing(true);
    try {
      await fetchBotStatus();
    } finally {
      setStatusRefreshing(false);
    }
  }, [fetchBotStatus]);

  const handleSaveToken = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/projects/${projectId}/bot`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          botToken: tokenForm.botToken,
          botUsername: tokenForm.botUsername,
          functionalSettings: {}
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка сохранения токена');
      }

      toast({
        title: 'Успешно',
        description: 'Настройки бота сохранены'
      });

      setEditingToken(false);
      await loadData();
    } catch (error) {
      console.error('Error saving bot token:', error);
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error ? error.message : 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBot = async () => {
    try {
      setToggling(true);

      const isActive = botStatus?.status === 'ACTIVE';
      
      const response = await fetch(`/api/projects/${projectId}/bot/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop: isActive })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка управления ботом');
      }

      toast({
        title: 'Успешно',
        description: isActive ? 'Бот остановлен' : 'Бот запущен'
      });

      // Обновляем статус
      setTimeout(() => {
        void fetchBotStatus();
      }, 2000);
    } catch (error) {
      console.error('Error toggling bot:', error);
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error ? error.message : 'Не удалось управлять ботом',
        variant: 'destructive'
      });
    } finally {
      setToggling(false);
    }
  };

  const handleWorkflowChange = async (workflowId: string) => {
    try {
      setSaving(true);
      
      // Деактивируем все workflow
      for (const workflow of workflows) {
        if (workflow.isActive) {
          await fetch(`/api/projects/${projectId}/workflows/${workflow.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false })
          });
        }
      }
      
      // Активируем выбранный workflow
      if (workflowId) {
        const response = await fetch(`/api/projects/${projectId}/workflows/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true })
        });
        
        if (!response.ok) {
          throw new Error('Не удалось активировать workflow');
        }
        
        toast({
          title: 'Успешно',
          description: 'Активный сценарий изменен'
        });
      }
      
      setSelectedWorkflowId(workflowId);
      await loadWorkflows();
    } catch (error) {
      console.error('Error changing workflow:', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось изменить сценарий',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = !!project?.botToken;
  const isActive = botStatus?.status === 'ACTIVE';
  const activeWorkflow = workflows.find(w => w.isActive);
  const hasWorkflows = workflows.length > 0;

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <Heading
          title="Настройки Telegram бота"
          description="Подключите и настройте Telegram бота для вашего проекта"
        />
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">

        {/* Основной контент - 2 колонки */}
        <div className="lg:col-span-2 space-y-6">
          {/* Предупреждение если нет workflow */}
          {!hasWorkflows && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Сценарий не настроен</p>
              <p className="text-sm">
                Для работы бота необходимо настроить сценарий (workflow). 
                Перейдите в раздел "Шаблоны" и установите готовый сценарий, 
                или создайте свой в конструкторе.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/templates`)}
                >
                  <WorkflowIcon className="h-4 w-4 mr-2" />
                  Выбрать шаблон
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/projects/${projectId}/workflow`)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Создать свой
                </Button>
              </div>
              </div>
            </AlertDescription>
          </Alert>
          )}

          {/* Предупреждение если workflow есть, но бот остановлен */}
          {hasWorkflows && !isActive && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Бот остановлен</p>
              <p className="text-sm">
                Сценарий настроен, но бот не запущен. 
                Нажмите кнопку "Запустить бота" ниже, чтобы начать обработку сообщений.
              </p>
              </div>
            </AlertDescription>
          </Alert>
          )}

          {/* Токен бота */}
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Подключение бота
              </CardTitle>
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
            {isConfigured && (
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {project?.botUsername && `@${project.botUsername}`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">Токен бота</Label>
            <div className="flex gap-2">
              <Input
                id="botToken"
                type={editingToken || showToken ? 'text' : 'password'}
                value={
                  editingToken
                    ? tokenForm.botToken
                    : project?.botToken && project.botToken.length > 0
                      ? showToken
                        ? project.botToken
                        : project.botToken.replace(/./g, '•')
                      : ''
                }
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, botToken: e.target.value })
                }
                placeholder={
                  project?.botToken && project.botToken.length > 0
                    ? undefined
                    : 'Вставьте токен от @BotFather (https://t.me/botfather)'
                }
                disabled={!editingToken}
              />
              {!editingToken ? (
                <>
                  {project?.botToken && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowToken(!showToken)}
                      title={showToken ? 'Скрыть токен' : 'Показать токен'}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
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
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingToken(false);
                      setShowToken(false);
                      setTokenForm({
                        botToken: project?.botToken || '',
                        botUsername: project?.botUsername || ''
                      });
                    }}
                  >
                    Отмена
                  </Button>
                  <Button onClick={handleSaveToken} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
            {botStatus?.bot && (
              <p className="text-sm text-muted-foreground">
                Подключен: {botStatus.bot.firstName} (@{botStatus.bot.username})
              </p>
            )}
            </div>
          </CardContent>
        </Card>

          {/* Активный сценарий */}
          {hasWorkflows && (
            <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WorkflowIcon className="h-5 w-5" />
              Активный сценарий
            </CardTitle>
            <CardDescription>
              Выберите сценарий, который будет обрабатывать сообщения бота
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow">Сценарий (Workflow)</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedWorkflowId}
                  onValueChange={handleWorkflowChange}
                  disabled={saving}
                >
                  <SelectTrigger id="workflow">
                    <SelectValue placeholder="Выберите сценарий" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        <div className="flex items-center gap-2">
                          <span>{workflow.name}</span>
                          {workflow.isActive && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/projects/${projectId}/workflow`)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              {activeWorkflow && (
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm font-medium">{activeWorkflow.name}</p>
                  </div>
                  {activeWorkflow.description && (
                    <p className="text-sm text-muted-foreground ml-6">
                      {activeWorkflow.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground ml-6">
                    {activeWorkflow.nodes.length} узлов, {activeWorkflow.connections.length} связей
                  </p>
                </div>
              )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Управление ботом */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Управление ботом
          </CardTitle>
          <CardDescription>Запустите или остановите бота</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Статус: {isActive ? 'Активен' : 'Остановлен'}
              </p>
              <p className="text-xs text-muted-foreground">
                {botStatus?.message || 'Бот не настроен'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshStatus}
                disabled={statusRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${statusRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={handleToggleBot}
                disabled={!isConfigured || toggling}
                variant={isActive ? 'destructive' : 'default'}
              >
                {toggling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isActive ? (
                  <Power className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isActive ? 'Остановить' : 'Запустить'}
              </Button>
            </div>
          </div>

          {isActive && activeWorkflow && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium text-green-700">Бот работает</p>
                  <p className="text-sm">
                    Выполняется сценарий: <span className="font-medium">{activeWorkflow.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Бот обрабатывает сообщения согласно настроенному workflow
                  </p>
                </div>
              </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Сайдбар справа - 1 колонка */}
        <div className="lg:col-span-1 space-y-6">
          {/* Быстрые действия */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Быстрые действия</CardTitle>
              <CardDescription className="text-sm">Управление сценариями и шаблонами</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/dashboard/projects/${projectId}/workflow`)}
              >
                <WorkflowIcon className="h-4 w-4 mr-2" />
                Конструктор Workflow
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/dashboard/templates`)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Шаблоны
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Статус workflow */}
          {activeWorkflow && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Информация о сценарии</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Узлов:</span>
                    <span className="font-medium">{activeWorkflow.nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Связей:</span>
                    <span className="font-medium">{activeWorkflow.connections.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Обновлён:</span>
                    <span className="font-medium text-xs">
                      {new Date(activeWorkflow.updatedAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
