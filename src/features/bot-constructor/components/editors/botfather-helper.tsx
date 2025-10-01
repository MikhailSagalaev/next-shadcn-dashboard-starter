/**
 * @file: src/features/bot-constructor/components/editors/botfather-helper.tsx
 * @description: Интеграция с Bot Father для настройки команд
 * @project: SaaS Bonus System
 * @dependencies: React, UI components, Command templates
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Bot,
  Copy,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Settings,
  MessageSquare,
  Users,
  Gift,
  CreditCard,
  HelpCircle,
  Info
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import type { CommandConfig } from '@/types/bot-constructor';

interface BotfatherHelperProps {
  config: CommandConfig;
  onChange: (config: CommandConfig) => void;
  botUsername?: string;
}

// Предустановленные шаблоны команд
const commandTemplates = [
  {
    name: 'start',
    description: 'Приветственное сообщение',
    command: 'start',
    template:
      'Добро пожаловать! Я ваш персональный помощник. Выберите действие:',
    icon: MessageSquare,
    category: 'basic'
  },
  {
    name: 'help',
    description: 'Справка по командам',
    command: 'help',
    template:
      '📋 Доступные команды:\n/start - Начать работу\n/help - Показать справку\n/menu - Главное меню',
    icon: HelpCircle,
    category: 'basic'
  },
  {
    name: 'menu',
    description: 'Главное меню',
    command: 'menu',
    template: '🏠 Главное меню\n\nВыберите раздел:',
    icon: Settings,
    category: 'navigation'
  },
  {
    name: 'profile',
    description: 'Профиль пользователя',
    command: 'profile',
    template:
      '👤 Ваш профиль\n\nИмя: {firstName}\nБонусы: {bonusBalance} ₽\nСтатус: {status}',
    icon: Users,
    category: 'user'
  },
  {
    name: 'bonuses',
    description: 'Баланс бонусов',
    command: 'bonuses',
    template:
      '💰 Ваши бонусы\n\nТекущий баланс: {bonusBalance} ₽\nВсего заработано: {totalEarned} ₽\nПотрачено: {totalSpent} ₽',
    icon: Gift,
    category: 'bonuses'
  },
  {
    name: 'pay',
    description: 'Оплата бонусами',
    command: 'pay',
    template:
      '💳 Оплата бонусами\n\nДоступно: {bonusBalance} ₽\nВведите сумму оплаты:',
    icon: CreditCard,
    category: 'payment'
  }
];

const categories = [
  { id: 'basic', label: 'Основные', color: 'bg-blue-500' },
  { id: 'navigation', label: 'Навигация', color: 'bg-green-500' },
  { id: 'user', label: 'Пользователь', color: 'bg-purple-500' },
  { id: 'bonuses', label: 'Бонусы', color: 'bg-yellow-500' },
  { id: 'payment', label: 'Оплата', color: 'bg-red-500' }
];

export function BotfatherHelper({
  config,
  onChange,
  botUsername
}: BotfatherHelperProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('basic');

  // Generate Bot Father command text
  const generateBotFatherCommand = useCallback(() => {
    const commands = [
      `/setcommands`,
      ``,
      `start - ${config.description || 'Запустить бота'}`,
      `help - Показать справку`,
      `menu - Главное меню`,
      `profile - Профиль пользователя`,
      `bonuses - Баланс бонусов`,
      `pay - Оплатить бонусами`
    ];

    return commands.join('\n');
  }, [config.description]);

  // Copy to clipboard
  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: 'Скопировано',
          description: `${label} скопировано в буфер обмена`
        });
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось скопировать в буфер обмена',
          variant: 'destructive'
        });
      }
    },
    [toast]
  );

  // Apply template
  const applyTemplate = useCallback(
    (template: (typeof commandTemplates)[0]) => {
      onChange({
        ...config,
        command: template.command,
        description: template.description
      });

      // Here you could also update the message template
      toast({
        title: 'Шаблон применен',
        description: `Команда "${template.command}" настроена`
      });
    },
    [config, onChange, toast]
  );

  // Get filtered templates
  const filteredTemplates = commandTemplates.filter(
    (template) => template.category === selectedCategory
  );

  return (
    <div className='space-y-4'>
      {/* Bot Father Integration */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center space-x-2 text-sm'>
            <Bot className='h-4 w-4' />
            <span>Bot Father - Настройка команд</span>
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Alert>
            <Info className='h-4 w-4' />
            <AlertDescription>
              Для работы команд в Telegram настройте их через @BotFather.
              Скопируйте текст ниже и отправьте его боту.
            </AlertDescription>
          </Alert>

          <div className='rounded-lg bg-gray-50 p-4 font-mono text-sm dark:bg-gray-800'>
            <pre className='whitespace-pre-wrap'>
              {generateBotFatherCommand()}
            </pre>
          </div>

          <div className='flex space-x-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() =>
                copyToClipboard(
                  generateBotFatherCommand(),
                  'Команды для Bot Father'
                )
              }
            >
              <Copy className='mr-2 h-4 w-4' />
              Скопировать
            </Button>

            <Button
              variant='outline'
              size='sm'
              onClick={() => window.open('https://t.me/botfather', '_blank')}
            >
              <ExternalLink className='mr-2 h-4 w-4' />
              Открыть Bot Father
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Templates */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Готовые шаблоны команд</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className='grid w-full grid-cols-5'>
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className='text-xs'
                >
                  {category.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => (
              <TabsContent
                key={category.id}
                value={category.id}
                className='mt-4'
              >
                <div className='grid gap-3'>
                  {commandTemplates
                    .filter((template) => template.category === category.id)
                    .map((template) => {
                      const Icon = template.icon;
                      const isActive = config.command === template.command;

                      return (
                        <Card
                          key={template.name}
                          className={`cursor-pointer transition-colors ${
                            isActive
                              ? 'ring-primary ring-2'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => applyTemplate(template)}
                        >
                          <CardContent className='p-3'>
                            <div className='flex items-start space-x-3'>
                              <div
                                className={`rounded-lg p-2 ${category.color}`}
                              >
                                <Icon className='h-4 w-4 text-white' />
                              </div>

                              <div className='min-w-0 flex-1'>
                                <div className='flex items-center space-x-2'>
                                  <h4 className='text-sm font-medium'>
                                    /{template.command}
                                  </h4>
                                  {isActive && (
                                    <Badge
                                      variant='secondary'
                                      className='text-xs'
                                    >
                                      Активна
                                    </Badge>
                                  )}
                                </div>

                                <p className='text-muted-foreground mt-1 text-xs'>
                                  {template.description}
                                </p>

                                <div className='bg-muted mt-2 rounded p-2 text-xs'>
                                  {template.template}
                                </div>
                              </div>

                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyTemplate(template);
                                }}
                              >
                                {isActive ? (
                                  <CheckCircle className='h-4 w-4 text-green-500' />
                                ) : (
                                  <Settings className='h-4 w-4' />
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Current Command Settings */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Текущая команда</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='text-sm font-medium'>Команда</label>
              <div className='bg-muted mt-1 rounded p-2 font-mono'>
                /{config.command || 'не указана'}
              </div>
            </div>

            <div>
              <label className='text-sm font-medium'>Описание</label>
              <div className='bg-muted mt-1 rounded p-2 text-sm'>
                {config.description || 'без описания'}
              </div>
            </div>
          </div>

          {botUsername && (
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                После настройки команд в Bot Father пользователи смогут вызывать
                их через:
                <code className='ml-1'>@{botUsername}</code>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Lightbulb className='h-4 w-4' />
            <AlertDescription>
              <strong>Совет:</strong> Используйте описательные названия команд
              для лучшего UX. Команды должны быть на английском языке без
              пробелов.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Quick Setup */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Быстрая настройка</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='text-muted-foreground text-sm'>
              Рекомендуемый набор команд для бота:
            </div>

            <div className='grid grid-cols-2 gap-2'>
              {['start', 'help', 'menu', 'profile', 'bonuses'].map((cmd) => {
                const template = commandTemplates.find(
                  (t) => t.command === cmd
                );
                if (!template) return null;

                const Icon = template.icon;
                const isConfigured = config.command === cmd;

                return (
                  <div
                    key={cmd}
                    className={`flex cursor-pointer items-center space-x-2 rounded border p-2 transition-colors ${
                      isConfigured
                        ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => applyTemplate(template)}
                  >
                    <Icon className='h-4 w-4' />
                    <span className='text-sm'>/{cmd}</span>
                    {isConfigured && (
                      <CheckCircle className='ml-auto h-4 w-4 text-green-500' />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
