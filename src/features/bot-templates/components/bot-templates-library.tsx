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
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
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
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
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
  UserCheck,
  Star
} from 'lucide-react';

import type {
  BotTemplate,
  BotTemplateCategory
} from '@/lib/services/bot-templates/bot-templates.service';

interface TemplatesLibraryProps {
  projectId?: string; // Опциональный для просмотра библиотеки
  userId: string;
}

interface TemplateCardProps {
  template: BotTemplate;
  onInstall: (template: BotTemplate) => void;
  onViewDetails: (template: BotTemplate) => void;
  onLike: (template: BotTemplate) => void;
  isInstalling: boolean;
  isLiked?: boolean;
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
  onViewDetails,
  onLike,
  isInstalling,
  isLiked = false
}) => {
  const Icon = categoryIcons[template.category] || Settings;

  return (
    <Card
      className='group cursor-pointer transition-all hover:shadow-lg'
      onClick={() => onViewDetails(template)}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start gap-3'>
          <div
            className='flex h-12 w-12 items-center justify-center rounded-lg text-2xl'
            style={{
              backgroundColor: template.color + '20',
              color: template.color
            }}
          >
            {template.icon}
          </div>
          <div className='flex-1'>
            <div className='flex items-start justify-between'>
              <CardTitle className='text-lg'>{template.name}</CardTitle>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(template);
                }}
              >
                <Heart
                  className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                />
              </Button>
            </div>
            <div className='mt-1 flex items-center gap-2'>
              <Badge variant='secondary' className='text-xs'>
                {difficultyLabels[template.difficulty]}
              </Badge>
            </div>
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
            <div className='flex items-center gap-1' title='Установок'>
              <Download className='h-3 w-3' />
              <span>{template.installs}</span>
            </div>
            <div className='flex items-center gap-1' title='Время настройки'>
              <Clock className='h-3 w-3' />
              <span>{template.estimatedTime}м</span>
            </div>
          </div>

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onInstall(template);
            }}
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

interface Project {
  id: string;
  name: string;
}

export const BotTemplatesLibrary: React.FC<TemplatesLibraryProps> = ({
  projectId: initialProjectId,
  userId
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId || null
  );
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [templateToInstall, setTemplateToInstall] =
    useState<BotTemplate | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [installedWorkflowId, setInstalledWorkflowId] = useState<string | null>(
    null
  );
  const [installedTemplateName, setInstalledTemplateName] = useState<
    string | null
  >(null);
  const [likedTemplates, setLikedTemplates] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { toast } = useToast();

  // Загрузка лайков из localStorage
  useEffect(() => {
    const savedLikes = localStorage.getItem('likedTemplates');
    if (savedLikes) {
      setLikedTemplates(new Set(JSON.parse(savedLikes)));
    }
  }, []);

  const handleLikeTemplate = (template: BotTemplate) => {
    setLikedTemplates((prev) => {
      const newLikes = new Set(prev);
      if (newLikes.has(template.id)) {
        newLikes.delete(template.id);
      } else {
        newLikes.add(template.id);
      }
      localStorage.setItem('likedTemplates', JSON.stringify([...newLikes]));
      return newLikes;
    });
  };

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to load projects');

      const data = await response.json();
      setProjects(data.projects || []);

      // Если нет выбранного проекта и есть проекты, выбираем первый
      if (!selectedProjectId && data.projects && data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить список проектов',
        variant: 'destructive'
      });
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Используем API endpoint вместо прямого импорта сервиса
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      const publicTemplates = data.templates || [];
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

  useEffect(() => {
    loadProjects();
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, selectedDifficulty, searchQuery, sortBy]);

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

  const openInstallDialog = (template: BotTemplate) => {
    setTemplateToInstall(template);
    setShowInstallDialog(true);
    // Если проект не выбран, оставляем selectedProjectId как есть (может быть null)
  };

  const handleInstallTemplate = async () => {
    if (!selectedProjectId || !templateToInstall) {
      toast({
        title: 'Ошибка',
        description: 'Необходимо выбрать проект',
        variant: 'destructive'
      });
      return;
    }

    setInstallingTemplate(templateToInstall.id);
    try {
      const response = await fetch('/api/templates/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: templateToInstall.id,
          projectId: selectedProjectId,
          userId,
          customName: `${templateToInstall.name} (шаблон)`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to install template');
      }

      const result = await response.json();

      if (result.success && result.workflowId) {
        setInstalledWorkflowId(result.workflowId);
        setInstalledTemplateName(templateToInstall?.name || null);
        setShowInstallDialog(false);
        setTemplateToInstall(null);
        setShowSuccessDialog(true);
      } else {
        console.error('Failed to install template:', result.error);

        toast({
          title: 'Ошибка',
          description: result.error || 'Не удалось установить шаблон',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Installation error:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при установке шаблона',
        variant: 'destructive'
      });
    } finally {
      setInstallingTemplate(null);
    }
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
          <h1 className='text-2xl font-bold'>Библиотека шаблонов</h1>
          <p className='text-muted-foreground'>
            Готовые workflow для быстрого создания ботов
          </p>
        </div>
        <div className='text-right'>
          <p className='text-2xl font-bold'>{templates.length}</p>
          <p className='text-muted-foreground text-sm'>шаблонов доступно</p>
        </div>
      </div>

      {/* Фильтры и поиск */}
      <div className='grid grid-cols-[240px_1fr] gap-6'>
        {/* Левая панель фильтров */}
        <div className='w-60'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Фильтры</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Поиск */}
              <div>
                <label className='mb-2 block text-sm font-medium'>Поиск</label>
                <div className='relative'>
                  <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform' />
                  <Input
                    placeholder='Название, описание...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full pl-10'
                  />
                </div>
              </div>

              {/* Категория */}
              <div>
                <label className='mb-2 block text-sm font-medium'>
                  Категория
                </label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value: any) => setSelectedCategory(value)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Все категории' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Все категории</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <div className='flex items-center gap-2'>
                          {React.createElement(categoryIcons[key] || Settings, {
                            className: 'h-4 w-4'
                          })}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Сложность */}
              <div>
                <label className='mb-2 block text-sm font-medium'>
                  Сложность
                </label>
                <Select
                  value={selectedDifficulty}
                  onValueChange={(value: any) => setSelectedDifficulty(value)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Любая сложность' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Любая сложность</SelectItem>
                    <SelectItem value='beginner'>Начинающий</SelectItem>
                    <SelectItem value='intermediate'>Средний</SelectItem>
                    <SelectItem value='advanced'>Продвинутый</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Сортировка */}
              <div>
                <label className='mb-2 block text-sm font-medium'>
                  Сортировка
                </label>
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => setSortBy(value)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Сортировка' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='popular'>Популярные</SelectItem>
                    <SelectItem value='rating'>По рейтингу</SelectItem>
                    <SelectItem value='newest'>Новые</SelectItem>
                    <SelectItem value='name'>По названию</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Активные фильтры */}
              {(selectedCategory !== 'all' ||
                selectedDifficulty !== 'all' ||
                searchQuery) && (
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    Активные фильтры
                  </label>
                  <div className='space-y-1'>
                    {searchQuery && (
                      <Badge variant='secondary' className='gap-1'>
                        <Search className='h-3 w-3' />"{searchQuery}"
                        <button
                          onClick={() => setSearchQuery('')}
                          className='hover:text-destructive ml-1'
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    {selectedCategory !== 'all' && (
                      <Badge variant='secondary' className='gap-1'>
                        {React.createElement(
                          categoryIcons[selectedCategory] || Settings,
                          { className: 'h-3 w-3' }
                        )}
                        {categoryLabels[selectedCategory]}
                        <button
                          onClick={() => setSelectedCategory('all')}
                          className='hover:text-destructive ml-1'
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    {selectedDifficulty !== 'all' && (
                      <Badge variant='secondary' className='gap-1'>
                        {difficultyLabels[selectedDifficulty]}
                        <button
                          onClick={() => setSelectedDifficulty('all')}
                          className='hover:text-destructive ml-1'
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                        setSelectedDifficulty('all');
                      }}
                      className='text-xs'
                    >
                      Очистить все
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Основной контент */}
        <div className='min-w-0'>
          {/* Сетка шаблонов */}
          {filteredTemplates.length > 0 ? (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onInstall={openInstallDialog}
                  onViewDetails={setSelectedTemplate}
                  onLike={handleLikeTemplate}
                  isInstalling={installingTemplate === template.id}
                  isLiked={likedTemplates.has(template.id)}
                />
              ))}
            </div>
          ) : (
            /* Пустое состояние */
            <Card className='w-full'>
              <CardContent className='flex flex-col items-center justify-center py-12'>
                <Search className='text-muted-foreground mb-4 h-12 w-12' />
                <h3 className='mb-2 text-lg font-semibold'>
                  Шаблоны не найдены
                </h3>
                <p className='text-muted-foreground text-center'>
                  Попробуйте изменить фильтры или поисковый запрос
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Диалог детальной информации о шаблоне */}
      {selectedTemplate && (
        <Dialog
          open={!!selectedTemplate}
          onOpenChange={() => setSelectedTemplate(null)}
        >
          <DialogContent className='max-h-[90vh] max-w-3xl overflow-y-auto'>
            <DialogHeader>
              <div className='flex items-start justify-between'>
                <div className='flex items-center gap-4'>
                  <div
                    className='flex h-16 w-16 items-center justify-center rounded-xl text-3xl'
                    style={{
                      backgroundColor: selectedTemplate.color + '20',
                      color: selectedTemplate.color
                    }}
                  >
                    {selectedTemplate.icon}
                  </div>
                  <div>
                    <DialogTitle className='text-2xl'>
                      {selectedTemplate.name}
                    </DialogTitle>
                    <div className='mt-2 flex flex-wrap gap-2'>
                      <Badge variant='secondary'>
                        {React.createElement(
                          categoryIcons[selectedTemplate.category] || Settings,
                          { className: 'mr-1 h-3 w-3' }
                        )}
                        {categoryLabels[selectedTemplate.category]}
                      </Badge>
                      <Badge
                        className={
                          difficultyColors[selectedTemplate.difficulty]
                        }
                      >
                        {difficultyLabels[selectedTemplate.difficulty]}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleLikeTemplate(selectedTemplate)}
                >
                  <Heart
                    className={`h-5 w-5 ${likedTemplates.has(selectedTemplate.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                  />
                </Button>
              </div>
            </DialogHeader>

            <div className='mt-4 space-y-6'>
              {/* Описание */}
              <div>
                <h4 className='text-muted-foreground mb-2 text-sm font-medium tracking-wide uppercase'>
                  Описание
                </h4>
                <p className='text-foreground'>
                  {selectedTemplate.description}
                </p>
              </div>

              {/* Статистика */}
              <div className='bg-muted/50 grid grid-cols-4 gap-4 rounded-lg p-4'>
                <div className='text-center'>
                  <div className='flex items-center justify-center gap-1 text-2xl font-bold'>
                    <Download className='text-muted-foreground h-5 w-5' />
                    {selectedTemplate.installs}
                  </div>
                  <div className='text-muted-foreground text-xs'>установок</div>
                </div>
                <div className='text-center'>
                  <div className='flex items-center justify-center gap-1 text-2xl font-bold'>
                    <Star className='h-5 w-5 fill-yellow-400 text-yellow-400' />
                    {(selectedTemplate.rating || 0).toFixed(1)}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {selectedTemplate.reviews} отзывов
                  </div>
                </div>
                <div className='text-center'>
                  <div className='flex items-center justify-center gap-1 text-2xl font-bold'>
                    <Clock className='text-muted-foreground h-5 w-5' />
                    {selectedTemplate.estimatedTime}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    мин настройки
                  </div>
                </div>
                <div className='text-center'>
                  <div className='text-2xl font-bold'>
                    v{selectedTemplate.version}
                  </div>
                  <div className='text-muted-foreground text-xs'>версия</div>
                </div>
              </div>

              {/* Теги */}
              <div>
                <h4 className='text-muted-foreground mb-2 text-sm font-medium tracking-wide uppercase'>
                  Теги
                </h4>
                <div className='flex flex-wrap gap-2'>
                  {selectedTemplate.tags.map((tag) => (
                    <Badge key={tag} variant='outline'>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Возможности */}
              <div>
                <h4 className='text-muted-foreground mb-3 text-sm font-medium tracking-wide uppercase'>
                  Возможности
                </h4>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {selectedTemplate.features.map((feature, index) => (
                    <div key={index} className='flex items-start gap-2'>
                      <CheckCircle className='mt-0.5 h-4 w-4 shrink-0 text-green-500' />
                      <span className='text-sm'>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Интеграции */}
              {selectedTemplate.integrations.length > 0 && (
                <div>
                  <h4 className='text-muted-foreground mb-3 text-sm font-medium tracking-wide uppercase'>
                    Интеграции
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {selectedTemplate.integrations.map((integration, index) => (
                      <Badge key={index} variant='secondary'>
                        {integration}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Сценарии использования */}
              {selectedTemplate.useCases.length > 0 && (
                <div>
                  <h4 className='text-muted-foreground mb-3 text-sm font-medium tracking-wide uppercase'>
                    Сценарии использования
                  </h4>
                  <ul className='space-y-2'>
                    {selectedTemplate.useCases.map((useCase, index) => (
                      <li
                        key={index}
                        className='flex items-start gap-2 text-sm'
                      >
                        <Target className='text-primary mt-0.5 h-4 w-4 shrink-0' />
                        {useCase}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              <div className='flex justify-end gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setSelectedTemplate(null)}
                >
                  Закрыть
                </Button>
                <Button
                  onClick={() => {
                    openInstallDialog(selectedTemplate);
                    setSelectedTemplate(null);
                  }}
                >
                  <Download className='mr-2 h-4 w-4' />
                  Установить шаблон
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Модальное окно установки */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Установка шаблона</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <p className='text-muted-foreground mb-4 text-sm'>
                Вы устанавливаете шаблон{' '}
                <strong>{templateToInstall?.name}</strong>
              </p>

              <label className='mb-2 block text-sm font-medium'>
                Выберите проект для установки:
              </label>
              <Select
                value={selectedProjectId || ''}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Выберите проект' />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                Шаблон будет создан как новый workflow в выбранном проекте. Вы
                сможете настроить его в конструкторе workflow.
              </AlertDescription>
            </Alert>

            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setShowInstallDialog(false);
                  setTemplateToInstall(null);
                }}
              >
                Отмена
              </Button>
              <Button
                onClick={handleInstallTemplate}
                disabled={
                  !selectedProjectId ||
                  installingTemplate === templateToInstall?.id
                }
              >
                {installingTemplate === templateToInstall?.id ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Установка...
                  </>
                ) : (
                  'Установить'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Модальное окно успешной установки */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20'>
              <CheckCircle className='h-6 w-6 text-green-600 dark:text-green-400' />
            </div>
            <DialogTitle className='text-center text-xl'>
              Шаблон успешно установлен
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <p className='text-muted-foreground text-center text-sm'>
              Шаблон{' '}
              <span className='text-foreground font-semibold'>
                "{installedTemplateName || 'шаблон'}"
              </span>{' '}
              успешно установлен в проект. Теперь вы можете настроить workflow в
              конструкторе.
            </p>
          </div>
          <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
            <Button
              variant='outline'
              onClick={() => setShowSuccessDialog(false)}
              className='sm:w-auto'
            >
              Закрыть
            </Button>
            <Button
              onClick={() => {
                if (selectedProjectId && installedWorkflowId) {
                  router.push(
                    `/dashboard/projects/${selectedProjectId}/workflow?workflowId=${installedWorkflowId}`
                  );
                } else if (selectedProjectId) {
                  router.push(
                    `/dashboard/projects/${selectedProjectId}/workflow`
                  );
                }
                setShowSuccessDialog(false);
                setInstalledTemplateName(null);
              }}
              className='sm:w-auto'
            >
              Перейти в конструктор
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
