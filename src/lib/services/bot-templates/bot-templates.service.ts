/**
 * @file: src/lib/services/bot-templates/bot-templates.service.ts
 * @description: Сервис управления шаблонами ботов
 * @project: SaaS Bonus System
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { shopTemplate } from './templates/shop.template';
import { feedbackTemplate } from './templates/feedback.template';
import { webinarTemplate } from './templates/webinar.template';
import { supportTemplate } from './templates/support.template';
import { gamificationTemplate } from './templates/gamification.template';
import loyaltySystemWorkflow from '@/lib/workflow-templates/loyalty-system.json';

// Временный импорт для обратной совместимости, в идеале его тоже нужно вынести
const loyaltySystemTemplate: BotTemplate = {
  id: 'loyalty_system_fixed',
  name: 'Система лояльности',
  description:
    'Умная система лояльности с проверкой статуса пользователей и флоу регистрации на сайте. Приветственные бонусы начисляются автоматически при активации.',
  category: 'loyalty',
  difficulty: 'intermediate',
  tags: [
    'loyalty',
    'bonuses',
    'registration',
    'contact',
    'welcome-bonus',
    'automatic'
  ],
  estimatedTime: 30,
  icon: '🎁',
  color: '#10b981',

  workflowConfig: {
    name: loyaltySystemWorkflow.name,
    description: loyaltySystemWorkflow.description,
    nodes: loyaltySystemWorkflow.nodes,
    connections: loyaltySystemWorkflow.connections,
    variables: loyaltySystemWorkflow.variables,
    settings: loyaltySystemWorkflow.settings
  },

  features: ['Бонусная карта', 'Реферальная система'],
  integrations: [],
  useCases: [],
  installs: 154,
  rating: 4.9,
  reviews: 42,
  author: 'Gupil Team',
  version: '1.2.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: true
};

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

  // Конфигурация workflow
  workflowConfig: {
    name: string;
    description: string;
    nodes: any[];
    connections: any[];
    variables: any[];
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
  | 'hr'
  | 'loyalty';

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
  workflowId: string; // ID созданного workflow
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
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const template = await this.getTemplateById(templateId);
      if (!template) {
        return { success: false, error: 'Шаблон не найден' };
      }

      // Создаем workflow на основе шаблона
      const workflowData = {
        ...template.workflowConfig,
        projectId,
        isActive: false // По умолчанию неактивен, чтобы пользователь мог настроить
      };

      // Применяем кастомизации
      if (customizations.variables) {
        workflowData.variables = [
          ...workflowData.variables,
          ...customizations.variables
        ];
      }

      if (customizations.settings) {
        workflowData.settings = {
          ...workflowData.settings,
          ...customizations.settings
        };
      }

      // Создаем workflow через API
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006';

      logger.info('Creating workflow via API', {
        url: `${baseUrl}/api/projects/${projectId}/workflows`,
        workflowData: JSON.stringify(workflowData, null, 2)
      });

      const response = await fetch(
        `${baseUrl}/api/projects/${projectId}/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflowData)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to create workflow', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(
          `Failed to create workflow: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      const workflow = result.workflow;

      // Записываем установку
      const installation: TemplateInstallation = {
        templateId,
        projectId,
        userId,
        installedAt: new Date(),
        workflowId: workflow.id,
        customizations
      };

      this.installations.push(installation);

      // Увеличиваем счетчик установок
      template.installs++;

      logger.info('Template installed successfully', {
        templateId,
        projectId,
        userId,
        workflowId: workflow.id
      });

      return { success: true, workflowId: workflow.id };
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
        // Получаем workflow через API
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006';
        const response = await fetch(
          `${baseUrl}/api/projects/${projectId}/workflows/${installation.workflowId}`
        );
        if (response.ok) {
          const workflowData = await response.json();
          result.push({
            installation,
            template,
            workflow: workflowData.workflow
          });
        }
      } catch (error) {
        logger.warn('Workflow not found for installation', {
          installationId: installation.workflowId,
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
      ...template.workflowConfig,
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

        workflowConfig: {
          name: data.name,
          description: data.description,
          nodes: data.nodes,
          connections: data.connections,
          variables: data.variables || [],
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
        updatedAt: new Date(),

        isPublic: false // Импортированные шаблоны по умолчанию не публичны
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
    // Загружаем все шаблоны
    this.templates = [
      loyaltySystemTemplate,
      shopTemplate,
      feedbackTemplate,
      webinarTemplate,
      supportTemplate,
      gamificationTemplate
    ];
  }
}

export const botTemplatesService = new BotTemplatesService();

// Для обратной совместимости, так как в некоторых файлах используется botTemplates
export const botTemplates = botTemplatesService;
