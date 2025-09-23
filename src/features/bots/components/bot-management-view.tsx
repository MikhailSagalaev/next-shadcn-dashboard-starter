/**
 * @file: src/features/bots/components/bot-management-view.tsx
 * @description: Компонент управления Telegram ботом с настройками сообщений
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, API
 * @created: 2025-01-23
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Settings,
  MessageSquare,
  Power,
  AlertCircle,
  Check,
  X,
  Loader2,
  TestTube,
  Play,
  MessageCircle,
  Gift,
  Users,
  Save,
  Edit,
  RefreshCw,
  Target,
  Plus,
  Trash2,
  Image,
  Link
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Project, BotSettings } from '@/types/bonus';
import { BotTestDialog } from './bot-test-dialog';

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
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [editingToken, setEditingToken] = useState(false);

  // Form state для настроек токена
  const [tokenForm, setTokenForm] = useState({
    botToken: '',
    botUsername: ''
  });

  // Form state для настроек сообщений
  const [messages, setMessages] = useState({
    welcomeMessage: '🤖 Добро пожаловать в бонусную программу!',
    helpMessage:
      'ℹ️ Доступные команды:\n/balance - проверить баланс\n/history - история операций\n/help - помощь',
    linkSuccessMessage: '✅ Аккаунт успешно привязан!',
    linkFailMessage: '❌ Не удалось найти аккаунт. Обратитесь в поддержку.',
    balanceMessage:
      '💰 Ваш баланс: {balance}₽\n🏆 Всего заработано: {totalEarned}₽',
    errorMessage: '❌ Произошла ошибка. Попробуйте позже.'
  });

  // Дополнительные настройки для расширенных сообщений
  const [advancedSettings, setAdvancedSettings] = useState({
    welcomeImageUrl: '',
    welcomeButtons: [] as Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>,
    helpImageUrl: '',
    helpButtons: [] as Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>,
    balanceImageUrl: '',
    balanceButtons: [] as Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>
  });

  // Form state для функционала (соответствует схеме БД)
  const [features, setFeatures] = useState({
    showBalance: true,
    showLevel: true,
    showReferral: true,
    showHistory: true,
    showHelp: true
  });

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем проект
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProject(projectData);
      }

      // Загружаем настройки бота
      const botResponse = await fetch(`/api/projects/${projectId}/bot`);
      if (botResponse.ok) {
        const botData = await botResponse.json();
        setBotSettings(botData);

        // Загружаем настройки токена
        setTokenForm({
          botToken: botData?.botToken || '',
          botUsername: botData?.botUsername || ''
        });

        // Загружаем настройки сообщений
        if (botData?.messageSettings) {
          setMessages({ ...messages, ...botData.messageSettings });

          // Загружаем расширенные настройки (кнопки и изображения)
          if (botData.messageSettings.advancedSettings) {
            setAdvancedSettings({
              ...advancedSettings,
              ...botData.messageSettings.advancedSettings
            });
          }
        }

        // Загружаем настройки функционала
        if (botData?.functionalSettings) {
          setFeatures({ ...features, ...botData.functionalSettings });
        }
      }

      // Проверяем статус бота
      await checkBotStatus();
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBotStatus = async () => {
    try {
      setChecking(true);
      const response = await fetch(`/api/projects/${projectId}/bot/status`, {
        cache: 'no-store'
      });
      if (response.ok) {
        const status = await response.json();
        setBotStatus(status);

        // Обновляем проект с актуальным статусом
        if (project) {
          setProject({
            ...project,
            botStatus: status.status,
            botUsername: status.bot?.username || project.botUsername
          });
        }
      }
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось проверить статус бота',
        variant: 'destructive'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleStartBot = async () => {
    try {
      setStarting(true);
      const response = await fetch(`/api/projects/${projectId}/bot/setup`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Бот успешно запущен'
        });
        await checkBotStatus();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось запустить бота',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось запустить бота',
        variant: 'destructive'
      });
    } finally {
      setStarting(false);
    }
  };

  const handleRestartBot = async () => {
    try {
      setStarting(true);
      const response = await fetch(`/api/projects/${projectId}/bot/restart`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Бот успешно перезапущен'
        });
        await checkBotStatus();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось перезапустить бота',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось перезапустить бота',
        variant: 'destructive'
      });
    } finally {
      setStarting(false);
    }
  };

  const handleStopAllBots = async () => {
    if (
      !confirm(
        '⚠️ ЭКСТРЕННАЯ ОСТАНОВКА всех ботов в системе? Это может повлиять на других пользователей!'
      )
    ) {
      return;
    }

    try {
      setStarting(true);
      const response = await fetch(`/api/admin/bots/stop-all`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Экстренная остановка',
          description: result.message,
          variant: result.errors?.length > 0 ? 'destructive' : 'default'
        });
        await checkBotStatus();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось остановить ботов',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось остановить ботов',
        variant: 'destructive'
      });
    } finally {
      setStarting(false);
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
          botUsername: tokenForm.botUsername,
          isActive: true
        })
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Токен бота сохранен'
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
        description: 'Не удалось сохранить токен',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMessages = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectId}/bot/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageSettings: messages,
          advancedSettings: advancedSettings
        })
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Сообщения сохранены'
        });
        await loadData();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось сохранить сообщения',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить сообщения',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Функции для работы с кнопками
  const addButton = (messageType: 'welcome' | 'help' | 'balance') => {
    const buttonKey = `${messageType}Buttons` as keyof typeof advancedSettings;
    setAdvancedSettings((prev) => ({
      ...prev,
      [buttonKey]: [...(prev[buttonKey] as any[]), { text: '', url: '' }]
    }));
  };

  const removeButton = (
    messageType: 'welcome' | 'help' | 'balance',
    index: number
  ) => {
    const buttonKey = `${messageType}Buttons` as keyof typeof advancedSettings;
    setAdvancedSettings((prev) => ({
      ...prev,
      [buttonKey]: (prev[buttonKey] as any[]).filter((_, i) => i !== index)
    }));
  };

  const updateButton = (
    messageType: 'welcome' | 'help' | 'balance',
    index: number,
    field: 'text' | 'url' | 'callback_data',
    value: string
  ) => {
    const buttonKey = `${messageType}Buttons` as keyof typeof advancedSettings;
    setAdvancedSettings((prev) => ({
      ...prev,
      [buttonKey]: (prev[buttonKey] as any[]).map((btn, i) =>
        i === index ? { ...btn, [field]: value } : btn
      )
    }));
  };

  const handleSaveFeatures = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectId}/bot/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionalSettings: features
        })
      });

      if (response.ok) {
        toast({
          title: 'Успех',
          description: 'Настройки функционала сохранены'
        });
        await loadData();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось сохранить настройки',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => router.push('/dashboard/projects')}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Назад к проектам
          </Button>
          <div>
            <Heading
              title={`Управление ботом: ${project?.name || 'Проект'}`}
              description='Настройка Telegram бота и его функционала'
            />
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          {botSettings?.botToken && (
            <>
              <Button size='sm' onClick={handleStartBot} disabled={starting}>
                {starting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Play className='mr-2 h-4 w-4' />
                )}
                Запустить бота
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={handleRestartBot}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <RefreshCw className='mr-2 h-4 w-4' />
                )}
                Перезапустить
              </Button>
              <Button
                size='sm'
                variant='destructive'
                onClick={handleStopAllBots}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <X className='mr-2 h-4 w-4' />
                )}
                🚨 Остановить все
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Bot Status */}
      <Alert
        className={
          botStatus?.status === 'ACTIVE'
            ? 'border-green-200 bg-green-50'
            : botStatus?.status === 'ERROR'
              ? 'border-red-200 bg-red-50'
              : 'border-yellow-200 bg-yellow-50'
        }
      >
        <div className='flex w-full items-center justify-between'>
          <div className='flex flex-1 items-center space-x-2'>
            {botStatus?.status === 'ACTIVE' ? (
              <Check className='h-4 w-4 text-green-600' />
            ) : botStatus?.status === 'ERROR' ? (
              <X className='h-4 w-4 text-red-600' />
            ) : (
              <AlertCircle className='h-4 w-4 text-yellow-600' />
            )}
            <AlertDescription
              className={
                botStatus?.status === 'ACTIVE'
                  ? 'text-green-800'
                  : botStatus?.status === 'ERROR'
                    ? 'text-red-800'
                    : 'text-yellow-800'
              }
            >
              <div className='font-medium'>
                Статус бота:{' '}
                {botStatus?.status === 'ACTIVE'
                  ? 'Активен'
                  : botStatus?.status === 'ERROR'
                    ? 'Ошибка'
                    : botStatus?.configured === false
                      ? 'Не настроен'
                      : 'Неактивен'}
              </div>
              <div className='mt-1 text-sm'>
                {botStatus?.message}
                {botStatus?.bot?.username && ` • @${botStatus.bot.username}`}
                {botStatus?.bot?.firstName && ` • ${botStatus.bot.firstName}`}
              </div>
            </AlertDescription>
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={checkBotStatus}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Settings className='mr-2 h-4 w-4' />
              )}
              {checking ? 'Проверяем...' : 'Проверить'}
            </Button>
          </div>
        </div>
      </Alert>

      {/* Main Content */}
      <Tabs defaultValue='settings' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='settings'>
            <Bot className='mr-2 h-4 w-4' />
            Настройки
          </TabsTrigger>
          <TabsTrigger value='messages'>
            <MessageSquare className='mr-2 h-4 w-4' />
            Сообщения
          </TabsTrigger>
          <TabsTrigger value='features'>
            <Settings className='mr-2 h-4 w-4' />
            Функционал
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value='settings' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Настройка токена бота</CardTitle>
              <CardDescription>
                Основные настройки для подключения Telegram бота
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='botToken'>Токен бота</Label>
                  <div className='flex space-x-2'>
                    <Input
                      id='botToken'
                      value={
                        editingToken ? tokenForm.botToken : '••••••••••••••••'
                      }
                      onChange={(e) =>
                        setTokenForm({ ...tokenForm, botToken: e.target.value })
                      }
                      disabled={!editingToken}
                      type={editingToken ? 'text' : 'password'}
                      placeholder='1234567890:ABCdefGHIjklmnoPQRstuvwxyz'
                    />
                    <Button
                      variant='outline'
                      onClick={() => setEditingToken(!editingToken)}
                      disabled={saving}
                    >
                      <Edit className='h-4 w-4' />
                    </Button>
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    Получите токен у @BotFather в Telegram
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='botUsername'>Имя пользователя бота</Label>
                  <Input
                    id='botUsername'
                    value={tokenForm.botUsername}
                    onChange={(e) =>
                      setTokenForm({
                        ...tokenForm,
                        botUsername: e.target.value
                      })
                    }
                    disabled={!editingToken}
                    placeholder='@your_bot_name'
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
                      onClick={() => setEditingToken(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                )}

                {botSettings && (
                  <div className='flex items-center space-x-2 pt-4'>
                    <Badge
                      variant={botSettings.isActive ? 'default' : 'secondary'}
                    >
                      {botSettings.isActive ? 'Активен' : 'Неактивен'}
                    </Badge>
                    <span className='text-muted-foreground text-sm'>
                      Обновлено:{' '}
                      {new Date(botSettings.updatedAt).toLocaleString('ru-RU')}
                    </span>
                  </div>
                )}
              </div>

              {!botSettings?.botToken && (
                <Alert>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>
                    Настройте токен бота для начала работы. Получите токен у
                    @BotFather в Telegram.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value='messages' className='space-y-6'>
          {/* Приветственное сообщение */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center space-x-2'>
                <MessageCircle className='h-5 w-5' />
                <span>Приветственное сообщение</span>
              </CardTitle>
              <CardDescription>
                Сообщение, которое отправляется при команде /start
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='welcomeMessage'>Текст сообщения</Label>
                <Textarea
                  id='welcomeMessage'
                  value={messages.welcomeMessage}
                  onChange={(e) =>
                    setMessages({ ...messages, welcomeMessage: e.target.value })
                  }
                  placeholder='Добро пожаловать в бонусную программу!'
                  rows={4}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='welcomeImageUrl'>
                  URL изображения (опционально)
                </Label>
                <div className='flex space-x-2'>
                  <Input
                    id='welcomeImageUrl'
                    value={advancedSettings.welcomeImageUrl}
                    onChange={(e) =>
                      setAdvancedSettings((prev) => ({
                        ...prev,
                        welcomeImageUrl: e.target.value
                      }))
                    }
                    placeholder='https://example.com/image.jpg'
                  />
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setAdvancedSettings((prev) => ({
                        ...prev,
                        welcomeImageUrl: ''
                      }))
                    }
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label>Кнопки (опционально)</Label>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => addButton('welcome')}
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Добавить кнопку
                  </Button>
                </div>
                {advancedSettings.welcomeButtons.map((button, index) => (
                  <div
                    key={index}
                    className='flex space-x-2 rounded-lg border p-3'
                  >
                    <Input
                      placeholder='Текст кнопки'
                      value={button.text}
                      onChange={(e) =>
                        updateButton('welcome', index, 'text', e.target.value)
                      }
                    />
                    <Input
                      placeholder='URL или callback_data'
                      value={button.url || button.callback_data || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith('http')) {
                          updateButton('welcome', index, 'url', value);
                        } else {
                          updateButton(
                            'welcome',
                            index,
                            'callback_data',
                            value
                          );
                        }
                      }}
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => removeButton('welcome', index)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Сообщение помощи */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center space-x-2'>
                <MessageSquare className='h-5 w-5' />
                <span>Сообщение помощи</span>
              </CardTitle>
              <CardDescription>
                Сообщение, которое отправляется при команде /help
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='helpMessage'>Текст сообщения</Label>
                <Textarea
                  id='helpMessage'
                  value={messages.helpMessage}
                  onChange={(e) =>
                    setMessages({ ...messages, helpMessage: e.target.value })
                  }
                  placeholder='Доступные команды...'
                  rows={4}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='helpImageUrl'>
                  URL изображения (опционально)
                </Label>
                <div className='flex space-x-2'>
                  <Input
                    id='helpImageUrl'
                    value={advancedSettings.helpImageUrl}
                    onChange={(e) =>
                      setAdvancedSettings((prev) => ({
                        ...prev,
                        helpImageUrl: e.target.value
                      }))
                    }
                    placeholder='https://example.com/image.jpg'
                  />
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setAdvancedSettings((prev) => ({
                        ...prev,
                        helpImageUrl: ''
                      }))
                    }
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label>Кнопки (опционально)</Label>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => addButton('help')}
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Добавить кнопку
                  </Button>
                </div>
                {advancedSettings.helpButtons.map((button, index) => (
                  <div
                    key={index}
                    className='flex space-x-2 rounded-lg border p-3'
                  >
                    <Input
                      placeholder='Текст кнопки'
                      value={button.text}
                      onChange={(e) =>
                        updateButton('help', index, 'text', e.target.value)
                      }
                    />
                    <Input
                      placeholder='URL или callback_data'
                      value={button.url || button.callback_data || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith('http')) {
                          updateButton('help', index, 'url', value);
                        } else {
                          updateButton('help', index, 'callback_data', value);
                        }
                      }}
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => removeButton('help', index)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Сообщение баланса */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center space-x-2'>
                <Gift className='h-5 w-5' />
                <span>Сообщение баланса</span>
              </CardTitle>
              <CardDescription>
                Шаблон сообщения с балансом пользователя
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='balanceMessage'>Шаблон сообщения</Label>
                <Textarea
                  id='balanceMessage'
                  value={messages.balanceMessage}
                  onChange={(e) =>
                    setMessages({ ...messages, balanceMessage: e.target.value })
                  }
                  placeholder='Используйте {balance}, {totalEarned} для подстановки значений'
                  rows={3}
                />
                <p className='text-muted-foreground text-sm'>
                  Доступные переменные: {'{balance}'}, {'{totalEarned}'},{' '}
                  {'{level}'}
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='balanceImageUrl'>
                  URL изображения (опционально)
                </Label>
                <div className='flex space-x-2'>
                  <Input
                    id='balanceImageUrl'
                    value={advancedSettings.balanceImageUrl}
                    onChange={(e) =>
                      setAdvancedSettings((prev) => ({
                        ...prev,
                        balanceImageUrl: e.target.value
                      }))
                    }
                    placeholder='https://example.com/image.jpg'
                  />
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setAdvancedSettings((prev) => ({
                        ...prev,
                        balanceImageUrl: ''
                      }))
                    }
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label>Кнопки (опционально)</Label>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => addButton('balance')}
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Добавить кнопку
                  </Button>
                </div>
                {advancedSettings.balanceButtons.map((button, index) => (
                  <div
                    key={index}
                    className='flex space-x-2 rounded-lg border p-3'
                  >
                    <Input
                      placeholder='Текст кнопки'
                      value={button.text}
                      onChange={(e) =>
                        updateButton('balance', index, 'text', e.target.value)
                      }
                    />
                    <Input
                      placeholder='URL или callback_data'
                      value={button.url || button.callback_data || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith('http')) {
                          updateButton('balance', index, 'url', value);
                        } else {
                          updateButton(
                            'balance',
                            index,
                            'callback_data',
                            value
                          );
                        }
                      }}
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => removeButton('balance', index)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Простые сообщения */}
          <Card>
            <CardHeader>
              <CardTitle>Прочие сообщения</CardTitle>
              <CardDescription>Системные сообщения бота</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='linkSuccessMessage'>Успешная привязка</Label>
                  <Textarea
                    id='linkSuccessMessage'
                    value={messages.linkSuccessMessage}
                    onChange={(e) =>
                      setMessages({
                        ...messages,
                        linkSuccessMessage: e.target.value
                      })
                    }
                    rows={2}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='linkFailMessage'>Ошибка привязки</Label>
                  <Textarea
                    id='linkFailMessage'
                    value={messages.linkFailMessage}
                    onChange={(e) =>
                      setMessages({
                        ...messages,
                        linkFailMessage: e.target.value
                      })
                    }
                    rows={2}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='errorMessage'>Сообщение об ошибке</Label>
                <Input
                  id='errorMessage'
                  value={messages.errorMessage}
                  onChange={(e) =>
                    setMessages({ ...messages, errorMessage: e.target.value })
                  }
                  placeholder='Произошла ошибка...'
                />
              </div>
            </CardContent>
          </Card>

          {/* Кнопка сохранения */}
          <div className='flex justify-end'>
            <Button onClick={handleSaveMessages} disabled={saving} size='lg'>
              {saving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className='mr-2 h-4 w-4' />
                  Сохранить все настройки
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value='features' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Функционал бота</CardTitle>
              <CardDescription>
                Включите или отключите различные функции бота
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <div className='flex items-center space-x-2'>
                      <Users className='h-4 w-4' />
                      <Label className='font-medium'>
                        Реферальная программа
                      </Label>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      Позволяет пользователям приглашать друзей и получать
                      бонусы
                    </p>
                  </div>
                  <Switch
                    checked={features.showReferral}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, showReferral: checked })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <div className='flex items-center space-x-2'>
                      <MessageCircle className='h-4 w-4' />
                      <Label className='font-medium'>История операций</Label>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      Показывает историю начислений и списаний бонусов
                    </p>
                  </div>
                  <Switch
                    checked={features.showHistory}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, showHistory: checked })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <div className='flex items-center space-x-2'>
                      <Gift className='h-4 w-4' />
                      <Label className='font-medium'>Показывать баланс</Label>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      Показывать кнопку &quot;💰 Баланс&quot; в меню бота
                    </p>
                  </div>
                  <Switch
                    checked={features.showBalance}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, showBalance: checked })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <div className='flex items-center space-x-2'>
                      <Target className='h-4 w-4' />
                      <Label className='font-medium'>Показывать уровень</Label>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      Показывать кнопку &quot;🏆 Уровень&quot; в меню бота
                    </p>
                  </div>
                  <Switch
                    checked={features.showLevel}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, showLevel: checked })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <div className='flex items-center space-x-2'>
                      <MessageSquare className='h-4 w-4' />
                      <Label className='font-medium'>Показывать помощь</Label>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      Показывать кнопку &quot;ℹ️ Помощь&quot; в меню бота
                    </p>
                  </div>
                  <Switch
                    checked={features.showHelp}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, showHelp: checked })
                    }
                  />
                </div>
              </div>

              <Button onClick={handleSaveFeatures} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Сохранить настройки
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Dialog */}
      {project && (
        <BotTestDialog
          project={project}
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
        />
      )}
    </div>
  );
}
