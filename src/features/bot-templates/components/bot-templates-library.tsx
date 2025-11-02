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
  UserCheck,
  Star,
  Trash2,
  MoreVertical
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
  onDelete?: (template: BotTemplate) => void;
  isInstalling: boolean;
  showAdminActions?: boolean;
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
  onDelete,
  isInstalling,
  showAdminActions = false
}) => {
  const Icon = categoryIcons[template.category] || Settings;

  return (
    <Card className='group transition-all hover:shadow-lg'>
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
              <CardTitle className='text-lg'>
                {template.name}
              </CardTitle>
              {showAdminActions && onDelete && (
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100'
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Удалить шаблон "${template.name}"?`)) {
                      onDelete(template);
                    }
                  }}
                >
                  <Trash2 className='h-4 w-4 text-destructive' />
                </Button>
              )}
            </div>
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [templateToInstall, setTemplateToInstall] = useState<BotTemplate | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [installedWorkflowId, setInstalledWorkflowId] = useState<string | null>(null);
  const [installedTemplateName, setInstalledTemplateName] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

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

  const handleDeleteTemplate = async (template: BotTemplate) => {
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Успех',
          description: `Шаблон "${template.name}" удален`,
          variant: 'default'
        });
        
        // Перезагружаем шаблоны
        loadTemplates();
      } else {
        toast({
          title: 'Ошибка',
          description: result.error || 'Не удалось удалить шаблон',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при удалении шаблона',
        variant: 'destructive'
      });
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
      <div className='grid grid-cols-[256px_1fr] gap-4'>
        {/* Левая панель фильтров */}
        <div className='w-64'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Фильтры</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Поиск */}
              <div>
                <label className='text-sm font-medium mb-2 block'>Поиск</label>
                <div className='relative'>
                  <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform' />
                  <Input
                    placeholder='Название, описание...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>

              {/* Категория */}
              <div>
                <label className='text-sm font-medium mb-2 block'>Категория</label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value: any) => setSelectedCategory(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Все категории' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Все категории</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <div className='flex items-center gap-2'>
                          {React.createElement(categoryIcons[key] || Settings, { className: 'h-4 w-4' })}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Сложность */}
              <div>
                <label className='text-sm font-medium mb-2 block'>Сложность</label>
                <Select
                  value={selectedDifficulty}
                  onValueChange={(value: any) => setSelectedDifficulty(value)}
                >
                  <SelectTrigger>
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
                <label className='text-sm font-medium mb-2 block'>Сортировка</label>
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => setSortBy(value)}
                >
                  <SelectTrigger>
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
              {(selectedCategory !== 'all' || selectedDifficulty !== 'all' || searchQuery) && (
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Активные фильтры</label>
                  <div className='space-y-1'>
                    {searchQuery && (
                      <Badge variant='secondary' className='gap-1'>
                        <Search className='h-3 w-3' />
                        "{searchQuery}"
                        <button
                          onClick={() => setSearchQuery('')}
                          className='ml-1 hover:text-destructive'
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    {selectedCategory !== 'all' && (
                      <Badge variant='secondary' className='gap-1'>
                        {React.createElement(categoryIcons[selectedCategory] || Settings, { className: 'h-3 w-3' })}
                        {categoryLabels[selectedCategory]}
                        <button
                          onClick={() => setSelectedCategory('all')}
                          className='ml-1 hover:text-destructive'
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
                          className='ml-1 hover:text-destructive'
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
                  onDelete={handleDeleteTemplate}
                  isInstalling={installingTemplate === template.id}
                  showAdminActions={true}
                />
              ))}
            </div>
          ) : (
            /* Пустое состояние */
            <Card className='w-full'>
              <CardContent className='flex flex-col items-center justify-center py-12'>
                <Search className='mb-4 h-12 w-12 text-muted-foreground' />
                <h3 className='mb-2 text-lg font-semibold'>Шаблоны не найдены</h3>
                <p className='text-center text-muted-foreground'>
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
                      {(selectedTemplate.rating || 0).toFixed(1)}
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
                <Button onClick={() => openInstallDialog(selectedTemplate)}>
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
              <p className='text-sm text-muted-foreground mb-4'>
                Вы устанавливаете шаблон <strong>{templateToInstall?.name}</strong>
              </p>
              
              <label className='text-sm font-medium mb-2 block'>
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
                Шаблон будет создан как новый workflow в выбранном проекте. 
                Вы сможете настроить его в конструкторе workflow.
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
                disabled={!selectedProjectId || installingTemplate === templateToInstall?.id}
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
            <p className='text-center text-sm text-muted-foreground'>
              Шаблон <span className='font-semibold text-foreground'>"{installedTemplateName || 'шаблон'}"</span> успешно установлен в проект. 
              Теперь вы можете настроить workflow в конструкторе.
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
                  router.push(`/dashboard/projects/${selectedProjectId}/workflow?workflowId=${installedWorkflowId}`);
                } else if (selectedProjectId) {
                  router.push(`/dashboard/projects/${selectedProjectId}/workflow`);
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
