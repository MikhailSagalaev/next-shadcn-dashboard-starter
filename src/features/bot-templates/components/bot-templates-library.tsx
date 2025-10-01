/**
 * @file: src/features/bot-templates/components/bot-templates-library.tsx
 * @description: Библиотека шаблонов ботов с поиском и установкой
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, BotTemplatesService
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Filter,
  Star,
  Download,
  Clock,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  BookOpen,
  Heart,
  MessageSquare,
  ShoppingCart,
  Calendar,
  Target,
  BarChart3,
  GraduationCap,
  Gamepad2,
  Settings,
  Megaphone,
  UserCheck
} from 'lucide-react';

import type {
  BotTemplate,
  BotTemplateCategory
} from '@/lib/services/bot-templates/bot-templates.service';

interface TemplatesLibraryProps {
  projectId: string;
  userId: string;
  onTemplateInstalled?: (flowId: string) => void;
}

interface TemplateCardProps {
  template: BotTemplate;
  onInstall: (template: BotTemplate) => void;
  isInstalling: boolean;
}

const categoryIcons = {
  customer_support: MessageSquare,
  ecommerce: ShoppingCart,
  lead_generation: Target,
  booking: Calendar,
  survey: BarChart3,
  education: GraduationCap,
  entertainment: Gamepad2,
  utility: Settings,
  marketing: Megaphone,
  hr: UserCheck
};

const categoryLabels = {
  customer_support: 'Поддержка клиентов',
  ecommerce: 'E-commerce',
  lead_generation: 'Генерация лидов',
  booking: 'Бронирование',
  survey: 'Опросы',
  education: 'Образование',
  entertainment: 'Развлечения',
  utility: 'Утилиты',
  marketing: 'Маркетинг',
  hr: 'HR'
};

const difficultyLabels = {
  beginner: 'Начинающий',
  intermediate: 'Средний',
  advanced: 'Продвинутый'
};

const difficultyColors = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800'
};

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onInstall,
  isInstalling
}) => {
  const Icon = categoryIcons[template.category] || Settings;

  return (
    <Card className='group cursor-pointer transition-all hover:shadow-lg'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div
              className='flex h-12 w-12 items-center justify-center rounded-lg text-2xl'
              style={{
                backgroundColor: template.color + '20',
                color: template.color
              }}
            >
              {template.icon}
            </div>
            <div>
              <CardTitle className='group-hover:text-primary text-lg transition-colors'>
                {template.name}
              </CardTitle>
              <div className='mt-1 flex items-center gap-2'>
                <Badge variant='secondary' className='text-xs'>
                  <Icon className='mr-1 h-3 w-3' />
                  {categoryLabels[template.category]}
                </Badge>
                <Badge
                  className={`text-xs ${difficultyColors[template.difficulty]}`}
                >
                  {difficultyLabels[template.difficulty]}
                </Badge>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-1'>
            <Star className='h-4 w-4 fill-yellow-400 text-yellow-400' />
            <span className='text-sm font-medium'>
              {template.rating.toFixed(1)}
            </span>
            <span className='text-muted-foreground text-xs'>
              ({template.reviews})
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <p className='text-muted-foreground line-clamp-2 text-sm'>
          {template.description}
        </p>

        <div className='flex flex-wrap gap-1'>
          {template.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant='outline' className='text-xs'>
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && (
            <Badge variant='outline' className='text-xs'>
              +{template.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className='text-muted-foreground flex items-center justify-between text-sm'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-1'>
              <Download className='h-3 w-3' />
              <span>{template.installs}</span>
            </div>
            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              <span>{template.estimatedTime}м</span>
            </div>
          </div>

          <Button
            onClick={() => onInstall(template)}
            disabled={isInstalling}
            className='h-8'
          >
            {isInstalling ? (
              <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            ) : (
              <Download className='mr-1 h-3 w-3' />
            )}
            Установить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const BotTemplatesLibrary: React.FC<TemplatesLibraryProps> = ({
  projectId,
  userId,
  onTemplateInstalled
}) => {
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingTemplate, setInstallingTemplate] = useState<string | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] = useState<
    BotTemplateCategory | 'all'
  >('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    'all' | 'beginner' | 'intermediate' | 'advanced'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'popular' | 'rating' | 'newest' | 'name'
  >('popular');
  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(
    null
  );
  const [activeTab, setActiveTab] = useState('browse');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, selectedDifficulty, searchQuery, sortBy]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Используем локальный сервис шаблонов
      const { botTemplates } = await import(
        '@/lib/services/bot-templates/bot-templates.service'
      );
      const publicTemplates = botTemplates.getPublicTemplates();
      setTemplates(publicTemplates);
      setFilteredTemplates(publicTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить шаблоны',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Фильтр по категории
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Фильтр по сложности
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter((t) => t.difficulty === selectedDifficulty);
    }

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Сортировка
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.installs - a.installs);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    setFilteredTemplates(filtered);
  };

  const handleInstallTemplate = async (template: BotTemplate) => {
    setInstallingTemplate(template.id);
    try {
      const response = await fetch('/api/templates/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: template.id,
          projectId,
          userId,
          customName: `${template.name} (шаблон)`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to install template');
      }

      const result = await response.json();

      if (result.success && result.flow) {
        // Уведомляем родительский компонент
        onTemplateInstalled?.(result.flow.id);

        // Показываем успех
        console.log('Template installed successfully:', result.flow.id);
      } else {
        console.error('Failed to install template:', result.error);
      }
    } catch (error) {
      console.error('Installation error:', error);
    } finally {
      setInstallingTemplate(null);
    }
  };

  const getPopularTemplates = () => {
    return templates.sort((a, b) => b.installs - a.installs).slice(0, 6);
  };

  const getRecommendedTemplates = () => {
    // В реальной реализации здесь будет логика рекомендаций на основе истории пользователя
    return templates
      .filter((t) => t.rating >= 4.5)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6);
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='mx-auto mb-4 h-8 w-8 animate-spin' />
          <p>Загрузка шаблонов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Заголовок */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Библиотека шаблонов</h1>
          <p className='text-muted-foreground'>
            Готовые решения для автоматизации бизнеса
          </p>
        </div>
        <div className='text-right'>
          <p className='text-2xl font-bold'>{templates.length}</p>
          <p className='text-muted-foreground text-sm'>шаблонов доступно</p>
        </div>
      </div>

      {/* Вкладки */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='browse'>Все шаблоны</TabsTrigger>
          <TabsTrigger value='popular'>Популярные</TabsTrigger>
          <TabsTrigger value='recommended'>Рекомендации</TabsTrigger>
        </TabsList>

        <TabsContent value='browse' className='space-y-6'>
          {/* Фильтры и поиск */}
          <Card>
            <CardContent className='p-4'>
              <div className='flex flex-col gap-4 md:flex-row'>
                <div className='flex-1'>
                  <div className='relative'>
                    <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform' />
                    <Input
                      placeholder='Поиск шаблонов...'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className='pl-10'
                    />
                  </div>
                </div>

                <Select
                  value={selectedCategory}
                  onValueChange={(value: any) => setSelectedCategory(value)}
                >
                  <SelectTrigger className='w-48'>
                    <SelectValue placeholder='Категория' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Все категории</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedDifficulty}
                  onValueChange={(value: any) => setSelectedDifficulty(value)}
                >
                  <SelectTrigger className='w-40'>
                    <SelectValue placeholder='Сложность' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Все уровни</SelectItem>
                    <SelectItem value='beginner'>Начинающий</SelectItem>
                    <SelectItem value='intermediate'>Средний</SelectItem>
                    <SelectItem value='advanced'>Продвинутый</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sortBy}
                  onValueChange={(value: any) => setSortBy(value)}
                >
                  <SelectTrigger className='w-40'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='popular'>По популярности</SelectItem>
                    <SelectItem value='rating'>По рейтингу</SelectItem>
                    <SelectItem value='newest'>Сначала новые</SelectItem>
                    <SelectItem value='name'>По названию</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Сетка шаблонов */}
          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <BookOpen className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
                <h3 className='mb-2 text-lg font-medium'>Шаблоны не найдены</h3>
                <p className='text-muted-foreground'>
                  Попробуйте изменить критерии поиска или фильтры
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onInstall={handleInstallTemplate}
                  isInstalling={installingTemplate === template.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='popular' className='space-y-6'>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {getPopularTemplates().map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onInstall={handleInstallTemplate}
                isInstalling={installingTemplate === template.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value='recommended' className='space-y-6'>
          <Alert>
            <Heart className='h-4 w-4' />
            <AlertDescription>
              Рекомендации основаны на вашем опыте использования и популярных
              шаблонах в вашей нише.
            </AlertDescription>
          </Alert>

          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {getRecommendedTemplates().map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onInstall={handleInstallTemplate}
                isInstalling={installingTemplate === template.id}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Диалог детальной информации о шаблоне */}
      {selectedTemplate && (
        <Dialog
          open={!!selectedTemplate}
          onOpenChange={() => setSelectedTemplate(null)}
        >
          <DialogContent className='max-w-2xl'>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-3'>
                <span className='text-2xl'>{selectedTemplate.icon}</span>
                {selectedTemplate.name}
              </DialogTitle>
            </DialogHeader>

            <div className='space-y-6'>
              <div>
                <p className='text-muted-foreground mb-4'>
                  {selectedTemplate.description}
                </p>

                <div className='mb-4 flex flex-wrap gap-2'>
                  <Badge variant='secondary'>
                    {categoryLabels[selectedTemplate.category]}
                  </Badge>
                  <Badge
                    className={difficultyColors[selectedTemplate.difficulty]}
                  >
                    {difficultyLabels[selectedTemplate.difficulty]}
                  </Badge>
                  <Badge variant='outline'>
                    <Clock className='mr-1 h-3 w-3' />
                    {selectedTemplate.estimatedTime} мин
                  </Badge>
                </div>

                <div className='grid grid-cols-3 gap-4 text-center'>
                  <div>
                    <div className='text-2xl font-bold'>
                      {selectedTemplate.installs}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      установок
                    </div>
                  </div>
                  <div>
                    <div className='flex items-center justify-center gap-1 text-2xl font-bold'>
                      <Star className='h-4 w-4 fill-yellow-400 text-yellow-400' />
                      {selectedTemplate.rating.toFixed(1)}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {selectedTemplate.reviews} отзывов
                    </div>
                  </div>
                  <div>
                    <div className='text-2xl font-bold'>
                      {selectedTemplate.version}
                    </div>
                    <div className='text-muted-foreground text-xs'>версия</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className='mb-3 font-medium'>Возможности</h4>
                <div className='grid gap-2'>
                  {selectedTemplate.features.map((feature, index) => (
                    <div key={index} className='flex items-center gap-2'>
                      <CheckCircle className='h-4 w-4 text-green-500' />
                      <span className='text-sm'>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className='mb-3 font-medium'>Интеграции</h4>
                <div className='flex flex-wrap gap-2'>
                  {selectedTemplate.integrations.map((integration, index) => (
                    <Badge key={index} variant='outline'>
                      {integration}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className='mb-3 font-medium'>Сценарии использования</h4>
                <ul className='text-muted-foreground list-inside list-disc space-y-1 text-sm'>
                  {selectedTemplate.useCases.map((useCase, index) => (
                    <li key={index}>{useCase}</li>
                  ))}
                </ul>
              </div>

              <div className='flex justify-end gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setSelectedTemplate(null)}
                >
                  Закрыть
                </Button>
                <Button onClick={() => handleInstallTemplate(selectedTemplate)}>
                  Установить шаблон
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
