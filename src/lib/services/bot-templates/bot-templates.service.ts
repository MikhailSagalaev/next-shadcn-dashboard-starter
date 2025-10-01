/**
 * @file: src/lib/services/bot-templates/bot-templates.service.ts
 * @description: Сервис управления шаблонами ботов
 * @project: SaaS Bonus System
 * @dependencies: BotFlowService
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { BotFlowService } from '../bot-flow.service';

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: BotTemplateCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  estimatedTime: number; // в минутах
  icon: string;
  color: string;

  // Конфигурация потока
  flowConfig: {
    name: string;
    description: string;
    nodes: any[];
    connections: any[];
    variables: Record<string, any>;
    settings: Record<string, any>;
  };

  // Дополнительная информация
  features: string[];
  integrations: string[];
  useCases: string[];

  // Статистика
  installs: number;
  rating: number;
  reviews: number;

  // Автор и версия
  author: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;

  // Поля библиотеки шаблонов
  isPublic: boolean; // доступен в библиотеке шаблонов
}

export type BotTemplateCategory =
  | 'customer_support'
  | 'ecommerce'
  | 'lead_generation'
  | 'booking'
  | 'survey'
  | 'education'
  | 'entertainment'
  | 'utility'
  | 'marketing'
  | 'hr';

export interface TemplateFilter {
  category?: BotTemplateCategory;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  search?: string;
  sortBy?: 'popular' | 'rating' | 'newest' | 'name';
  limit?: number;
  offset?: number;
}

export interface TemplateInstallation {
  templateId: string;
  projectId: string;
  userId: string;
  installedAt: Date;
  flowId: string; // ID созданного потока
  customizations: Record<string, any>;
}

class BotTemplatesService {
  private templates: BotTemplate[] = [];
  private installations: TemplateInstallation[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Получить все шаблоны с фильтрами
   */
  async getTemplates(filter: TemplateFilter = {}): Promise<{
    templates: BotTemplate[];
    total: number;
    hasMore: boolean;
  }> {
    let filteredTemplates = [...this.templates];

    // Фильтр по категории
    if (filter.category) {
      filteredTemplates = filteredTemplates.filter(
        (t) => t.category === filter.category
      );
    }

    // Фильтр по сложности
    if (filter.difficulty) {
      filteredTemplates = filteredTemplates.filter(
        (t) => t.difficulty === filter.difficulty
      );
    }

    // Фильтр по тегам
    if (filter.tags && filter.tags.length > 0) {
      filteredTemplates = filteredTemplates.filter((t) =>
        filter.tags!.some((tag) => t.tags.includes(tag))
      );
    }

    // Поиск по названию и описанию
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filteredTemplates = filteredTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Сортировка
    switch (filter.sortBy) {
      case 'popular':
        filteredTemplates.sort((a, b) => b.installs - a.installs);
        break;
      case 'rating':
        filteredTemplates.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filteredTemplates.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        break;
      case 'name':
      default:
        filteredTemplates.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Пагинация
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;
    const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

    return {
      templates: paginatedTemplates,
      total: filteredTemplates.length,
      hasMore: offset + limit < filteredTemplates.length
    };
  }

  /**
   * Получить шаблон по ID
   */
  async getTemplateById(templateId: string): Promise<BotTemplate | null> {
    return this.templates.find((t) => t.id === templateId) || null;
  }

  /**
   * Получить шаблоны по категории
   */
  async getTemplatesByCategory(
    category: BotTemplateCategory
  ): Promise<BotTemplate[]> {
    return this.templates.filter((t) => t.category === category);
  }

  /**
   * Установить шаблон в проект
   */
  async installTemplate(
    templateId: string,
    projectId: string,
    userId: string,
    customizations: Record<string, any> = {}
  ): Promise<{ success: boolean; flowId?: string; error?: string }> {
    try {
      const template = await this.getTemplateById(templateId);
      if (!template) {
        return { success: false, error: 'Шаблон не найден' };
      }

      // Создаем поток на основе шаблона
      const flowData = {
        ...template.flowConfig,
        projectId,
        isActive: false, // По умолчанию неактивен, чтобы пользователь мог настроить
        version: 1
      };

      // Применяем кастомизации
      if (customizations.variables) {
        flowData.variables = {
          ...flowData.variables,
          ...customizations.variables
        };
      }

      if (customizations.settings) {
        flowData.settings = {
          ...flowData.settings,
          ...customizations.settings
        };
      }

      // Создаем поток
      const flow = await BotFlowService.createFlow(flowData);

      // Записываем установку
      const installation: TemplateInstallation = {
        templateId,
        projectId,
        userId,
        installedAt: new Date(),
        flowId: flow.id,
        customizations
      };

      this.installations.push(installation);

      // Увеличиваем счетчик установок
      template.installs++;

      logger.info('Template installed successfully', {
        templateId,
        projectId,
        userId,
        flowId: flow.id
      });

      return { success: true, flowId: flow.id };
    } catch (error) {
      logger.error('Failed to install template', {
        templateId,
        projectId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось установить шаблон'
      };
    }
  }

  /**
   * Получить установленные шаблоны для проекта
   */
  async getInstalledTemplates(projectId: string): Promise<
    Array<{
      installation: TemplateInstallation;
      template: BotTemplate;
      flow: any; // Flow data
    }>
  > {
    const projectInstallations = this.installations.filter(
      (i) => i.projectId === projectId
    );

    const result = [];

    for (const installation of projectInstallations) {
      const template = await this.getTemplateById(installation.templateId);
      if (!template) continue;

      try {
        const flow = await BotFlowService.getFlowById(installation.flowId);
        if (flow) {
          result.push({
            installation,
            template,
            flow
          });
        }
      } catch (error) {
        logger.warn('Flow not found for installation', {
          installationId: installation.flowId,
          templateId: installation.templateId
        });
      }
    }

    return result;
  }

  /**
   * Обновить рейтинг шаблона
   */
  async updateTemplateRating(
    templateId: string,
    rating: number,
    review?: string
  ): Promise<boolean> {
    const template = this.templates.find((t) => t.id === templateId);
    if (!template) return false;

    // Простая логика обновления рейтинга (в реальности нужна более сложная формула)
    const currentTotal = template.rating * template.reviews;
    template.reviews++;
    template.rating = (currentTotal + rating) / template.reviews;

    logger.info('Template rating updated', {
      templateId,
      newRating: template.rating,
      reviews: template.reviews
    });

    return true;
  }

  /**
   * Получить популярные шаблоны
   */
  async getPopularTemplates(limit: number = 10): Promise<BotTemplate[]> {
    return [...this.templates]
      .sort((a, b) => b.installs - a.installs)
      .slice(0, limit);
  }

  /**
   * Получить рекомендованные шаблоны
   */
  async getRecommendedTemplates(
    userId: string,
    limit: number = 5
  ): Promise<BotTemplate[]> {
    // Получаем историю установок пользователя
    const userInstallations = this.installations.filter(
      (i) => i.userId === userId
    );
    const userCategories = new Set(
      userInstallations
        .map((i) => {
          const template = this.templates.find((t) => t.id === i.templateId);
          return template?.category;
        })
        .filter(Boolean)
    );

    // Рекомендуем шаблоны из тех же категорий, которые пользователь еще не устанавливал
    const recommended = this.templates.filter(
      (template) =>
        userCategories.has(template.category) &&
        !userInstallations.some((i) => i.templateId === template.id)
    );

    return recommended.sort((a, b) => b.rating - a.rating).slice(0, limit);
  }

  /**
   * Поиск шаблонов
   */
  async searchTemplates(
    query: string,
    limit: number = 20
  ): Promise<BotTemplate[]> {
    const searchLower = query.toLowerCase();

    return this.templates
      .filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.description.toLowerCase().includes(searchLower) ||
          template.tags.some((tag) =>
            tag.toLowerCase().includes(searchLower)
          ) ||
          template.category.toLowerCase().includes(searchLower)
      )
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  /**
   * Экспорт шаблона
   */
  async exportTemplate(templateId: string): Promise<string | null> {
    const template = await this.getTemplateById(templateId);
    if (!template) return null;

    // Экспортируем только конфигурацию потока, без статистики
    const exportData = {
      ...template.flowConfig,
      exportedAt: new Date().toISOString(),
      templateVersion: template.version,
      templateId: template.id
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Импорт шаблона
   */
  async importTemplate(
    templateData: string,
    author: string
  ): Promise<BotTemplate | null> {
    try {
      const data = JSON.parse(templateData);

      // Валидация данных
      if (!data.name || !data.nodes || !data.connections) {
        throw new Error('Invalid template data');
      }

      const template: BotTemplate = {
        id: `custom_${Date.now()}`,
        name: data.name,
        description: data.description || 'Импортированный шаблон',
        category: data.category || 'utility',
        difficulty: data.difficulty || 'intermediate',
        tags: data.tags || [],
        estimatedTime: data.estimatedTime || 30,
        icon: data.icon || '🤖',
        color: data.color || '#3b82f6',

        flowConfig: {
          name: data.name,
          description: data.description,
          nodes: data.nodes,
          connections: data.connections,
          variables: data.variables || {},
          settings: data.settings || {}
        },

        features: data.features || [],
        integrations: data.integrations || [],
        useCases: data.useCases || [],

        installs: 0,
        rating: 0,
        reviews: 0,

        author,
        version: data.templateVersion || '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.templates.push(template);

      logger.info('Template imported successfully', {
        templateId: template.id,
        author,
        name: template.name
      });

      return template;
    } catch (error) {
      logger.error('Failed to import template', {
        error: error instanceof Error ? error.message : String(error)
      });

      return null;
    }
  }

  // ============ ИНИЦИАЛИЗАЦИЯ ШАБЛОНОВ ============

  private initializeTemplates(): void {
    this.templates = [
      // Customer Support Templates
      {
        id: 'support_ticket_bot',
        name: 'Бот поддержки с тикетами',
        description:
          'Автоматизированная обработка обращений в поддержку с созданием тикетов',
        category: 'customer_support',
        difficulty: 'intermediate',
        tags: ['support', 'tickets', 'automation', 'crm'],
        estimatedTime: 45,
        icon: '🎫',
        color: '#ef4444',

        flowConfig: {
          name: 'Support Ticket Bot',
          description: 'Handles customer support requests and creates tickets',
          nodes: [
            {
              id: 'start',
              type: 'start',
              position: { x: 100, y: 100 },
              data: { label: 'Start' }
            },
            {
              id: 'welcome',
              type: 'message',
              position: { x: 300, y: 100 },
              data: {
                label: 'Welcome Message',
                config: {
                  message: {
                    text: '👋 Здравствуйте! Я помогу вам с вопросами поддержки.\\n\\nРасскажите, пожалуйста, о вашей проблеме.',
                    parseMode: 'Markdown'
                  }
                }
              }
            },
            {
              id: 'collect_issue',
              type: 'input',
              position: { x: 500, y: 100 },
              data: {
                label: 'Collect Issue',
                config: {
                  input: {
                    prompt: 'Опишите вашу проблему подробно:',
                    timeout: 300,
                    validation: { type: 'text', minLength: 10 }
                  }
                }
              }
            }
          ],
          connections: [
            {
              id: 'start-welcome',
              sourceNodeId: 'start',
              targetNodeId: 'welcome'
            },
            {
              id: 'welcome-collect',
              sourceNodeId: 'welcome',
              targetNodeId: 'collect_issue'
            }
          ],
          variables: {
            userIssue: '',
            ticketId: '',
            priority: 'normal'
          },
          settings: {
            autoCreateTicket: true,
            notifyAdmins: true,
            categories: ['technical', 'billing', 'general']
          }
        },

        features: [
          'Автоматическое создание тикетов',
          'Классификация проблем',
          'Уведомления администраторам',
          'Приоритизация обращений'
        ],
        integrations: ['CRM', 'Email', 'Slack'],
        useCases: [
          'Техническая поддержка',
          'Обработка жалоб',
          'Консультации клиентов'
        ],

        installs: 245,
        rating: 4.7,
        reviews: 89,

        author: 'SaaS Bonus System',
        version: '2.1.0',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-09-20'),

        // Поле библиотеки шаблонов
        isPublic: true
      },

      // E-commerce Templates
      {
        id: 'order_status_bot',
        name: 'Бот статуса заказов',
        description: 'Проверка статуса заказов по номеру телефона или email',
        category: 'ecommerce',
        difficulty: 'beginner',
        tags: ['orders', 'status', 'tracking', 'ecommerce'],
        estimatedTime: 30,
        icon: '📦',
        color: '#10b981',

        flowConfig: {
          name: 'Order Status Bot',
          description: 'Check order status by phone or email',
          nodes: [],
          connections: [],
          variables: {},
          settings: {}
        },

        features: [
          'Проверка статуса заказов',
          'Отправка уведомлений',
          'Интеграция с CRM'
        ],
        integrations: ['E-commerce API', 'CRM'],
        useCases: [
          'Отслеживание заказов',
          'Уведомления о доставке',
          'Обработка возвратов'
        ],

        installs: 189,
        rating: 4.5,
        reviews: 67,

        author: 'SaaS Bonus System',
        version: '1.8.0',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-08-15'),

        // Поле библиотеки шаблонов
        isPublic: true
      },

      // Lead Generation Templates
      {
        id: 'lead_qualification_bot',
        name: 'Бот квалификации лидов',
        description:
          'Автоматическая квалификация потенциальных клиентов через диалог',
        category: 'lead_generation',
        difficulty: 'advanced',
        tags: ['leads', 'qualification', 'crm', 'sales'],
        estimatedTime: 60,
        icon: '🎯',
        color: '#f59e0b',

        flowConfig: {
          name: 'Lead Qualification Bot',
          description: 'Qualifies leads through conversation',
          nodes: [],
          connections: [],
          variables: {},
          settings: {}
        },

        features: [
          'Оценка заинтересованности',
          'Сбор контактных данных',
          'Классификация по категориям',
          'Передача в CRM'
        ],
        integrations: ['CRM', 'Email', 'Analytics'],
        useCases: [
          'Генерация лидов',
          'Квалификация клиентов',
          'Автоматизация продаж'
        ],

        installs: 156,
        rating: 4.8,
        reviews: 94,

        author: 'SaaS Bonus System',
        version: '2.0.0',
        createdAt: new Date('2024-03-10'),
        updatedAt: new Date('2024-09-25'),

        // Поле библиотеки шаблонов
        isPublic: true
      },

      // Booking Templates
      {
        id: 'appointment_booking_bot',
        name: 'Бот записи на прием',
        description: 'Онлайн запись на услуги с проверкой доступности',
        category: 'booking',
        difficulty: 'intermediate',
        tags: ['booking', 'appointments', 'calendar', 'scheduling'],
        estimatedTime: 50,
        icon: '📅',
        color: '#8b5cf6',

        flowConfig: {
          name: 'Appointment Booking Bot',
          description: 'Book appointments with availability check',
          nodes: [],
          connections: [],
          variables: {},
          settings: {}
        },

        features: [
          'Проверка доступности',
          'Подтверждение записи',
          'Напоминания',
          'Отмена и перенос'
        ],
        integrations: ['Calendar API', 'Email', 'SMS'],
        useCases: ['Медицинские услуги', 'Салон красоты', 'Консультации'],

        installs: 134,
        rating: 4.6,
        reviews: 78,

        author: 'SaaS Bonus System',
        version: '1.9.0',
        createdAt: new Date('2024-04-05'),
        updatedAt: new Date('2024-09-10'),

        // Поле библиотеки шаблонов
        isPublic: true
      },

      // Survey Templates
      {
        id: 'customer_satisfaction_survey',
        name: 'Опрос удовлетворенности',
        description: 'Сбор отзывов клиентов после обслуживания',
        category: 'survey',
        difficulty: 'beginner',
        tags: ['survey', 'feedback', 'nps', 'satisfaction'],
        estimatedTime: 25,
        icon: '📊',
        color: '#06b6d4',

        flowConfig: {
          name: 'Customer Satisfaction Survey',
          description: 'Collect customer feedback and satisfaction ratings',
          nodes: [],
          connections: [],
          variables: {},
          settings: {}
        },

        features: [
          'NPS оценка',
          'Открытые вопросы',
          'Анализ ответов',
          'Автоматические отчеты'
        ],
        integrations: ['Analytics', 'CRM'],
        useCases: [
          'Оценка качества обслуживания',
          'Сбор отзывов',
          'Исследование рынка'
        ],

        installs: 98,
        rating: 4.4,
        reviews: 45,

        author: 'SaaS Bonus System',
        version: '1.7.0',
        createdAt: new Date('2024-05-12'),
        updatedAt: new Date('2024-08-30'),

        // Поле библиотеки шаблонов
        isPublic: true
      }
    ];

    logger.info('Bot templates initialized', { count: this.templates.length });
  }

  // Получение публичных шаблонов для библиотеки
  getPublicTemplates(): BotTemplate[] {
    return this.templates.filter((t) => t.isPublic);
  }
}

// Экспорт синглтона
export const botTemplates = new BotTemplatesService();
