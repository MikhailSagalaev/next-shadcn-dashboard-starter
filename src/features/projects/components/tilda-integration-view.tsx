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
    registrationTitle: 'Зарегистрируйся и получи {bonusAmount} бонусов!',
    registrationDescription: 'Зарегистрируйся в нашей бонусной программе',
    registrationButtonText: 'Для участия в акции перейдите в бота',
    registrationFallbackText: 'Свяжитесь с администратором для регистрации'
  });
  const [saving, setSaving] = useState(false);
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

          if (functionalSettings.widgetSettings) {
            setWidgetSettings({
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
                'Свяжитесь с администратором для регистрации'
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
      let currentBotSettings = {};

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

  const widgetCode = `<script src="${widgetUrl}?v=5"></script>`;

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
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='widget'>
              <Code className='mr-2 h-4 w-4' />
              Виджет
            </TabsTrigger>
            <TabsTrigger value='settings'>
              <Settings className='mr-2 h-4 w-4' />
              Настройки
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
          </TabsContent>

          {/* Настройки виджета */}
          <TabsContent
            value='settings'
            className='mt-0 min-h-[640px] space-y-4'
          >
            <Card>
              <CardHeader>
                <CardTitle>Настройки плашки регистрации</CardTitle>
                <CardDescription>
                  Настройте текст плашки, которая отображается
                  незарегистрированным пользователям
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='registrationTitle'>
                      Заголовок плашки
                      <span className='text-muted-foreground ml-2 text-sm'>
                        (используйте {'{bonusAmount}'} для подстановки суммы
                        бонуса)
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
                      Текст кнопки (когда есть бот)
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

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <h4 className='text-sm font-medium'>
                      Предварительный просмотр
                    </h4>
                    <p className='text-muted-foreground text-sm'>
                      Так будет выглядеть плашка на сайте
                    </p>
                  </div>
                  <Button onClick={saveWidgetSettings} disabled={saving}>
                    <Save className='mr-2 h-4 w-4' />
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>

                {/* Предварительный просмотр */}
                <div className='bg-muted/20 rounded-lg border p-4'>
                  <div
                    className='rounded-lg p-4 text-center text-white'
                    style={{
                      background:
                        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div className='mb-2 text-2xl'>🎁</div>
                    <div className='mb-2 text-lg font-bold'>
                      {widgetSettings.registrationTitle.replace(
                        '{bonusAmount}',
                        '1000'
                      )}
                    </div>
                    <div className='mb-3 text-sm opacity-90'>
                      {widgetSettings.registrationDescription}
                    </div>
                    <div>
                      {project?.botUsername ? (
                        <div
                          className='inline-block cursor-pointer rounded-md px-4 py-2 transition-all'
                          style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                        >
                          {widgetSettings.registrationButtonText}
                        </div>
                      ) : (
                        <div className='text-sm opacity-80'>
                          {widgetSettings.registrationFallbackText}
                        </div>
                      )}
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
