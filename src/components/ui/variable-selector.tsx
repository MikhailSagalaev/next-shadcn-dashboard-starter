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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Copy, User, DollarSign, Target, Calendar, BarChart, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

// Определяем категории переменных
const VARIABLE_CATEGORIES = {
  personal: {
    title: 'Личная информация',
    icon: User,
    color: 'bg-blue-100 text-blue-800',
    variables: [
      { key: 'user.firstName', label: 'Имя', description: 'Имя пользователя' },
      { key: 'user.lastName', label: 'Фамилия', description: 'Фамилия пользователя' },
      { key: 'user.fullName', label: 'Полное имя', description: 'Имя и фамилия' },
      { key: 'user.email', label: 'Email', description: 'Электронная почта' },
      { key: 'user.phone', label: 'Телефон', description: 'Номер телефона' },
      { key: 'user.telegramId', label: 'Telegram ID', description: 'ID в Telegram' },
      { key: 'user.telegramUsername', label: 'Username', description: 'Имя пользователя в Telegram' }
    ]
  },
  financial: {
    title: 'Финансы',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800',
    variables: [
      { key: 'user.balance', label: 'Баланс', description: 'Текущий баланс бонусов' },
      { key: 'user.balanceFormatted', label: 'Баланс (форматированный)', description: 'Баланс с валютой' },
      { key: 'user.totalEarned', label: 'Заработано', description: 'Всего заработано бонусов' },
      { key: 'user.totalEarnedFormatted', label: 'Заработано (форматированный)', description: 'Заработано с валютой' },
      { key: 'user.totalSpent', label: 'Потрачено', description: 'Всего потрачено бонусов' },
      { key: 'user.totalSpentFormatted', label: 'Потрачено (форматированный)', description: 'Потрачено с валютой' },
      { key: 'user.totalPurchases', label: 'Покупки', description: 'Сумма покупок' },
      { key: 'user.totalPurchasesFormatted', label: 'Покупки (форматированные)', description: 'Покупки с валютой' }
    ]
  },
  level: {
    title: 'Уровень и рефералы',
    icon: Target,
    color: 'bg-purple-100 text-purple-800',
    variables: [
      { key: 'user.currentLevel', label: 'Текущий уровень', description: 'Уровень лояльности' },
      { key: 'user.referralCode', label: 'Реферальный код', description: 'Код для приглашений' },
      { key: 'user.referralLink', label: 'Реферальная ссылка', description: 'Ссылка для приглашений' },
      { key: 'user.referrerName', label: 'Кто пригласил', description: 'Имя пригласившего' },
      { key: 'user.hasReferralCode', label: 'Есть код', description: 'Есть ли реферальный код' }
    ]
  },
  dates: {
    title: 'Даты',
    icon: Calendar,
    color: 'bg-orange-100 text-orange-800',
    variables: [
      { key: 'user.registeredAt', label: 'Дата регистрации', description: 'Когда зарегистрирован' },
      { key: 'user.updatedAt', label: 'Последнее обновление', description: 'Когда последний раз обновлялся' }
    ]
  },
  stats: {
    title: 'Статистика',
    icon: BarChart,
    color: 'bg-indigo-100 text-indigo-800',
    variables: [
      { key: 'user.transactionCount', label: 'Количество транзакций', description: 'Всего транзакций' },
      { key: 'user.bonusCount', label: 'Количество бонусов', description: 'Всего бонусов' },
      { key: 'user.hasTransactions', label: 'Есть транзакции', description: 'Есть ли транзакции' },
      { key: 'user.isNewUser', label: 'Новый пользователь', description: 'Является ли новым' },
      { key: 'user.transactionHistory', label: 'История транзакций', description: 'Список транзакций' },
      { key: 'user.lastTransaction', label: 'Последняя транзакция', description: 'Информация о последней транзакции' }
    ]
  },
  bonuses: {
    title: 'Бонусы',
    icon: Gift,
    color: 'bg-pink-100 text-pink-800',
    variables: [
      { key: 'user.activeBonuses', label: 'Активные бонусы', description: 'Список активных бонусов' },
      { key: 'user.hasActiveBonuses', label: 'Есть активные бонусы', description: 'Есть ли активные бонусы' }
    ]
  }
};

interface VariableSelectorProps {
  onVariableSelect: (variable: string) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function VariableSelector({ onVariableSelect, trigger, className }: VariableSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('personal');

  // Фильтруем переменные по поисковому запросу
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) {
      return VARIABLE_CATEGORIES;
    }

    const query = searchQuery.toLowerCase();
    const filtered: typeof VARIABLE_CATEGORIES = {};

    Object.entries(VARIABLE_CATEGORIES).forEach(([categoryKey, category]) => {
      const matchingVariables = category.variables.filter(variable =>
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
      variant="outline" 
      size="sm" 
      className={cn(
        "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100",
        "hover:border-blue-300 hover:shadow-md transition-all duration-200",
        className
      )}
    >
      <Target className="h-4 w-4 mr-2 text-blue-600" />
      <span className="font-medium text-blue-700">Вставить переменную</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0 animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            Переменные
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 space-y-4">
          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Поиск переменных..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Категории и переменные */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted/50">
              {Object.entries(VARIABLE_CATEGORIES).map(([key, category]) => {
                const Icon = category.icon;
                const hasVariables = filteredVariables[key]?.variables.length > 0;
                const isActive = activeCategory === key;
                
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    disabled={!hasVariables}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 text-xs font-medium transition-all duration-200",
                      "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                      "data-[state=active]:border data-[state=active]:border-border",
                      "hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed",
                      "rounded-lg min-h-[50px] justify-center",
                      isActive && "bg-background shadow-sm border border-border"
                    )}
                  >
                    <Icon className={cn(
                      "h-3 w-3 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-center leading-tight text-[10px]",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {category.title}
                    </span>
                    {hasVariables && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-[9px] px-1 py-0.5 h-3",
                          isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {filteredVariables[key]?.variables.length || 0}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(filteredVariables).map(([categoryKey, category]) => (
              <TabsContent key={categoryKey} value={categoryKey} className="mt-0">
                <ScrollArea className="h-64">
                  <div className="space-y-2 pr-3">
                    {category.variables.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <Search className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">
                          Переменные не найдены
                        </h3>
                        <p className="text-xs text-gray-500 max-w-xs">
                          Попробуйте изменить поисковый запрос или выберите другую категорию
                        </p>
                      </div>
                    ) : (
                      category.variables.map((variable) => (
                      <div
                        key={variable.key}
                        className="group flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 bg-white"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0.5"
                            >
                              {variable.key}
                            </Badge>
                            <span className="font-medium text-gray-900 truncate text-sm">
                              {variable.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {variable.description}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(variable.key)}
                            title="Копировать в буфер обмена"
                            className="h-7 px-2 text-[10px] border-gray-300 hover:border-blue-400 hover:text-blue-600"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Копировать
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleVariableClick(variable.key)}
                            className="h-7 px-3 text-[10px] bg-blue-600 hover:bg-blue-700"
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
            ))}
          </Tabs>

          {/* Инструкция */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                <Target className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1 text-sm">Как использовать переменные</h4>
                <ul className="text-xs text-gray-700 space-y-0.5">
                  <li className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    Нажмите <strong>"Вставить"</strong> чтобы добавить переменную в текст
                  </li>
                  <li className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    Или нажмите <strong>"Копировать"</strong> и вставьте вручную
                  </li>
                  <li className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    Переменные автоматически заменяются реальными данными пользователя
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
  const [suggestions, setSuggestions] = useState<Array<{key: string, label: string}>>([]);
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
          .flatMap(category => category.variables)
          .filter(variable => 
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
