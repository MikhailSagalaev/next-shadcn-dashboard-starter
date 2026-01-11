/**
 * @file: tilda-integration-view.tsx
 * @description: Компонент для настройки интеграции с Tilda
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useEffect } from 'react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

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
  const [activeTab, setActiveTab] = useState<string>('widget');
  const [widgetSettings, setWidgetSettings] = useState({
    // Текстовые настройки плашки регистрации
    registrationTitle: 'Зарегистрируйся и получи {bonusAmount} бонусов!',
    registrationDescription: 'Зарегистрируйся в нашей бонусной программе',
    registrationButtonText: 'Для участия в акции перейдите в бота',
    registrationButtonUrl: '', // Кастомная ссылка для регистрации (если пустая - используется ссылка на бота)
    verificationButtonUrl: '', // Кастомная ссылка для верификации (если пустая - используется ссылка на бота)
    registrationFallbackText: 'Свяжитесь с администратором для регистрации',

    // Настройки видимости элементов плашки
    showIcon: true,
    showTitle: true,
    showDescription: true,
    showButton: true,
    showFallbackText: true,

    // Цветовые настройки плашки регистрации
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

    // Размеры и отступы плашки
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    iconSize: '24px',
    titleFontSize: '18px',
    titleFontWeight: 'bold', // Жирный (Bold)
    descriptionFontSize: '14px',
    buttonFontSize: '14px',
    buttonFontWeight: '500', // Средний (Medium)
    buttonPadding: '10px 20px',
    buttonBorderRadius: '6px',
    fallbackFontSize: '14px',
    fallbackPadding: '8px',
    fallbackBorderRadius: '4px',

    // Эффекты и тени плашки
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    buttonBoxShadow: 'none',
    iconAnimation: 'jump', // none, pulse, bounce, shake, jump

    // Эмодзи и иконки плашки
    iconEmoji: '🎁',
    iconColor: '#ffffff',

    // Шрифты плашки
    fontFamily: 'system-ui, -apple-system, sans-serif', // По умолчанию системный

    // Дополнительные настройки плашки
    maxWidth: '100%',
    textAlign: 'center',
    buttonWidth: 'auto',
    buttonDisplay: 'inline-block',
    fontSize: '14px',

    // ========== НАСТРОЙКИ БОНУСНЫХ ПЛАШЕК НА ТОВАРАХ ==========
    // Включение/выключение плашек
    productBadgeEnabled: true,
    productBadgeShowOnCards: true, // Показывать на карточках товаров
    productBadgeShowOnProductPage: true, // Показывать на странице товара

    // Текст плашки
    productBadgeText: 'Начислим до {bonusAmount} бонусов',
    productBadgeLinkUrl: '', // Ссылка при клике (пустая = без ссылки)

    // Расчёт бонусов
    productBadgeBonusPercent: 10, // Процент от цены товара

    // Стили плашки
    productBadgeBackgroundColor: '#f1f1f1',
    productBadgeTextColor: '#000000',
    productBadgeFontFamily: 'inherit',
    productBadgeFontSize: '14px',
    productBadgeFontWeight: '400',
    productBadgePadding: '5px 10px',
    productBadgeBorderRadius: '5px',
    productBadgeMarginTop: '5px',

    // Позиционирование
    productBadgePosition: 'after-price', // after-price, before-price, custom
    productBadgeCustomSelector: '', // CSS селектор для кастомной позиции

    // ========== НАСТРОЙКИ САМОГО ВИДЖЕТА БОНУСОВ ==========
    // Цвета виджета (по умолчанию из формы)
    widgetBackgroundColor: '#ffffff',
    widgetBorderColor: '#e5e7eb',
    widgetTextColor: '#424242',
    widgetLabelColor: '#6b7280',
    widgetInputBackground: '#ffffff',
    widgetInputBorder: '#d1d5db',
    widgetInputText: '#424242',
    widgetButtonBackground: '#424242',
    widgetButtonText: '#ffffff',
    widgetButtonHover: '#696969',
    widgetBalanceColor: '#000000',
    widgetErrorColor: '#dc2626',
    widgetSuccessColor: '#059669',

    // Шрифты виджета
    widgetFontFamily: 'system-ui, -apple-system, sans-serif',
    widgetFontSize: '14px',
    widgetLabelFontSize: '13px',
    widgetButtonFontSize: '14px',
    widgetBalanceFontSize: '16px',

    // Размеры и отступы виджета
    widgetBorderRadius: '8px',
    widgetPadding: '16px',
    widgetInputBorderRadius: '6px',
    widgetInputPadding: '8px 12px',
    widgetButtonBorderRadius: '6px',
    widgetButtonPadding: '10px 20px',

    // Тени виджета
    widgetBoxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    widgetInputBoxShadow: 'none',
    widgetButtonBoxShadow: 'none'
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

    // Подключаем Google Fonts для предварительного просмотра
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'preconnect';
      fontLink.href = 'https://fonts.googleapis.com';
      document.head.appendChild(fontLink);

      const fontLink2 = document.createElement('link');
      fontLink2.rel = 'preconnect';
      fontLink2.href = 'https://fonts.gstatic.com';
      fontLink2.crossOrigin = 'anonymous';
      document.head.appendChild(fontLink2);

      const fontLink3 = document.createElement('link');
      fontLink3.rel = 'stylesheet';
      fontLink3.href =
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&family=Rubik:wght@400;500;600;700&display=swap';
      document.head.appendChild(fontLink3);
    }

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

      // Загружаем настройки виджета из нового endpoint /widget
      try {
        const widgetResponse = await fetch(`/api/projects/${projectId}/widget`);
        if (widgetResponse.ok) {
          const widgetData = await widgetResponse.json();

          // Set botUsername from widget settings
          setBotUsername(widgetData.botUsername || null);

          if (widgetData.success) {
            setWidgetSettings({
              // Текстовые настройки
              registrationTitle:
                widgetData.registrationTitle ||
                'Зарегистрируйся и получи {bonusAmount} бонусов!',
              registrationDescription:
                widgetData.registrationDescription ||
                'Зарегистрируйся в нашей бонусной программе',
              registrationButtonText:
                widgetData.registrationButtonText ||
                'Для участия в акции перейдите в бота',
              registrationButtonUrl: widgetData.registrationButtonUrl || '',
              verificationButtonUrl: widgetData.verificationButtonUrl || '',
              registrationFallbackText:
                widgetData.registrationFallbackText ||
                'Свяжитесь с администратором для регистрации',

              // Настройки видимости элементов
              showIcon:
                widgetData.showIcon !== undefined ? widgetData.showIcon : true,
              showTitle:
                widgetData.showTitle !== undefined
                  ? widgetData.showTitle
                  : true,
              showDescription:
                widgetData.showDescription !== undefined
                  ? widgetData.showDescription
                  : true,
              showButton:
                widgetData.showButton !== undefined
                  ? widgetData.showButton
                  : true,
              showFallbackText:
                widgetData.showFallbackText !== undefined
                  ? widgetData.showFallbackText
                  : true,

              // Цветовые настройки
              backgroundColor: widgetData.backgroundColor || '#667eea',
              backgroundGradient: widgetData.backgroundGradient || '#764ba2',
              textColor: widgetData.textColor || '#ffffff',
              titleColor: widgetData.titleColor || '#ffffff',
              descriptionColor: widgetData.descriptionColor || '#ffffff',
              fallbackTextColor: widgetData.fallbackTextColor || '#ffffff',
              buttonTextColor: widgetData.buttonTextColor || '#ffffff',
              buttonBackgroundColor:
                widgetData.buttonBackgroundColor || 'rgba(255,255,255,0.2)',
              buttonBorderColor:
                widgetData.buttonBorderColor || 'rgba(255,255,255,0.3)',
              buttonHoverColor:
                widgetData.buttonHoverColor || 'rgba(255,255,255,0.3)',
              fallbackBackgroundColor:
                widgetData.fallbackBackgroundColor || 'rgba(0,0,0,0.1)',

              // Размеры и отступы
              borderRadius: widgetData.borderRadius || '12px',
              padding: widgetData.padding || '16px',
              marginBottom: widgetData.marginBottom || '12px',
              iconSize: widgetData.iconSize || '24px',
              titleFontSize: widgetData.titleFontSize || '18px',
              titleFontWeight: widgetData.titleFontWeight || 'bold',
              descriptionFontSize: widgetData.descriptionFontSize || '14px',
              buttonFontSize: widgetData.buttonFontSize || '14px',
              buttonFontWeight: widgetData.buttonFontWeight || '500',
              buttonPadding: widgetData.buttonPadding || '10px 20px',
              buttonBorderRadius: widgetData.buttonBorderRadius || '6px',
              fallbackFontSize: widgetData.fallbackFontSize || '14px',
              fallbackPadding: widgetData.fallbackPadding || '8px',
              fallbackBorderRadius: widgetData.fallbackBorderRadius || '4px',

              // Эффекты и тени
              boxShadow: widgetData.boxShadow || '0 4px 6px rgba(0,0,0,0.1)',
              buttonBoxShadow: widgetData.buttonBoxShadow || 'none',
              iconAnimation: widgetData.iconAnimation || 'jump',

              // Эмодзи и иконки
              iconEmoji: widgetData.iconEmoji || '🎁',
              iconColor: widgetData.iconColor || '#ffffff',

              // Шрифты
              fontFamily:
                widgetData.fontFamily || 'system-ui, -apple-system, sans-serif',

              // Дополнительные настройки плашки
              maxWidth: widgetData.maxWidth || '100%',
              textAlign: widgetData.textAlign || 'center',
              buttonWidth: widgetData.buttonWidth || 'auto',
              buttonDisplay: widgetData.buttonDisplay || 'inline-block',
              fontSize: widgetData.fontSize || '14px',

              // Настройки бонусных плашек на товарах
              productBadgeEnabled: widgetData.productBadgeEnabled !== false,
              productBadgeShowOnCards:
                widgetData.productBadgeShowOnCards !== false,
              productBadgeShowOnProductPage:
                widgetData.productBadgeShowOnProductPage !== false,
              productBadgeText:
                widgetData.productBadgeText ||
                'Начислим до {bonusAmount} бонусов',
              productBadgeLinkUrl: widgetData.productBadgeLinkUrl || '',
              // Процент берётся из WidgetSettings
              productBadgeBonusPercent:
                Number(widgetData.productBadgeBonusPercent) || 10,
              productBadgeBackgroundColor:
                widgetData.productBadgeBackgroundColor || '#f1f1f1',
              productBadgeTextColor:
                widgetData.productBadgeTextColor || '#000000',
              productBadgeFontFamily:
                widgetData.productBadgeFontFamily || 'inherit',
              productBadgeFontSize: widgetData.productBadgeFontSize || '14px',
              productBadgeFontWeight:
                widgetData.productBadgeFontWeight || '400',
              productBadgePadding: widgetData.productBadgePadding || '5px 10px',
              productBadgeBorderRadius:
                widgetData.productBadgeBorderRadius || '5px',
              productBadgeMarginTop: widgetData.productBadgeMarginTop || '5px',
              productBadgePosition:
                widgetData.productBadgePosition || 'after-price',
              productBadgeCustomSelector:
                widgetData.productBadgeCustomSelector || '',

              // Настройки виджета бонусов
              widgetBackgroundColor:
                widgetData.widgetBackgroundColor || '#ffffff',
              widgetBorderColor: widgetData.widgetBorderColor || '#e5e7eb',
              widgetTextColor: widgetData.widgetTextColor || '#424242',
              widgetLabelColor: widgetData.widgetLabelColor || '#6b7280',
              widgetInputBackground:
                widgetData.widgetInputBackground || '#ffffff',
              widgetInputBorder: widgetData.widgetInputBorder || '#d1d5db',
              widgetInputText: widgetData.widgetInputText || '#424242',
              widgetButtonBackground:
                widgetData.widgetButtonBackground || '#424242',
              widgetButtonText: widgetData.widgetButtonText || '#ffffff',
              widgetButtonHover: widgetData.widgetButtonHover || '#696969',
              widgetBalanceColor: widgetData.widgetBalanceColor || '#000000',
              widgetErrorColor: widgetData.widgetErrorColor || '#dc2626',
              widgetSuccessColor: widgetData.widgetSuccessColor || '#059669',
              widgetFontFamily:
                widgetData.widgetFontFamily ||
                'system-ui, -apple-system, sans-serif',
              widgetFontSize: widgetData.widgetFontSize || '14px',
              widgetLabelFontSize: widgetData.widgetLabelFontSize || '13px',
              widgetButtonFontSize: widgetData.widgetButtonFontSize || '14px',
              widgetBalanceFontSize: widgetData.widgetBalanceFontSize || '16px',
              widgetBorderRadius: widgetData.widgetBorderRadius || '8px',
              widgetPadding: widgetData.widgetPadding || '16px',
              widgetInputBorderRadius:
                widgetData.widgetInputBorderRadius || '6px',
              widgetInputPadding: widgetData.widgetInputPadding || '8px 12px',
              widgetButtonBorderRadius:
                widgetData.widgetButtonBorderRadius || '6px',
              widgetButtonPadding:
                widgetData.widgetButtonPadding || '10px 20px',
              widgetBoxShadow:
                widgetData.widgetBoxShadow || '0 1px 3px rgba(0,0,0,0.1)',
              widgetInputBoxShadow: widgetData.widgetInputBoxShadow || 'none',
              widgetButtonBoxShadow: widgetData.widgetButtonBoxShadow || 'none'
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

      // Сохраняем настройки виджета в новый endpoint /widget
      const response = await fetch(`/api/projects/${projectId}/widget`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(widgetSettings)
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

  const webhookUrl = project
    ? window.location.origin + '/api/webhook/' + project.webhookSecret
    : '';
  const widgetCode =
    widgetUrl !== ''
      ? '<script src="' + widgetUrl + '?v=27"></' + 'script>'
      : '';
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
    <PageContainer>
      <div className='w-full space-y-6'>
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
        <div className='w-full'>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='w-full space-y-6'
          >
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='widget' className='flex items-center gap-2'>
                <Code className='h-4 w-4' />
                Виджет
              </TabsTrigger>
              <TabsTrigger value='webhook' className='flex items-center gap-2'>
                <Webhook className='h-4 w-4' />
                Webhook
              </TabsTrigger>
              <TabsTrigger value='logs' className='flex items-center gap-2'>
                <FileText className='h-4 w-4' />
                Логи
              </TabsTrigger>
            </TabsList>

            {/* Виджет */}
            <TabsContent
              value='widget'
              className='mt-0 min-h-[600px] space-y-4'
            >
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
                          Автоматически определяет пользователя по
                          email/телефону
                        </li>
                        <li>Работает со всеми типами корзин Tilda</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Настройки виджета */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Settings className='h-5 w-5' />
                    Настройки виджета
                  </CardTitle>
                  <CardDescription>
                    Настройте внешний вид виджета и плашки регистрации
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4 pt-6'>
                  <Accordion
                    type='multiple'
                    defaultValue={['content']}
                    className='w-full'
                  >
                    {/* Содержание */}
                    <AccordionItem value='content'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Содержание
                      </AccordionTrigger>
                      <AccordionContent className='space-y-4'>
                        <div className='space-y-4'>
                          <div className='grid gap-4'>
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
                              <Label htmlFor='registrationDescription'>
                                Описание
                              </Label>
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
                          </div>
                        </div>

                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium'>
                            Кнопка действия
                          </h4>
                          <div className='grid gap-4 md:grid-cols-2'>
                            <div className='space-y-2'>
                              <Label htmlFor='registrationButtonText'>
                                Текст кнопки
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
                                placeholder='Зарегистрироваться'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='registrationButtonUrl'>
                                Ссылка кнопки
                                <span className='text-muted-foreground ml-2 text-xs'>
                                  (опционально, по умолчанию - ссылка на бота)
                                </span>
                              </Label>
                              <Input
                                id='registrationButtonUrl'
                                value={widgetSettings.registrationButtonUrl}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    registrationButtonUrl: e.target.value
                                  })
                                }
                                placeholder='https://example.com/register'
                              />
                              <p className='text-muted-foreground text-xs'>
                                Ссылка для незарегистрированных пользователей
                              </p>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='verificationButtonUrl'>
                                Ссылка для верификации
                                <span className='text-muted-foreground ml-2 text-xs'>
                                  (опционально, по умолчанию - ссылка на бота)
                                </span>
                              </Label>
                              <Input
                                id='verificationButtonUrl'
                                value={widgetSettings.verificationButtonUrl}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    verificationButtonUrl: e.target.value
                                  })
                                }
                                placeholder='https://t.me/your_bot'
                              />
                              <p className='text-muted-foreground text-xs'>
                                Ссылка для подтверждения аккаунта в Telegram
                                боте
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className='grid gap-4'>
                          <div className='space-y-2'>
                            <Label htmlFor='registrationFallbackText'>
                              Текст запасного варианта (если нет бота и ссылки)
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Видимость элементов */}
                    <AccordionItem value='visibility'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Видимость элементов
                      </AccordionTrigger>
                      <AccordionContent className='space-y-3'>
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
                            <Label htmlFor='showTitle'>
                              Показывать заголовок
                            </Label>
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
                            <Label htmlFor='showButton'>
                              Показывать кнопку
                            </Label>
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Цвета */}
                    <AccordionItem value='colors'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Цвета
                      </AccordionTrigger>
                      <AccordionContent className='space-y-4'>
                        <div className='grid gap-4 md:grid-cols-3'>
                          <div className='space-y-2'>
                            <Label htmlFor='backgroundColor'>
                              Основной цвет
                            </Label>
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
                                placeholder='#ffffff'
                              />
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='backgroundGradient'>
                              Градиентный цвет
                            </Label>
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
                                placeholder='#f0f0f0'
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
                                placeholder='#000000'
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
                                placeholder='#000000'
                              />
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='descriptionColor'>
                              Цвет описания
                            </Label>
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
                                placeholder='#666666'
                              />
                            </div>
                          </div>
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
                            <Label htmlFor='buttonBackgroundColor'>
                              Фон кнопки
                            </Label>
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
                                placeholder='#000000'
                              />
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='buttonBorderColor'>
                              Цвет границы кнопки
                            </Label>
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
                                placeholder='#000000'
                              />
                            </div>
                          </div>
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
                                placeholder='#666666'
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Размеры и отступы */}
                    <AccordionItem value='sizes'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Размеры и отступы
                      </AccordionTrigger>
                      <AccordionContent className='space-y-4'>
                        <div className='grid gap-4'>
                          <div className='space-y-2'>
                            <Label htmlFor='fontFamily'>Шрифт</Label>
                            <select
                              id='fontFamily'
                              value={widgetSettings.fontFamily}
                              onChange={(e) =>
                                setWidgetSettings({
                                  ...widgetSettings,
                                  fontFamily: e.target.value
                                })
                              }
                              className='w-full rounded-md border p-2'
                            >
                              <option value='system-ui, -apple-system, sans-serif'>
                                Системный (по умолчанию)
                              </option>
                              <option value="'Montserrat', sans-serif">
                                Montserrat (похож на Avenir Next)
                              </option>
                              <option value="'Nunito Sans', sans-serif">
                                Nunito Sans (мягкий и округлый)
                              </option>
                              <option value="'Poppins', sans-serif">
                                Poppins (геометрический)
                              </option>
                              <option value="'Work Sans', sans-serif">
                                Work Sans (современный)
                              </option>
                              <option value="'Inter', sans-serif">
                                Inter (популярный системный)
                              </option>
                              <option value="'Fira Sans', sans-serif">
                                Fira Sans (технологичный)
                              </option>
                              <option value="'Rubik', sans-serif">
                                Rubik (геометрический)
                              </option>
                            </select>
                            <p className='text-muted-foreground text-xs'>
                              Montserrat наиболее близок к Avenir Next по стилю
                              и геометрии
                            </p>
                          </div>
                        </div>
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
                              placeholder='48px'
                            />
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='titleFontSize'>
                              Размер заголовка
                            </Label>
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
                              Размер кнопки
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
                            <Label htmlFor='buttonPadding'>Отступ кнопки</Label>
                            <Input
                              id='buttonPadding'
                              value={widgetSettings.buttonPadding}
                              onChange={(e) =>
                                setWidgetSettings({
                                  ...widgetSettings,
                                  buttonPadding: e.target.value
                                })
                              }
                              placeholder='12px 24px'
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Настройки виджета бонусов */}
                    <AccordionItem value='widget'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Настройки виджета бонусов
                      </AccordionTrigger>
                      <AccordionContent className='space-y-4'>
                        <div className='space-y-4'>
                          <p className='text-muted-foreground text-xs'>
                            Настройки внешнего вида виджета для авторизованных
                            пользователей
                          </p>
                          <h4 className='text-sm font-medium'>Цвета виджета</h4>
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetBackgroundColor'>
                                Фон виджета
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetBackgroundColor'
                                  type='color'
                                  value={widgetSettings.widgetBackgroundColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetBackgroundColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetBackgroundColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetBackgroundColor: e.target.value
                                    })
                                  }
                                  placeholder='#ffffff'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetBorderColor'>
                                Цвет рамки
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetBorderColor'
                                  type='color'
                                  value={widgetSettings.widgetBorderColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetBorderColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetBorderColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetBorderColor: e.target.value
                                    })
                                  }
                                  placeholder='#e5e7eb'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetTextColor'>
                                Цвет текста
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetTextColor'
                                  type='color'
                                  value={widgetSettings.widgetTextColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetTextColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetTextColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetTextColor: e.target.value
                                    })
                                  }
                                  placeholder='#1f2937'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetLabelColor'>
                                Цвет подписей
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetLabelColor'
                                  type='color'
                                  value={widgetSettings.widgetLabelColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetLabelColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetLabelColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetLabelColor: e.target.value
                                    })
                                  }
                                  placeholder='#6b7280'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetInputBackground'>
                                Фон полей ввода
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetInputBackground'
                                  type='color'
                                  value={widgetSettings.widgetInputBackground}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetInputBackground: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetInputBackground}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetInputBackground: e.target.value
                                    })
                                  }
                                  placeholder='#ffffff'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetInputBorder'>
                                Цвет рамки поля
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetInputBorder'
                                  type='color'
                                  value={widgetSettings.widgetInputBorder}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetInputBorder: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetInputBorder}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetInputBorder: e.target.value
                                    })
                                  }
                                  placeholder='#d1d5db'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonBackground'>
                                Фон кнопки
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetButtonBackground'
                                  type='color'
                                  value={widgetSettings.widgetButtonBackground}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetButtonBackground: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetButtonBackground}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetButtonBackground: e.target.value
                                    })
                                  }
                                  placeholder='#3b82f6'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonText'>
                                Цвет текста кнопки
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetButtonText'
                                  type='color'
                                  value={widgetSettings.widgetButtonText}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetButtonText: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetButtonText}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetButtonText: e.target.value
                                    })
                                  }
                                  placeholder='#ffffff'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonHover'>
                                Цвет кнопки при наведении
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetButtonHover'
                                  type='color'
                                  value={widgetSettings.widgetButtonHover}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetButtonHover: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetButtonHover}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetButtonHover: e.target.value
                                    })
                                  }
                                  placeholder='#2563eb'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetBalanceColor'>
                                Цвет баланса
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetBalanceColor'
                                  type='color'
                                  value={widgetSettings.widgetBalanceColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetBalanceColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetBalanceColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetBalanceColor: e.target.value
                                    })
                                  }
                                  placeholder='#059669'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetSuccessColor'>
                                Цвет успеха
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetSuccessColor'
                                  type='color'
                                  value={widgetSettings.widgetSuccessColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetSuccessColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetSuccessColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetSuccessColor: e.target.value
                                    })
                                  }
                                  placeholder='#059669'
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetErrorColor'>
                                Цвет ошибки
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='widgetErrorColor'
                                  type='color'
                                  value={widgetSettings.widgetErrorColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetErrorColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                />
                                <Input
                                  value={widgetSettings.widgetErrorColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      widgetErrorColor: e.target.value
                                    })
                                  }
                                  placeholder='#dc2626'
                                />
                              </div>
                            </div>
                          </div>

                          <h4 className='text-sm font-medium'>
                            Размеры и отступы
                          </h4>
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetPadding'>
                                Внутренний отступ виджета
                              </Label>
                              <Input
                                id='widgetPadding'
                                value={widgetSettings.widgetPadding}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetPadding: e.target.value
                                  })
                                }
                                placeholder='16px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetBorderRadius'>
                                Скругление виджета
                              </Label>
                              <Input
                                id='widgetBorderRadius'
                                value={widgetSettings.widgetBorderRadius}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetBorderRadius: e.target.value
                                  })
                                }
                                placeholder='8px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetInputBorderRadius'>
                                Скругление полей
                              </Label>
                              <Input
                                id='widgetInputBorderRadius'
                                value={widgetSettings.widgetInputBorderRadius}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetInputBorderRadius: e.target.value
                                  })
                                }
                                placeholder='6px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetInputPadding'>
                                Отступ полей ввода
                              </Label>
                              <Input
                                id='widgetInputPadding'
                                value={widgetSettings.widgetInputPadding}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetInputPadding: e.target.value
                                  })
                                }
                                placeholder='8px 12px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonBorderRadius'>
                                Скругление кнопки
                              </Label>
                              <Input
                                id='widgetButtonBorderRadius'
                                value={widgetSettings.widgetButtonBorderRadius}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetButtonBorderRadius: e.target.value
                                  })
                                }
                                placeholder='6px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonPadding'>
                                Отступ кнопки
                              </Label>
                              <Input
                                id='widgetButtonPadding'
                                value={widgetSettings.widgetButtonPadding}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetButtonPadding: e.target.value
                                  })
                                }
                                placeholder='10px 20px'
                              />
                            </div>
                          </div>

                          <h4 className='text-sm font-medium'>Шрифты</h4>
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetFontFamily'>
                                Шрифт виджета
                              </Label>
                              <select
                                id='widgetFontFamily'
                                value={widgetSettings.widgetFontFamily}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetFontFamily: e.target.value
                                  })
                                }
                                className='w-full rounded-md border p-2'
                              >
                                <option value='system-ui, -apple-system, sans-serif'>
                                  Системный
                                </option>
                                <option value="'Montserrat', sans-serif">
                                  Montserrat
                                </option>
                                <option value="'Nunito Sans', sans-serif">
                                  Nunito Sans
                                </option>
                                <option value="'Poppins', sans-serif">
                                  Poppins
                                </option>
                                <option value="'Inter', sans-serif">
                                  Inter
                                </option>
                              </select>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetFontSize'>
                                Размер шрифта
                              </Label>
                              <Input
                                id='widgetFontSize'
                                value={widgetSettings.widgetFontSize}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetFontSize: e.target.value
                                  })
                                }
                                placeholder='14px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetLabelFontSize'>
                                Размер подписей
                              </Label>
                              <Input
                                id='widgetLabelFontSize'
                                value={widgetSettings.widgetLabelFontSize}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetLabelFontSize: e.target.value
                                  })
                                }
                                placeholder='13px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonFontSize'>
                                Размер текста кнопки
                              </Label>
                              <Input
                                id='widgetButtonFontSize'
                                value={widgetSettings.widgetButtonFontSize}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetButtonFontSize: e.target.value
                                  })
                                }
                                placeholder='14px'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetBalanceFontSize'>
                                Размер баланса
                              </Label>
                              <Input
                                id='widgetBalanceFontSize'
                                value={widgetSettings.widgetBalanceFontSize}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetBalanceFontSize: e.target.value
                                  })
                                }
                                placeholder='16px'
                              />
                            </div>
                          </div>

                          <h4 className='text-sm font-medium'>Тени</h4>
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetBoxShadow'>
                                Тень виджета
                              </Label>
                              <Input
                                id='widgetBoxShadow'
                                value={widgetSettings.widgetBoxShadow}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetBoxShadow: e.target.value
                                  })
                                }
                                placeholder='0 1px 3px rgba(0,0,0,0.1)'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetInputBoxShadow'>
                                Тень полей
                              </Label>
                              <Input
                                id='widgetInputBoxShadow'
                                value={widgetSettings.widgetInputBoxShadow}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetInputBoxShadow: e.target.value
                                  })
                                }
                                placeholder='none'
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='widgetButtonBoxShadow'>
                                Тень кнопки
                              </Label>
                              <Input
                                id='widgetButtonBoxShadow'
                                value={widgetSettings.widgetButtonBoxShadow}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    widgetButtonBoxShadow: e.target.value
                                  })
                                }
                                placeholder='none'
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Дополнительно */}
                    <AccordionItem value='advanced'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Дополнительно
                      </AccordionTrigger>
                      <AccordionContent className='space-y-4'>
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium'>
                            Эффекты и анимация
                          </h4>
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
                              <Label htmlFor='iconAnimation'>
                                Анимация иконки
                              </Label>
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
                            <div className='space-y-2'>
                              <Label htmlFor='titleFontWeight'>
                                Толщина заголовка
                              </Label>
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
                              <Label htmlFor='maxWidth'>
                                Максимальная ширина
                              </Label>
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
                            <div className='space-y-2'>
                              <Label htmlFor='textAlign'>
                                Выравнивание текста
                              </Label>
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
                              <Label htmlFor='buttonBoxShadow'>
                                Тень кнопки
                              </Label>
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Бонусные плашки на товарах */}
                    <AccordionItem value='product-badges'>
                      <AccordionTrigger className='text-sm font-medium'>
                        Бонусные плашки на товарах
                      </AccordionTrigger>
                      <AccordionContent className='space-y-4'>
                        <p className='text-muted-foreground text-xs'>
                          Настройте плашки &quot;Начислим до X бонусов&quot; на
                          карточках и страницах товаров
                        </p>

                        {/* Включение/выключение */}
                        <div className='space-y-3'>
                          <h4 className='text-sm font-medium'>Отображение</h4>
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='flex items-center space-x-2'>
                              <input
                                type='checkbox'
                                id='productBadgeEnabled'
                                checked={widgetSettings.productBadgeEnabled}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeEnabled: e.target.checked
                                  })
                                }
                                className='rounded'
                              />
                              <Label htmlFor='productBadgeEnabled'>
                                Включить плашки
                              </Label>
                            </div>
                            <div className='flex items-center space-x-2'>
                              <input
                                type='checkbox'
                                id='productBadgeShowOnCards'
                                checked={widgetSettings.productBadgeShowOnCards}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeShowOnCards: e.target.checked
                                  })
                                }
                                className='rounded'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                              <Label htmlFor='productBadgeShowOnCards'>
                                На карточках товаров
                              </Label>
                            </div>
                            <div className='flex items-center space-x-2'>
                              <input
                                type='checkbox'
                                id='productBadgeShowOnProductPage'
                                checked={
                                  widgetSettings.productBadgeShowOnProductPage
                                }
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeShowOnProductPage:
                                      e.target.checked
                                  })
                                }
                                className='rounded'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                              <Label htmlFor='productBadgeShowOnProductPage'>
                                На странице товара
                              </Label>
                            </div>
                          </div>
                        </div>

                        {/* Текст и расчёт */}
                        <div className='space-y-3'>
                          <h4 className='text-sm font-medium'>
                            Текст и расчёт
                          </h4>
                          <div className='grid gap-4 md:grid-cols-2'>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeText'>
                                Текст плашки
                                <span className='text-muted-foreground ml-2 text-xs'>
                                  (используйте {'{bonusAmount}'})
                                </span>
                              </Label>
                              <Input
                                id='productBadgeText'
                                value={widgetSettings.productBadgeText}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeText: e.target.value
                                  })
                                }
                                placeholder='Начислим до {bonusAmount} бонусов'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label>Процент начисления</Label>
                              <div className='bg-muted/50 rounded-md border px-3 py-2'>
                                <span className='text-sm font-medium'>
                                  {widgetSettings.productBadgeBonusPercent}%
                                </span>
                              </div>
                              <p className='text-muted-foreground text-xs'>
                                💡 Автоматически берётся максимальный процент из{' '}
                                <Link
                                  href={`/dashboard/projects/${projectId}/settings`}
                                  className='text-blue-600 hover:underline'
                                >
                                  настроек проекта
                                </Link>{' '}
                                или{' '}
                                <Link
                                  href={`/dashboard/projects/${projectId}/bonus-levels`}
                                  className='text-blue-600 hover:underline'
                                >
                                  уровней бонусов
                                </Link>
                              </p>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeLinkUrl'>
                                Ссылка при клике
                                <span className='text-muted-foreground ml-2 text-xs'>
                                  (опционально)
                                </span>
                              </Label>
                              <Input
                                id='productBadgeLinkUrl'
                                value={widgetSettings.productBadgeLinkUrl}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeLinkUrl: e.target.value
                                  })
                                }
                                placeholder='https://example.com/bonuses'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgePosition'>
                                Позиция плашки
                              </Label>
                              <select
                                id='productBadgePosition'
                                value={widgetSettings.productBadgePosition}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgePosition: e.target.value
                                  })
                                }
                                className='w-full rounded-md border p-2'
                                disabled={!widgetSettings.productBadgeEnabled}
                              >
                                <option value='after-price'>После цены</option>
                                <option value='before-price'>
                                  Перед ценой
                                </option>
                                <option value='custom'>
                                  Кастомный селектор
                                </option>
                              </select>
                            </div>
                          </div>
                          {widgetSettings.productBadgePosition === 'custom' && (
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeCustomSelector'>
                                CSS селектор для вставки
                              </Label>
                              <Input
                                id='productBadgeCustomSelector'
                                value={
                                  widgetSettings.productBadgeCustomSelector
                                }
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeCustomSelector: e.target.value
                                  })
                                }
                                placeholder='.my-custom-container'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                          )}
                        </div>

                        {/* Стили */}
                        <div className='space-y-3'>
                          <h4 className='text-sm font-medium'>Стили плашки</h4>
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeBackgroundColor'>
                                Цвет фона
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='productBadgeBackgroundColor'
                                  type='color'
                                  value={
                                    widgetSettings.productBadgeBackgroundColor
                                  }
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      productBadgeBackgroundColor:
                                        e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                  disabled={!widgetSettings.productBadgeEnabled}
                                />
                                <Input
                                  value={
                                    widgetSettings.productBadgeBackgroundColor
                                  }
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      productBadgeBackgroundColor:
                                        e.target.value
                                    })
                                  }
                                  placeholder='#f1f1f1'
                                  disabled={!widgetSettings.productBadgeEnabled}
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeTextColor'>
                                Цвет текста
                              </Label>
                              <div className='flex gap-2'>
                                <Input
                                  id='productBadgeTextColor'
                                  type='color'
                                  value={widgetSettings.productBadgeTextColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      productBadgeTextColor: e.target.value
                                    })
                                  }
                                  className='h-10 w-16 p-1'
                                  disabled={!widgetSettings.productBadgeEnabled}
                                />
                                <Input
                                  value={widgetSettings.productBadgeTextColor}
                                  onChange={(e) =>
                                    setWidgetSettings({
                                      ...widgetSettings,
                                      productBadgeTextColor: e.target.value
                                    })
                                  }
                                  placeholder='#000000'
                                  disabled={!widgetSettings.productBadgeEnabled}
                                />
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeFontSize'>
                                Размер шрифта
                              </Label>
                              <Input
                                id='productBadgeFontSize'
                                value={widgetSettings.productBadgeFontSize}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeFontSize: e.target.value
                                  })
                                }
                                placeholder='14px'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeFontWeight'>
                                Толщина шрифта
                              </Label>
                              <select
                                id='productBadgeFontWeight'
                                value={widgetSettings.productBadgeFontWeight}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeFontWeight: e.target.value
                                  })
                                }
                                className='w-full rounded-md border p-2'
                                disabled={!widgetSettings.productBadgeEnabled}
                              >
                                <option value='400'>Обычный (400)</option>
                                <option value='500'>Средний (500)</option>
                                <option value='600'>Полужирный (600)</option>
                                <option value='700'>Жирный (700)</option>
                              </select>
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgePadding'>
                                Внутренние отступы
                              </Label>
                              <Input
                                id='productBadgePadding'
                                value={widgetSettings.productBadgePadding}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgePadding: e.target.value
                                  })
                                }
                                placeholder='5px 10px'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeBorderRadius'>
                                Скругление углов
                              </Label>
                              <Input
                                id='productBadgeBorderRadius'
                                value={widgetSettings.productBadgeBorderRadius}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeBorderRadius: e.target.value
                                  })
                                }
                                placeholder='5px'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeMarginTop'>
                                Отступ сверху
                              </Label>
                              <Input
                                id='productBadgeMarginTop'
                                value={widgetSettings.productBadgeMarginTop}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeMarginTop: e.target.value
                                  })
                                }
                                placeholder='5px'
                                disabled={!widgetSettings.productBadgeEnabled}
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='productBadgeFontFamily'>
                                Шрифт
                              </Label>
                              <select
                                id='productBadgeFontFamily'
                                value={widgetSettings.productBadgeFontFamily}
                                onChange={(e) =>
                                  setWidgetSettings({
                                    ...widgetSettings,
                                    productBadgeFontFamily: e.target.value
                                  })
                                }
                                className='w-full rounded-md border p-2'
                                disabled={!widgetSettings.productBadgeEnabled}
                              >
                                <option value='inherit'>
                                  Наследовать от сайта
                                </option>
                                <option value="'AvenirNext', sans-serif">
                                  AvenirNext
                                </option>
                                <option value="'Montserrat', sans-serif">
                                  Montserrat
                                </option>
                                <option value='system-ui, sans-serif'>
                                  Системный
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Превью плашки */}
                        {widgetSettings.productBadgeEnabled && (
                          <div className='space-y-2 border-t pt-4'>
                            <p className='text-muted-foreground text-xs font-medium'>
                              Предварительный просмотр плашки
                            </p>
                            <div className='bg-muted/20 rounded-lg border p-4'>
                              <div className='flex flex-col gap-2'>
                                {/* Before price */}
                                {widgetSettings.productBadgePosition ===
                                  'before-price' && (
                                  <div
                                    style={{
                                      backgroundColor:
                                        widgetSettings.productBadgeBackgroundColor,
                                      color:
                                        widgetSettings.productBadgeTextColor,
                                      fontFamily:
                                        widgetSettings.productBadgeFontFamily,
                                      fontSize:
                                        widgetSettings.productBadgeFontSize,
                                      fontWeight:
                                        widgetSettings.productBadgeFontWeight,
                                      padding:
                                        widgetSettings.productBadgePadding,
                                      borderRadius:
                                        widgetSettings.productBadgeBorderRadius,
                                      marginBottom:
                                        widgetSettings.productBadgeMarginTop,
                                      cursor: widgetSettings.productBadgeLinkUrl
                                        ? 'pointer'
                                        : 'default',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {widgetSettings.productBadgeText.replace(
                                      '{bonusAmount}',
                                      String(
                                        Math.round(
                                          3990 *
                                            (widgetSettings.productBadgeBonusPercent /
                                              100)
                                        )
                                      )
                                    )}
                                  </div>
                                )}

                                {/* Price */}
                                <div className='text-lg font-medium'>
                                  3 990 р.
                                </div>

                                {/* After price */}
                                {widgetSettings.productBadgePosition ===
                                  'after-price' && (
                                  <div
                                    style={{
                                      backgroundColor:
                                        widgetSettings.productBadgeBackgroundColor,
                                      color:
                                        widgetSettings.productBadgeTextColor,
                                      fontFamily:
                                        widgetSettings.productBadgeFontFamily,
                                      fontSize:
                                        widgetSettings.productBadgeFontSize,
                                      fontWeight:
                                        widgetSettings.productBadgeFontWeight,
                                      padding:
                                        widgetSettings.productBadgePadding,
                                      borderRadius:
                                        widgetSettings.productBadgeBorderRadius,
                                      marginTop:
                                        widgetSettings.productBadgeMarginTop,
                                      cursor: widgetSettings.productBadgeLinkUrl
                                        ? 'pointer'
                                        : 'default',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {widgetSettings.productBadgeText.replace(
                                      '{bonusAmount}',
                                      String(
                                        Math.round(
                                          3990 *
                                            (widgetSettings.productBadgeBonusPercent /
                                              100)
                                        )
                                      )
                                    )}
                                  </div>
                                )}

                                {/* Custom position note */}
                                {widgetSettings.productBadgePosition ===
                                  'custom' && (
                                  <div className='text-muted-foreground text-xs italic'>
                                    Кастомная позиция:{' '}
                                    {widgetSettings.productBadgeCustomSelector ||
                                      'не указана'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Предварительный просмотр и сохранение */}
                  <div className='space-y-4 border-t pt-4'>
                    <div className='flex items-center justify-between'>
                      <h4 className='text-sm font-medium'>
                        Предварительный просмотр
                      </h4>
                      <Button onClick={saveWidgetSettings} disabled={saving}>
                        <Save className='mr-2 h-4 w-4' />
                        {saving ? 'Сохранение...' : 'Сохранить настройки'}
                      </Button>
                    </div>

                    <div className='space-y-4'>
                      {/* Превью для неавторизованного пользователя */}
                      <div>
                        <p className='text-muted-foreground mb-2 text-xs font-medium'>
                          Неавторизованный пользователь
                        </p>
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
                              fontSize: widgetSettings.fontSize || '14px',
                              fontFamily:
                                widgetSettings.fontFamily ||
                                'system-ui, -apple-system, sans-serif'
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
                                  background:
                                    widgetSettings.buttonBackgroundColor,
                                  border: `1px solid ${widgetSettings.buttonBorderColor}`,
                                  color: widgetSettings.buttonTextColor,
                                  fontSize: widgetSettings.buttonFontSize,
                                  fontWeight: widgetSettings.buttonFontWeight,
                                  padding: widgetSettings.buttonPadding,
                                  borderRadius:
                                    widgetSettings.buttonBorderRadius,
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
                                  background:
                                    widgetSettings.fallbackBackgroundColor,
                                  padding: widgetSettings.fallbackPadding,
                                  borderRadius:
                                    widgetSettings.fallbackBorderRadius,
                                  opacity: 0.8
                                }}
                              >
                                {widgetSettings.registrationFallbackText}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Превью для авторизованного пользователя */}
                      <div>
                        <p className='text-muted-foreground mb-2 text-xs font-medium'>
                          Авторизованный пользователь
                        </p>
                        <div className='bg-muted/20 rounded-lg border p-4'>
                          <div
                            className='rounded-lg'
                            style={{
                              background: widgetSettings.widgetBackgroundColor,
                              border: `1px solid ${widgetSettings.widgetBorderColor}`,
                              borderRadius: widgetSettings.widgetBorderRadius,
                              padding: widgetSettings.widgetPadding,
                              boxShadow: widgetSettings.widgetBoxShadow,
                              fontFamily: widgetSettings.widgetFontFamily,
                              fontSize: widgetSettings.widgetFontSize,
                              color: widgetSettings.widgetTextColor
                            }}
                          >
                            {/* Заголовок виджета */}
                            <div
                              className='mb-3'
                              style={{
                                fontSize: widgetSettings.widgetBalanceFontSize,
                                fontWeight: '600',
                                color: widgetSettings.widgetTextColor
                              }}
                            >
                              Бонусная программа
                            </div>

                            {/* Переключатель режимов */}
                            <div
                              className='mb-3 flex gap-2'
                              style={{
                                marginBottom: '8px'
                              }}
                            >
                              <button
                                type='button'
                                className='rounded px-3 py-1.5 text-sm font-medium transition-colors'
                                style={{
                                  background:
                                    widgetSettings.widgetButtonBackground,
                                  color: widgetSettings.widgetButtonText,
                                  border: 'none',
                                  borderRadius:
                                    widgetSettings.widgetInputBorderRadius,
                                  fontSize: widgetSettings.widgetFontSize
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    widgetSettings.widgetButtonHover;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    widgetSettings.widgetButtonBackground;
                                }}
                              >
                                Списать бонусы
                              </button>
                              <button
                                type='button'
                                className='rounded border px-3 py-1.5 text-sm font-medium transition-colors'
                                style={{
                                  background:
                                    widgetSettings.widgetInputBackground,
                                  color: widgetSettings.widgetTextColor,
                                  border: `1px solid ${widgetSettings.widgetBorderColor}`,
                                  borderRadius:
                                    widgetSettings.widgetInputBorderRadius,
                                  fontSize: widgetSettings.widgetFontSize
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    widgetSettings.widgetBorderColor + '20';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    widgetSettings.widgetInputBackground;
                                }}
                              >
                                Промокод
                              </button>
                            </div>

                            {/* Баланс бонусов */}
                            <div
                              className='mb-3'
                              style={{
                                fontSize: widgetSettings.widgetLabelFontSize,
                                color: widgetSettings.widgetLabelColor,
                                marginBottom: '12px'
                              }}
                            >
                              Ваш баланс:{' '}
                              <span
                                style={{
                                  fontSize:
                                    widgetSettings.widgetBalanceFontSize,
                                  color: widgetSettings.widgetBalanceColor,
                                  fontWeight: '600'
                                }}
                              >
                                2500
                              </span>{' '}
                              бонусов
                            </div>

                            {/* Поле ввода и кнопка */}
                            <div
                              className='flex gap-2'
                              style={{
                                display: 'flex',
                                gap: '8px',
                                marginBottom: '8px'
                              }}
                            >
                              <input
                                type='number'
                                placeholder='Количество бонусов'
                                min='0'
                                className='flex-1 rounded border px-3 py-2 text-sm'
                                style={{
                                  background:
                                    widgetSettings.widgetInputBackground,
                                  border: `1px solid ${widgetSettings.widgetInputBorder}`,
                                  borderRadius:
                                    widgetSettings.widgetInputBorderRadius,
                                  padding: widgetSettings.widgetInputPadding,
                                  fontSize: widgetSettings.widgetFontSize,
                                  color: widgetSettings.widgetInputText,
                                  fontFamily: widgetSettings.widgetFontFamily,
                                  boxShadow: widgetSettings.widgetInputBoxShadow
                                }}
                                value='500'
                                readOnly
                              />
                              <button
                                type='button'
                                className='rounded px-4 py-2 text-sm font-medium transition-colors'
                                style={{
                                  background:
                                    widgetSettings.widgetButtonBackground,
                                  color: widgetSettings.widgetButtonText,
                                  border: 'none',
                                  borderRadius:
                                    widgetSettings.widgetButtonBorderRadius,
                                  padding: widgetSettings.widgetButtonPadding,
                                  fontSize: widgetSettings.widgetButtonFontSize,
                                  fontFamily: widgetSettings.widgetFontFamily,
                                  boxShadow:
                                    widgetSettings.widgetButtonBoxShadow
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    widgetSettings.widgetButtonHover;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    widgetSettings.widgetButtonBackground;
                                }}
                              >
                                Применить бонусы
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Webhook */}
            <TabsContent
              value='webhook'
              className='mt-0 min-h-[600px] space-y-4'
            >
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
                      <li>
                        Найдите раздел &quot;Уведомления и интеграции&quot;
                      </li>
                      <li>Добавьте новый webhook</li>
                      <li>Вставьте URL</li>
                      <li>Сохраните настройки</li>
                    </ol>
                    <p className='text-muted-foreground mt-2 text-sm'>
                      При сохранении Tilda автоматически отправит тестовый
                      запрос для проверки подключения
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Логи: полноценный интерфейс (embedded для фиксированной ширины) */}
            <TabsContent value='logs' className='mt-0 min-h-[600px] space-y-4'>
              <ProjectLogsView
                embedded
                params={Promise.resolve({ id: projectId })}
              />
            </TabsContent>
          </Tabs>
        </div>

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
