/**
 * @file: tilda-integration-view.tsx
 * @description: Компонент для настройки интеграции с Tilda
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Copy,
  CheckCircle2,
  AlertCircle,
  Code,
  Webhook,
  FileText,
  Clock,
  Settings,
  Save
} from 'lucide-react';
import { Project } from '@/types';
import { PageContainer } from '@/components/page-container';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { WebhookLogEntry } from '@/types/api-responses';
import { ProjectLogsView } from '@/features/projects/components/project-logs-view';

export function ProjectIntegrationView({
  params: _params
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [widgetUrl, setWidgetUrl] = useState('');
  const [recentLogs, setRecentLogs] = useState<WebhookLogEntry[]>([]);
  const [recentLogsLoading, setRecentLogsLoading] = useState<boolean>(false);
  const [widgetSettings, setWidgetSettings] = useState({
    // Текстовые настройки
    registrationTitle: 'Зарегистрируйся и получи {bonusAmount} бонусов!',
    registrationDescription: 'Зарегистрируйся в нашей бонусной программе',
    registrationButtonText: 'Для участия в акции перейдите в бота',
    registrationFallbackText: 'Свяжитесь с администратором для регистрации',

    // Настройки видимости элементов
    showIcon: true,
    showTitle: true,
    showDescription: true,
    showButton: true,
    showFallbackText: true,

    // Цветовые настройки
    backgroundColor: '#667eea',
    backgroundGradient: '#764ba2',
    textColor: '#ffffff',
    titleColor: '#ffffff',
    descriptionColor: '#ffffff',
    fallbackTextColor: '#ffffff',
    buttonTextColor: '#ffffff',
    buttonBackgroundColor: 'rgba(255,255,255,0.2)',
    buttonBorderColor: 'rgba(255,255,255,0.3)',
    buttonHoverColor: 'rgba(255,255,255,0.3)',
    fallbackBackgroundColor: 'rgba(0,0,0,0.1)',

    // Размеры и отступы
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    iconSize: '24px',
    titleFontSize: '18px',
    titleFontWeight: 'bold',
    descriptionFontSize: '14px',
    buttonFontSize: '14px',
    buttonFontWeight: '500',
    buttonPadding: '8px 16px',
    buttonBorderRadius: '6px',
    fallbackFontSize: '14px',
    fallbackPadding: '8px',
    fallbackBorderRadius: '4px',

    // Эффекты и тени
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    buttonBoxShadow: 'none',
    iconAnimation: 'none', // none, pulse, bounce, shake

    // Эмодзи и иконки
    iconEmoji: '🎁',
    iconColor: '#ffffff',

    // Дополнительные настройки
    maxWidth: '100%',
    textAlign: 'center',
    buttonWidth: 'auto',
    buttonDisplay: 'inline-block',
    fontSize: '14px'
  });
  const [saving, setSaving] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const resolvedParams = useParams();
  const projectId = resolvedParams?.id as string;

  useEffect(() => {
    if (!projectId) return;

    // Формируем короткий URL загрузчика виджета
    const currentUrl = window.location.origin;
    setWidgetUrl(`${currentUrl}/widget/${projectId}`);

    // Загружаем данные проекта
    loadProject();
    // Загружаем последние логи
    loadRecentLogs();
  }, [projectId]);

  async function loadProject() {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');

      const data = await response.json();
      setProject(data);

      // Загружаем настройки виджета из botSettings
      try {
        const botResponse = await fetch(`/api/projects/${projectId}/bot`);
        if (botResponse.ok) {
          const botData = await botResponse.json();
          const functionalSettings = botData.functionalSettings || {};

          // Set botUsername from bot settings
          setBotUsername(botData.botUsername || null);

          if (functionalSettings.widgetSettings) {
            setWidgetSettings({
              // Текстовые настройки
              registrationTitle:
                functionalSettings.widgetSettings.registrationTitle ||
                'Зарегистрируйся и получи {bonusAmount} бонусов!',
              registrationDescription:
                functionalSettings.widgetSettings.registrationDescription ||
                'Зарегистрируйся в нашей бонусной программе',
              registrationButtonText:
                functionalSettings.widgetSettings.registrationButtonText ||
                'Для участия в акции перейдите в бота',
              registrationFallbackText:
                functionalSettings.widgetSettings.registrationFallbackText ||
                'Свяжитесь с администратором для регистрации',

              // Настройки видимости элементов
              showIcon:
                functionalSettings.widgetSettings.showIcon !== undefined
                  ? functionalSettings.widgetSettings.showIcon
                  : true,
              showTitle:
                functionalSettings.widgetSettings.showTitle !== undefined
                  ? functionalSettings.widgetSettings.showTitle
                  : true,
              showDescription:
                functionalSettings.widgetSettings.showDescription !== undefined
                  ? functionalSettings.widgetSettings.showDescription
                  : true,
              showButton:
                functionalSettings.widgetSettings.showButton !== undefined
                  ? functionalSettings.widgetSettings.showButton
                  : true,
              showFallbackText:
                functionalSettings.widgetSettings.showFallbackText !== undefined
                  ? functionalSettings.widgetSettings.showFallbackText
                  : true,

              // Цветовые настройки
              backgroundColor:
                functionalSettings.widgetSettings.backgroundColor || '#667eea',
              backgroundGradient:
                functionalSettings.widgetSettings.backgroundGradient ||
                '#764ba2',
              textColor:
                functionalSettings.widgetSettings.textColor || '#ffffff',
              titleColor:
                functionalSettings.widgetSettings.titleColor || '#ffffff',
              descriptionColor:
                functionalSettings.widgetSettings.descriptionColor || '#ffffff',
              fallbackTextColor:
                functionalSettings.widgetSettings.fallbackTextColor ||
                '#ffffff',
              buttonTextColor:
                functionalSettings.widgetSettings.buttonTextColor || '#ffffff',
              buttonBackgroundColor:
                functionalSettings.widgetSettings.buttonBackgroundColor ||
                'rgba(255,255,255,0.2)',
              buttonBorderColor:
                functionalSettings.widgetSettings.buttonBorderColor ||
                'rgba(255,255,255,0.3)',
              buttonHoverColor:
                functionalSettings.widgetSettings.buttonHoverColor ||
                'rgba(255,255,255,0.3)',
              fallbackBackgroundColor:
                functionalSettings.widgetSettings.fallbackBackgroundColor ||
                'rgba(0,0,0,0.1)',

              // Размеры и отступы
              borderRadius:
                functionalSettings.widgetSettings.borderRadius || '12px',
              padding: functionalSettings.widgetSettings.padding || '16px',
              marginBottom:
                functionalSettings.widgetSettings.marginBottom || '12px',
              iconSize: functionalSettings.widgetSettings.iconSize || '24px',
              titleFontSize:
                functionalSettings.widgetSettings.titleFontSize || '18px',
              titleFontWeight:
                functionalSettings.widgetSettings.titleFontWeight || 'bold',
              descriptionFontSize:
                functionalSettings.widgetSettings.descriptionFontSize || '14px',
              buttonFontSize:
                functionalSettings.widgetSettings.buttonFontSize || '14px',
              buttonFontWeight:
                functionalSettings.widgetSettings.buttonFontWeight || '500',
              buttonPadding:
                functionalSettings.widgetSettings.buttonPadding || '8px 16px',
              buttonBorderRadius:
                functionalSettings.widgetSettings.buttonBorderRadius || '6px',
              fallbackFontSize:
                functionalSettings.widgetSettings.fallbackFontSize || '14px',
              fallbackPadding:
                functionalSettings.widgetSettings.fallbackPadding || '8px',
              fallbackBorderRadius:
                functionalSettings.widgetSettings.fallbackBorderRadius || '4px',

              // Эффекты и тени
              boxShadow:
                functionalSettings.widgetSettings.boxShadow ||
                '0 4px 6px rgba(0,0,0,0.1)',
              buttonBoxShadow:
                functionalSettings.widgetSettings.buttonBoxShadow || 'none',
              iconAnimation:
                functionalSettings.widgetSettings.iconAnimation || 'none',

              // Эмодзи и иконки
              iconEmoji: functionalSettings.widgetSettings.iconEmoji || '🎁',
              iconColor:
                functionalSettings.widgetSettings.iconColor || '#ffffff',

              // Дополнительные настройки
              maxWidth: functionalSettings.widgetSettings.maxWidth || '100%',
              textAlign:
                functionalSettings.widgetSettings.textAlign || 'center',
              buttonWidth:
                functionalSettings.widgetSettings.buttonWidth || 'auto',
              buttonDisplay:
                functionalSettings.widgetSettings.buttonDisplay ||
                'inline-block',
              fontSize: functionalSettings.widgetSettings.fontSize || '14px'
            });
          }
        }
      } catch (error) {
        console.warn('Не удалось загрузить настройки виджета:', error);
      }
    } catch (error) {
      toast.error('Ошибка загрузки проекта');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentLogs() {
    if (!projectId) return;
    try {
      setRecentLogsLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/integration/logs?limit=10`
      );
      if (!response.ok) throw new Error('Failed to load logs');
      const data = await response.json();
      setRecentLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (_error) {
      // Тихо игнорируем, страница интеграции не критична без логов
      setRecentLogs([]);
    } finally {
      setRecentLogsLoading(false);
    }
  }

  async function saveWidgetSettings() {
    try {
      setSaving(true);

      // Получаем текущие настройки бота
      const botResponse = await fetch(`/api/projects/${projectId}/bot`);
      let currentBotSettings: any = {};

      if (botResponse.ok) {
        currentBotSettings = await botResponse.json();
      }

      // Обновляем функциональные настройки с новыми настройками виджета
      const updatedSettings = {
        ...currentBotSettings,
        functionalSettings: {
          ...(currentBotSettings.functionalSettings || {}),
          widgetSettings: widgetSettings
        }
      };

      const response = await fetch(`/api/projects/${projectId}/bot`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        toast.success('Настройки виджета сохранены');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success('Скопировано в буфер обмена');

    setTimeout(() => setCopied(null), 3000);
  }

  if (loading) {
    return (
      <PageContainer>
        <div className='animate-pulse'>
          <div className='mb-4 h-8 w-1/4 rounded bg-gray-200'></div>
          <div className='h-64 rounded bg-gray-200'></div>
        </div>
      </PageContainer>
    );
  }

  if (!project) {
    return (
      <PageContainer>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>Проект не найден</AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  const webhookUrl = `${window.location.origin}/api/webhook/${project.webhookSecret}`;

  const widgetCode = `<script src="${widgetUrl}?v=25"></script>`;

  const testWebhookData = JSON.stringify(
    {
      action: 'purchase',
      payload: {
        userEmail: 'test@example.com',
        purchaseAmount: 1000,
        orderId: 'TEST-' + Date.now(),
        description: 'Тестовый заказ'
      }
    },
    null,
    2
  );

  return (
    <PageContainer scrollable>
      <div className='space-y-6'>
        {/* Заголовок */}
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Интеграция с Tilda
          </h1>
          <p className='text-muted-foreground mt-2'>
            Настройте интеграцию бонусной системы с вашим сайтом на Tilda
          </p>
        </div>

        {/* Статус интеграции */}
        <Alert>
          <CheckCircle2 className='h-4 w-4' />
          <AlertTitle>Готово к интеграции</AlertTitle>
          <AlertDescription>
            Следуйте инструкциям ниже для подключения бонусной системы к вашему
            сайту
          </AlertDescription>
        </Alert>

        {/* Табы с инструкциями */}
        <Tabs defaultValue='widget' className='space-y-4'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='widget'>
              <Code className='mr-2 h-4 w-4' />
              Виджет
            </TabsTrigger>
            <TabsTrigger value='webhook'>
              <Webhook className='mr-2 h-4 w-4' />
              Webhook
            </TabsTrigger>
            <TabsTrigger value='logs'>
              <FileText className='mr-2 h-4 w-4' />
              Логи
            </TabsTrigger>
          </TabsList>

          {/* Виджет */}
          <TabsContent value='widget' className='mt-0 min-h-[640px] space-y-4'>
            <Card className='overflow-hidden'>
              <CardHeader>
                <CardTitle>Шаг 1: Установка виджета</CardTitle>
                <CardDescription>
                  Вставьте этот код в настройки вашего сайта на Tilda
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label>Где вставить код:</Label>
                  <p className='text-muted-foreground text-sm'>
                    Настройки сайта → Дополнительно → Вставить код → В футер
                    (перед &lt;/body&gt;)
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label>Код для вставки:</Label>
                  <div className='relative'>
                    <pre className='bg-muted overflow-x-auto rounded-lg p-4 text-sm'>
                      <code>{widgetCode}</code>
                    </pre>
                    <Button
                      size='sm'
                      variant='outline'
                      className='absolute top-2 right-2'
                      onClick={() => copyToClipboard(widgetCode, 'widget')}
                    >
                      {copied === 'widget' ? (
                        <CheckCircle2 className='h-4 w-4 text-green-600' />
                      ) : (
                        <Copy className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>Что делает виджет:</AlertTitle>
                  <AlertDescription>
                    <ul className='mt-2 list-inside list-disc space-y-1'>
                      <li>Показывает баланс бонусов в корзине</li>
                      <li>Позволяет применить бонусы к заказу</li>
                      <li>
                        Автоматически определяет пользователя по email/телефону
                      </li>
                      <li>Работает со всеми типами корзин Tilda</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Настройки плашки регистрации */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Settings className='h-5 w-5' />
                  Настройки плашки регистрации
                </CardTitle>
                <CardDescription>
                  Настройте внешний вид и текст плашки для незарегистрированных
                  пользователей
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                {/* Текстовые настройки */}
                <div className='space-y-4'>
                  <h4 className='text-sm font-medium'>Содержание</h4>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='registrationTitle'>
                        Заголовок
                        <span className='text-muted-foreground ml-2 text-xs'>
                          (используйте {'{bonusAmount}'})
                        </span>
                      </Label>
                      <Input
                        id='registrationTitle'
                        value={widgetSettings.registrationTitle}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            registrationTitle: e.target.value
                          })
                        }
                        placeholder='Зарегистрируйся и получи {bonusAmount} бонусов!'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='registrationDescription'>Описание</Label>
                      <Input
                        id='registrationDescription'
                        value={widgetSettings.registrationDescription}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            registrationDescription: e.target.value
                          })
                        }
                        placeholder='Зарегистрируйся в нашей бонусной программе'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='registrationButtonText'>
                        Текст кнопки (с ботом)
                      </Label>
                      <Input
                        id='registrationButtonText'
                        value={widgetSettings.registrationButtonText}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            registrationButtonText: e.target.value
                          })
                        }
                        placeholder='Для участия в акции перейдите в бота'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='registrationFallbackText'>
                        Текст без бота
                      </Label>
                      <Input
                        id='registrationFallbackText'
                        value={widgetSettings.registrationFallbackText}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            registrationFallbackText: e.target.value
                          })
                        }
                        placeholder='Свяжитесь с администратором для регистрации'
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Настройки видимости элементов */}
                <div className='space-y-4'>
                  <h4 className='text-sm font-medium'>Видимость элементов</h4>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='checkbox'
                        id='showIcon'
                        checked={widgetSettings.showIcon}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            showIcon: e.target.checked
                          })
                        }
                        className='rounded'
                      />
                      <Label htmlFor='showIcon'>Показывать иконку</Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='checkbox'
                        id='showTitle'
                        checked={widgetSettings.showTitle}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            showTitle: e.target.checked
                          })
                        }
                        className='rounded'
                      />
                      <Label htmlFor='showTitle'>Показывать заголовок</Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='checkbox'
                        id='showDescription'
                        checked={widgetSettings.showDescription}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            showDescription: e.target.checked
                          })
                        }
                        className='rounded'
                      />
                      <Label htmlFor='showDescription'>
                        Показывать описание
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='checkbox'
                        id='showButton'
                        checked={widgetSettings.showButton}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            showButton: e.target.checked
                          })
                        }
                        className='rounded'
                      />
                      <Label htmlFor='showButton'>Показывать кнопку</Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='checkbox'
                        id='showFallbackText'
                        checked={widgetSettings.showFallbackText}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            showFallbackText: e.target.checked
                          })
                        }
                        className='rounded'
                      />
                      <Label htmlFor='showFallbackText'>
                        Показывать текст без бота
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Стилевые настройки */}
                <div className='space-y-4'>
                  <h4 className='text-sm font-medium'>Цвета</h4>
                  <div className='grid gap-4 md:grid-cols-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='backgroundColor'>Основной цвет</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='backgroundColor'
                          type='color'
                          value={widgetSettings.backgroundColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              backgroundColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.backgroundColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              backgroundColor: e.target.value
                            })
                          }
                          placeholder='#667eea'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='backgroundGradient'>Градиент</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='backgroundGradient'
                          type='color'
                          value={widgetSettings.backgroundGradient}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              backgroundGradient: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.backgroundGradient}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              backgroundGradient: e.target.value
                            })
                          }
                          placeholder='#764ba2'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='textColor'>Цвет текста</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='textColor'
                          type='color'
                          value={widgetSettings.textColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              textColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.textColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              textColor: e.target.value
                            })
                          }
                          placeholder='#ffffff'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='titleColor'>Цвет заголовка</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='titleColor'
                          type='color'
                          value={widgetSettings.titleColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              titleColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.titleColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              titleColor: e.target.value
                            })
                          }
                          placeholder='#ffffff'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='descriptionColor'>Цвет описания</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='descriptionColor'
                          type='color'
                          value={widgetSettings.descriptionColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              descriptionColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.descriptionColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              descriptionColor: e.target.value
                            })
                          }
                          placeholder='#ffffff'
                        />
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonTextColor'>
                        Цвет текста кнопки
                      </Label>
                      <div className='flex gap-2'>
                        <Input
                          id='buttonTextColor'
                          type='color'
                          value={widgetSettings.buttonTextColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonTextColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.buttonTextColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonTextColor: e.target.value
                            })
                          }
                          placeholder='#ffffff'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonBackgroundColor'>Фон кнопки</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='buttonBackgroundColor'
                          type='color'
                          value={widgetSettings.buttonBackgroundColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonBackgroundColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.buttonBackgroundColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonBackgroundColor: e.target.value
                            })
                          }
                          placeholder='rgba(255,255,255,0.2)'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonBorderColor'>Рамка кнопки</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='buttonBorderColor'
                          type='color'
                          value={widgetSettings.buttonBorderColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonBorderColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.buttonBorderColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonBorderColor: e.target.value
                            })
                          }
                          placeholder='rgba(255,255,255,0.3)'
                        />
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='fallbackTextColor'>
                        Цвет текста без бота
                      </Label>
                      <div className='flex gap-2'>
                        <Input
                          id='fallbackTextColor'
                          type='color'
                          value={widgetSettings.fallbackTextColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              fallbackTextColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.fallbackTextColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              fallbackTextColor: e.target.value
                            })
                          }
                          placeholder='#ffffff'
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='fallbackBackgroundColor'>
                        Фон текста без бота
                      </Label>
                      <div className='flex gap-2'>
                        <Input
                          id='fallbackBackgroundColor'
                          type='color'
                          value={widgetSettings.fallbackBackgroundColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              fallbackBackgroundColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.fallbackBackgroundColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              fallbackBackgroundColor: e.target.value
                            })
                          }
                          placeholder='rgba(0,0,0,0.1)'
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <h4 className='text-sm font-medium'>Размеры и отступы</h4>
                  <div className='grid gap-4 md:grid-cols-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='padding'>Внутренний отступ</Label>
                      <Input
                        id='padding'
                        value={widgetSettings.padding}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            padding: e.target.value
                          })
                        }
                        placeholder='16px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='iconSize'>Размер иконки</Label>
                      <Input
                        id='iconSize'
                        value={widgetSettings.iconSize}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            iconSize: e.target.value
                          })
                        }
                        placeholder='24px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='titleFontSize'>Размер заголовка</Label>
                      <Input
                        id='titleFontSize'
                        value={widgetSettings.titleFontSize}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            titleFontSize: e.target.value
                          })
                        }
                        placeholder='18px'
                      />
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='descriptionFontSize'>
                        Размер описания
                      </Label>
                      <Input
                        id='descriptionFontSize'
                        value={widgetSettings.descriptionFontSize}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            descriptionFontSize: e.target.value
                          })
                        }
                        placeholder='14px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonFontSize'>
                        Размер текста кнопки
                      </Label>
                      <Input
                        id='buttonFontSize'
                        value={widgetSettings.buttonFontSize}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            buttonFontSize: e.target.value
                          })
                        }
                        placeholder='14px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='fallbackFontSize'>
                        Размер текста без бота
                      </Label>
                      <Input
                        id='fallbackFontSize'
                        value={widgetSettings.fallbackFontSize}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            fallbackFontSize: e.target.value
                          })
                        }
                        placeholder='14px'
                      />
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonPadding'>Отступы кнопки</Label>
                      <Input
                        id='buttonPadding'
                        value={widgetSettings.buttonPadding}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            buttonPadding: e.target.value
                          })
                        }
                        placeholder='8px 16px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonBorderRadius'>
                        Скругление кнопки
                      </Label>
                      <Input
                        id='buttonBorderRadius'
                        value={widgetSettings.buttonBorderRadius}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            buttonBorderRadius: e.target.value
                          })
                        }
                        placeholder='6px'
                      />
                    </div>
                  </div>

                  <Separator />

                  <h4 className='text-sm font-medium'>Эффекты и анимация</h4>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='boxShadow'>Тень плашки</Label>
                      <Input
                        id='boxShadow'
                        value={widgetSettings.boxShadow}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            boxShadow: e.target.value
                          })
                        }
                        placeholder='0 4px 6px rgba(0,0,0,0.1)'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='iconAnimation'>Анимация иконки</Label>
                      <select
                        id='iconAnimation'
                        value={widgetSettings.iconAnimation}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            iconAnimation: e.target.value
                          })
                        }
                        className='w-full rounded-md border p-2'
                      >
                        <option value='none'>Без анимации</option>
                        <option value='pulse'>Пульсация</option>
                        <option value='bounce'>Прыжок</option>
                        <option value='shake'>Дрожь</option>
                      </select>
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='iconEmoji'>Эмодзи иконки</Label>
                      <Input
                        id='iconEmoji'
                        value={widgetSettings.iconEmoji}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            iconEmoji: e.target.value
                          })
                        }
                        placeholder='🎁'
                        maxLength={4}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='iconColor'>Цвет иконки</Label>
                      <div className='flex gap-2'>
                        <Input
                          id='iconColor'
                          type='color'
                          value={widgetSettings.iconColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              iconColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.iconColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              iconColor: e.target.value
                            })
                          }
                          placeholder='#ffffff'
                        />
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='titleFontWeight'>Толщина заголовка</Label>
                      <select
                        id='titleFontWeight'
                        value={widgetSettings.titleFontWeight}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            titleFontWeight: e.target.value
                          })
                        }
                        className='w-full rounded-md border p-2'
                      >
                        <option value='normal'>Обычный</option>
                        <option value='bold'>Жирный</option>
                        <option value='600'>Полужирный</option>
                        <option value='lighter'>Тонкий</option>
                      </select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonFontWeight'>
                        Толщина текста кнопки
                      </Label>
                      <select
                        id='buttonFontWeight'
                        value={widgetSettings.buttonFontWeight}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            buttonFontWeight: e.target.value
                          })
                        }
                        className='w-full rounded-md border p-2'
                      >
                        <option value='normal'>Обычный</option>
                        <option value='bold'>Жирный</option>
                        <option value='500'>Средний</option>
                        <option value='600'>Полужирный</option>
                      </select>
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='borderRadius'>
                        Скругление углов плашки
                      </Label>
                      <Input
                        id='borderRadius'
                        value={widgetSettings.borderRadius}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            borderRadius: e.target.value
                          })
                        }
                        placeholder='12px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='maxWidth'>Максимальная ширина</Label>
                      <Input
                        id='maxWidth'
                        value={widgetSettings.maxWidth}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            maxWidth: e.target.value
                          })
                        }
                        placeholder='100%'
                      />
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='textAlign'>Выравнивание текста</Label>
                      <select
                        id='textAlign'
                        value={widgetSettings.textAlign}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            textAlign: e.target.value
                          })
                        }
                        className='w-full rounded-md border p-2'
                      >
                        <option value='left'>По левому краю</option>
                        <option value='center'>По центру</option>
                        <option value='right'>По правому краю</option>
                      </select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonWidth'>Ширина кнопки</Label>
                      <Input
                        id='buttonWidth'
                        value={widgetSettings.buttonWidth}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            buttonWidth: e.target.value
                          })
                        }
                        placeholder='auto'
                      />
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='fallbackPadding'>
                        Отступы текста без бота
                      </Label>
                      <Input
                        id='fallbackPadding'
                        value={widgetSettings.fallbackPadding}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            fallbackPadding: e.target.value
                          })
                        }
                        placeholder='8px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='fallbackBorderRadius'>
                        Скругление текста без бота
                      </Label>
                      <Input
                        id='fallbackBorderRadius'
                        value={widgetSettings.fallbackBorderRadius}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            fallbackBorderRadius: e.target.value
                          })
                        }
                        placeholder='4px'
                      />
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='marginBottom'>Отступ снизу</Label>
                      <Input
                        id='marginBottom'
                        value={widgetSettings.marginBottom}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            marginBottom: e.target.value
                          })
                        }
                        placeholder='12px'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonBoxShadow'>Тень кнопки</Label>
                      <Input
                        id='buttonBoxShadow'
                        value={widgetSettings.buttonBoxShadow}
                        onChange={(e) =>
                          setWidgetSettings({
                            ...widgetSettings,
                            buttonBoxShadow: e.target.value
                          })
                        }
                        placeholder='none'
                      />
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='buttonHoverColor'>
                        Цвет кнопки при наведении
                      </Label>
                      <div className='flex gap-2'>
                        <Input
                          id='buttonHoverColor'
                          type='color'
                          value={widgetSettings.buttonHoverColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonHoverColor: e.target.value
                            })
                          }
                          className='h-10 w-16 p-1'
                        />
                        <Input
                          value={widgetSettings.buttonHoverColor}
                          onChange={(e) =>
                            setWidgetSettings({
                              ...widgetSettings,
                              buttonHoverColor: e.target.value
                            })
                          }
                          placeholder='rgba(255,255,255,0.3)'
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Предварительный просмотр и сохранение */}
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <h4 className='text-sm font-medium'>
                      Предварительный просмотр
                    </h4>
                    <Button onClick={saveWidgetSettings} disabled={saving}>
                      <Save className='mr-2 h-4 w-4' />
                      {saving ? 'Сохранение...' : 'Сохранить настройки'}
                    </Button>
                  </div>

                  <div className='bg-muted/20 rounded-lg border p-4'>
                    <div
                      className='rounded-lg p-4'
                      style={{
                        background: `linear-gradient(135deg, ${widgetSettings.backgroundColor} 0%, ${widgetSettings.backgroundGradient} 100%)`,
                        color: widgetSettings.textColor,
                        borderRadius: widgetSettings.borderRadius,
                        boxShadow: widgetSettings.boxShadow,
                        padding: widgetSettings.padding,
                        marginBottom: widgetSettings.marginBottom,
                        maxWidth: widgetSettings.maxWidth,
                        textAlign: widgetSettings.textAlign as
                          | 'left'
                          | 'center'
                          | 'right',
                        fontSize: widgetSettings.fontSize || '14px'
                      }}
                    >
                      {/* Иконка */}
                      {widgetSettings.showIcon && (
                        <div
                          className={`mb-2 ${widgetSettings.iconAnimation !== 'none' ? widgetSettings.iconAnimation : ''}`}
                          style={{
                            fontSize: widgetSettings.iconSize,
                            color: widgetSettings.iconColor
                          }}
                        >
                          {widgetSettings.iconEmoji}
                        </div>
                      )}

                      {/* Заголовок */}
                      {widgetSettings.showTitle && (
                        <div
                          className='mb-2'
                          style={{
                            fontSize: widgetSettings.titleFontSize,
                            fontWeight: widgetSettings.titleFontWeight,
                            color: widgetSettings.titleColor
                          }}
                        >
                          {widgetSettings.registrationTitle.replace(
                            '{bonusAmount}',
                            '1000'
                          )}
                        </div>
                      )}

                      {/* Описание */}
                      {widgetSettings.showDescription && (
                        <div
                          className='mb-3'
                          style={{
                            fontSize: widgetSettings.descriptionFontSize,
                            color: widgetSettings.descriptionColor,
                            opacity: 0.9
                          }}
                        >
                          {widgetSettings.registrationDescription}
                        </div>
                      )}

                      {/* Кнопка или текст без бота */}
                      {widgetSettings.showButton && botUsername ? (
                        <div
                          className='inline-block cursor-pointer rounded transition-all hover:shadow-md'
                          style={{
                            background: widgetSettings.buttonBackgroundColor,
                            border: `1px solid ${widgetSettings.buttonBorderColor}`,
                            color: widgetSettings.buttonTextColor,
                            fontSize: widgetSettings.buttonFontSize,
                            fontWeight: widgetSettings.buttonFontWeight,
                            padding: widgetSettings.buttonPadding,
                            borderRadius: widgetSettings.buttonBorderRadius,
                            width: widgetSettings.buttonWidth,
                            display: widgetSettings.buttonDisplay,
                            boxShadow: widgetSettings.buttonBoxShadow
                          }}
                          onMouseEnter={(e) => {
                            if (widgetSettings.buttonHoverColor) {
                              (e.target as HTMLElement).style.background =
                                widgetSettings.buttonHoverColor;
                            }
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.background =
                              widgetSettings.buttonBackgroundColor;
                          }}
                        >
                          {widgetSettings.registrationButtonText}
                        </div>
                      ) : widgetSettings.showFallbackText ? (
                        <div
                          style={{
                            fontSize: widgetSettings.fallbackFontSize,
                            color: widgetSettings.fallbackTextColor,
                            background: widgetSettings.fallbackBackgroundColor,
                            padding: widgetSettings.fallbackPadding,
                            borderRadius: widgetSettings.fallbackBorderRadius,
                            opacity: 0.8
                          }}
                        >
                          {widgetSettings.registrationFallbackText}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhook */}
          <TabsContent value='webhook' className='mt-0 min-h-[640px] space-y-4'>
            <Card className='overflow-hidden'>
              <CardHeader>
                <CardTitle>Шаг 2: Настройка Webhook</CardTitle>
                <CardDescription>
                  Настройте автоматическую отправку данных о заказах
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label>Webhook URL:</Label>
                  <div className='flex space-x-2'>
                    <Input
                      value={webhookUrl}
                      readOnly
                      className='font-mono text-sm'
                    />
                    <Button
                      size='icon'
                      variant='outline'
                      onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                    >
                      {copied === 'webhook' ? (
                        <CheckCircle2 className='h-4 w-4 text-green-600' />
                      ) : (
                        <Copy className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label>Где настроить в Tilda:</Label>
                  <ol className='text-muted-foreground list-inside list-decimal space-y-1 text-sm'>
                    <li>Перейдите в настройки сайта</li>
                    <li>Найдите раздел &quot;Уведомления и интеграции&quot;</li>
                    <li>Добавьте новый webhook</li>
                    <li>Вставьте URL и выберите тип &quot;Заказы&quot;</li>
                    <li>Сохраните настройки</li>
                  </ol>
                </div>

                <Separator />

                <div className='space-y-2'>
                  <Label>Тестовые данные для проверки:</Label>
                  <div className='relative'>
                    <pre className='bg-muted overflow-x-auto rounded-lg p-4 text-sm'>
                      <code>{testWebhookData}</code>
                    </pre>
                    <Button
                      size='sm'
                      variant='outline'
                      className='absolute top-2 right-2'
                      onClick={() => copyToClipboard(testWebhookData, 'test')}
                    >
                      {copied === 'test' ? (
                        <CheckCircle2 className='h-4 w-4 text-green-600' />
                      ) : (
                        <Copy className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    Используйте эти данные для тестирования webhook через
                    Postman или curl
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Логи: полноценный интерфейс (embedded для фиксированной ширины) */}
          <TabsContent value='logs' className='mt-0 min-h-[640px] space-y-4'>
            <div className='w-full'>
              <ProjectLogsView
                embedded
                params={Promise.resolve({ id: projectId })}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Дополнительная информация */}
        <Card>
          <CardHeader>
            <CardTitle>Нужна помощь?</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <Button
                variant='outline'
                className='hover:bg-muted/50 flex h-auto flex-col items-start p-6 text-left transition-colors'
                onClick={() => {
                  // Здесь можно добавить логику открытия документации
                  window.open('/docs/webhook-integration.md', '_blank');
                }}
              >
                <div className='mb-2 flex items-center gap-3'>
                  <div className='text-2xl'>📚</div>
                  <h4 className='font-medium'>Документация</h4>
                </div>
                <p className='text-muted-foreground mb-3 text-sm'>
                  Подробное руководство по интеграции с примерами кода
                </p>
                <span className='text-primary text-sm font-medium'>
                  Читать документацию →
                </span>
              </Button>

              <Button
                variant='outline'
                className='hover:bg-muted/50 flex h-auto flex-col items-start p-6 text-left transition-colors'
                onClick={() => {
                  // Здесь можно добавить логику открытия техподдержки
                  window.open(
                    'mailto:support@example.com?subject=Вопрос по интеграции',
                    '_blank'
                  );
                }}
              >
                <div className='mb-2 flex items-center gap-3'>
                  <div className='text-2xl'>💬</div>
                  <h4 className='font-medium'>Техподдержка</h4>
                </div>
                <p className='text-muted-foreground mb-3 text-sm'>
                  Свяжитесь с нами, если возникли вопросы
                </p>
                <span className='text-primary text-sm font-medium'>
                  Написать в поддержку →
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
