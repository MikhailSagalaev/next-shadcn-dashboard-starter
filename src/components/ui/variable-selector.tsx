/**
 * @file: src/components/ui/variable-selector.tsx
 * @description: Компонент для выбора и вставки переменных в сообщения
 * @project: SaaS Bonus System
 * @created: 2025-10-15
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Search,
  Copy,
  User,
  DollarSign,
  Target,
  Calendar,
  BarChart,
  Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Определяем категории переменных
const VARIABLE_CATEGORIES = {
  personal: {
    title: 'Личная информация',
    icon: User,
    color: 'bg-blue-100 text-blue-800',
    variables: [
      { key: 'user.firstName', label: 'Имя', description: 'Имя пользователя' },
      {
        key: 'user.lastName',
        label: 'Фамилия',
        description: 'Фамилия пользователя'
      },
      {
        key: 'user.fullName',
        label: 'Полное имя',
        description: 'Имя и фамилия'
      },
      { key: 'user.email', label: 'Email', description: 'Электронная почта' },
      { key: 'user.phone', label: 'Телефон', description: 'Номер телефона' },
      {
        key: 'user.telegramId',
        label: 'Telegram ID',
        description: 'ID в Telegram'
      },
      {
        key: 'user.telegramUsername',
        label: 'Username',
        description: 'Имя пользователя в Telegram'
      }
    ]
  },
  financial: {
    title: 'Финансы',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800',
    variables: [
      {
        key: 'user.balance',
        label: 'Баланс',
        description: 'Текущий баланс бонусов'
      },
      {
        key: 'user.balanceFormatted',
        label: 'Баланс (форматированный)',
        description: 'Баланс с валютой'
      },
      {
        key: 'user.totalEarned',
        label: 'Заработано',
        description: 'Всего заработано бонусов'
      },
      {
        key: 'user.totalEarnedFormatted',
        label: 'Заработано (форматированный)',
        description: 'Заработано с валютой'
      },
      {
        key: 'user.totalSpent',
        label: 'Потрачено',
        description: 'Всего потрачено бонусов'
      },
      {
        key: 'user.totalSpentFormatted',
        label: 'Потрачено (форматированный)',
        description: 'Потрачено с валютой'
      },
      {
        key: 'user.totalPurchases',
        label: 'Покупки',
        description: 'Сумма покупок'
      },
      {
        key: 'user.totalPurchasesFormatted',
        label: 'Покупки (форматированные)',
        description: 'Покупки с валютой'
      }
    ]
  },
  level: {
    title: 'Уровень и рефералы',
    icon: Target,
    color: 'bg-purple-100 text-purple-800',
    variables: [
      {
        key: 'user.currentLevel',
        label: 'Текущий уровень',
        description: 'Уровень лояльности'
      },
      {
        key: 'user.referralCode',
        label: 'Реферальный код',
        description: 'Код для приглашений'
      },
      {
        key: 'user.referralLink',
        label: 'Реферальная ссылка',
        description: 'Ссылка для приглашений'
      },
      {
        key: 'user.referrerName',
        label: 'Кто пригласил',
        description: 'Имя пригласившего'
      },
      {
        key: 'user.hasReferralCode',
        label: 'Есть код',
        description: 'Есть ли реферальный код'
      }
    ]
  },
  dates: {
    title: 'Даты',
    icon: Calendar,
    color: 'bg-orange-100 text-orange-800',
    variables: [
      {
        key: 'user.registeredAt',
        label: 'Дата регистрации',
        description: 'Когда зарегистрирован'
      },
      {
        key: 'user.updatedAt',
        label: 'Последнее обновление',
        description: 'Когда последний раз обновлялся'
      }
    ]
  },
  stats: {
    title: 'Статистика',
    icon: BarChart,
    color: 'bg-indigo-100 text-indigo-800',
    variables: [
      {
        key: 'user.transactionCount',
        label: 'Количество транзакций',
        description: 'Всего транзакций'
      },
      {
        key: 'user.bonusCount',
        label: 'Количество бонусов',
        description: 'Всего бонусов'
      },
      {
        key: 'user.hasTransactions',
        label: 'Есть транзакции',
        description: 'Есть ли транзакции'
      },
      {
        key: 'user.isNewUser',
        label: 'Новый пользователь',
        description: 'Является ли новым'
      },
      {
        key: 'user.transactionHistory',
        label: 'История транзакций',
        description: 'Список транзакций'
      },
      {
        key: 'user.lastTransaction',
        label: 'Последняя транзакция',
        description: 'Информация о последней транзакции'
      }
    ]
  },
  bonuses: {
    title: 'Бонусы',
    icon: Gift,
    color: 'bg-pink-100 text-pink-800',
    variables: [
      {
        key: 'user.activeBonuses',
        label: 'Активные бонусы',
        description: 'Список активных бонусов'
      },
      {
        key: 'user.hasActiveBonuses',
        label: 'Есть активные бонусы',
        description: 'Есть ли активные бонусы'
      }
    ]
  }
};

interface VariableSelectorProps {
  onVariableSelect: (variable: string) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function VariableSelector({
  onVariableSelect,
  trigger,
  className
}: VariableSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('personal');

  // Фильтруем переменные по поисковому запросу
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) {
      return VARIABLE_CATEGORIES;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Partial<typeof VARIABLE_CATEGORIES> = {};

    Object.entries(VARIABLE_CATEGORIES).forEach(([categoryKey, category]) => {
      const matchingVariables = category.variables.filter(
        (variable) =>
          variable.key.toLowerCase().includes(query) ||
          variable.label.toLowerCase().includes(query) ||
          variable.description.toLowerCase().includes(query)
      );

      if (matchingVariables.length > 0) {
        filtered[categoryKey] = {
          ...category,
          variables: matchingVariables
        };
      }
    });

    return filtered;
  }, [searchQuery]);

  const handleVariableClick = (variableKey: string) => {
    onVariableSelect(variableKey);
    setOpen(false);
  };

  const copyToClipboard = (variableKey: string) => {
    navigator.clipboard.writeText(`{${variableKey}}`);
  };

  const defaultTrigger = (
    <Button
      variant='outline'
      size='sm'
      className={cn(
        'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100',
        'transition-all duration-200 hover:border-blue-300 hover:shadow-md',
        className
      )}
    >
      <Target className='mr-2 h-4 w-4 text-blue-600' />
      <span className='font-medium text-blue-700'>Вставить переменную</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className='animate-in fade-in-0 zoom-in-95 max-h-[90vh] max-w-5xl overflow-hidden p-0 duration-200'>
        <DialogHeader className='border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4'>
          <DialogTitle className='flex items-center gap-2 text-lg font-semibold text-gray-900'>
            <Target className='h-5 w-5 text-blue-600' />
            Переменные
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 px-6 py-4'>
          {/* Поиск */}
          <div className='relative'>
            <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
            <Input
              placeholder='Поиск переменных...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='h-11 border-gray-200 pl-10 text-sm focus:border-blue-500 focus:ring-blue-500'
            />
          </div>

          {/* Категории и переменные */}
          <Tabs
            value={activeCategory}
            onValueChange={setActiveCategory}
            className='w-full'
          >
            <TabsList className='bg-muted/50 grid h-auto w-full grid-cols-6 gap-2 p-2'>
              {Object.entries(VARIABLE_CATEGORIES).map(([key, category]) => {
                const Icon = category.icon;
                const hasVariables =
                  filteredVariables[key]?.variables.length > 0;
                const isActive = activeCategory === key;

                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    disabled={!hasVariables}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-2 p-3 text-xs font-medium transition-all duration-200',
                      'data-[state=active]:bg-background data-[state=active]:shadow-md',
                      'data-[state=active]:border-primary/20 data-[state=active]:border-2',
                      'hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50',
                      'min-h-[90px] w-full rounded-lg',
                      isActive &&
                        'bg-background border-primary/20 border-2 shadow-md'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span
                      className={cn(
                        'w-full text-center text-[11px] leading-tight font-medium',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {category.title}
                    </span>
                    {hasVariables && (
                      <Badge
                        variant='secondary'
                        className={cn(
                          'h-5 shrink-0 px-2 py-0 text-[10px] font-semibold',
                          'flex items-center justify-center',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {filteredVariables[key]?.variables.length || 0}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(filteredVariables).map(
              ([categoryKey, category]) => (
                <TabsContent
                  key={categoryKey}
                  value={categoryKey}
                  className='mt-4'
                >
                  <ScrollArea className='h-80'>
                    <div className='space-y-2 pr-4'>
                      {category.variables.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-8 text-center'>
                          <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100'>
                            <Search className='h-6 w-6 text-gray-400' />
                          </div>
                          <h3 className='mb-1 text-sm font-semibold text-gray-900'>
                            Переменные не найдены
                          </h3>
                          <p className='max-w-xs text-xs text-gray-500'>
                            Попробуйте изменить поисковый запрос или выберите
                            другую категорию
                          </p>
                        </div>
                      ) : (
                        category.variables.map((variable) => (
                          <div
                            key={variable.key}
                            className='group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200 hover:border-blue-300 hover:shadow-sm'
                          >
                            <div className='min-w-0 flex-1'>
                              <div className='mb-1 flex items-center gap-2'>
                                <Badge
                                  variant='outline'
                                  className='border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700'
                                >
                                  {variable.key}
                                </Badge>
                                <span className='truncate text-sm font-medium text-gray-900'>
                                  {variable.label}
                                </span>
                              </div>
                              <p className='text-xs leading-relaxed text-gray-600'>
                                {variable.description}
                              </p>
                            </div>
                            <div className='ml-3 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => copyToClipboard(variable.key)}
                                title='Копировать в буфер обмена'
                                className='h-7 border-gray-300 px-2 text-[10px] hover:border-blue-400 hover:text-blue-600'
                              >
                                <Copy className='mr-1 h-3 w-3' />
                                Копировать
                              </Button>
                              <Button
                                size='sm'
                                onClick={() =>
                                  handleVariableClick(variable.key)
                                }
                                className='h-7 bg-blue-600 px-3 text-[10px] hover:bg-blue-700'
                              >
                                Вставить
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )
            )}
          </Tabs>

          {/* Инструкция */}
          <div className='rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3'>
            <div className='flex items-start gap-2'>
              <div className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-blue-100'>
                <Target className='h-3 w-3 text-blue-600' />
              </div>
              <div>
                <h4 className='mb-1 text-sm font-medium text-gray-900'>
                  Как использовать переменные
                </h4>
                <ul className='space-y-0.5 text-xs text-gray-700'>
                  <li className='flex items-center gap-1.5'>
                    <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                    Нажмите <strong>"Вставить"</strong> чтобы добавить
                    переменную в текст
                  </li>
                  <li className='flex items-center gap-1.5'>
                    <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                    Или нажмите <strong>"Копировать"</strong> и вставьте вручную
                  </li>
                  <li className='flex items-center gap-1.5'>
                    <div className='h-1 w-1 rounded-full bg-blue-500'></div>
                    Переменные автоматически заменяются реальными данными
                    пользователя
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Хук для автодополнения переменных
export function useVariableAutocomplete() {
  const [suggestions, setSuggestions] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleTextChange = (text: string, cursorPosition: number) => {
    // Ищем открывающую скобку перед курсором
    const beforeCursor = text.substring(0, cursorPosition);
    const lastOpenBrace = beforeCursor.lastIndexOf('{');

    if (lastOpenBrace !== -1) {
      const afterOpenBrace = beforeCursor.substring(lastOpenBrace + 1);
      const hasClosingBrace = afterOpenBrace.includes('}');

      if (!hasClosingBrace) {
        // Показываем подсказки
        const query = afterOpenBrace.toLowerCase();
        const allVariables = Object.values(VARIABLE_CATEGORIES)
          .flatMap((category) => category.variables)
          .filter(
            (variable) =>
              variable.key.toLowerCase().includes(query) ||
              variable.label.toLowerCase().includes(query)
          )
          .slice(0, 10); // Ограничиваем количество подсказок

        setSuggestions(allVariables);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  return {
    suggestions,
    showSuggestions,
    handleTextChange,
    setShowSuggestions
  };
}
