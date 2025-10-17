/**
 * @file: src/lib/services/bot-templates/bot-templates.service.ts
 * @description: Сервис управления шаблонами ботов
 * @project: SaaS Bonus System
 * @dependencies: BotFlowService
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';

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
        isActive: false, // По умолчанию неактивен, чтобы пользователь мог настроить
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006';
      
      logger.info('Creating workflow via API', {
        url: `${baseUrl}/api/projects/${projectId}/workflows`,
        workflowData: JSON.stringify(workflowData, null, 2)
      });
      
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to create workflow', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to create workflow: ${response.status} ${response.statusText} - ${errorText}`);
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
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006';
        const response = await fetch(`${baseUrl}/api/projects/${projectId}/workflows/${installation.workflowId}`);
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
    this.templates = [
      // Basic Templates
      {
        id: 'basic_workflow',
        name: 'Базовый workflow',
        description: 'Простой базовый шаблон для начала работы с workflow',
        category: 'utility',
        difficulty: 'beginner',
        tags: ['basic', 'starter', 'simple'],
        estimatedTime: 5,
        icon: '🚀',
        color: '#3b82f6',

        workflowConfig: {
          name: 'Базовый Workflow',
          description: 'Простой workflow, отвечающий "привет!" на команду /start',
          nodes: [
            {
              id: 'start-trigger',
              type: 'trigger.command',
              position: { x: 100, y: 100 },
              data: {
                label: 'Команда /start',
                config: {
                  'trigger.command': {
                    command: '/start'
                  }
                }
              }
            },
            {
              id: 'hello-message',
              type: 'message',
              position: { x: 400, y: 100 },
              data: {
                label: 'Приветственное сообщение',
                config: {
                  message: {
                    text: 'привет!'
                  }
                }
              }
            },
            {
              id: 'end-node',
              type: 'flow.end',
              position: { x: 700, y: 100 },
              data: {
                label: 'Завершение',
                config: {
                  'flow.end': { success: true }
                }
              }
            }
          ],
          connections: [
            {
              id: 'start-to-hello',
              source: 'start-trigger',
              target: 'hello-message',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'hello-to-end',
              source: 'hello-message',
              target: 'end-node',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'edge-start-trigger-hello-message-1760381741793',
              source: 'start-trigger',
              target: 'hello-message',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-hello-message-end-node-1760381743584',
              source: 'hello-message',
              target: 'end-node',
              type: 'default',
              animated: true
            }
          ],
          variables: [],
          settings: {
            maxExecutionTime: 30000,
            retryAttempts: 3
          }
        },

        features: ['Простой ответ на /start', 'Базовая структура workflow'],
        integrations: ['Telegram'],
        useCases: ['Тестирование бота', 'Начало работы', 'Простые боты'],
        installs: 0,
        rating: 0,
        reviews: 0,
        author: 'SaaS Bonus System',
        version: '1.0.0',
        createdAt: new Date('2025-01-13'),
        updatedAt: new Date('2025-10-13'),
        isPublic: true
      },

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

        workflowConfig: {
          name: 'Support Ticket Bot',
          description: 'Handles customer support requests and creates tickets',
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger.command',
              position: { x: 100, y: 100 },
              data: {
                label: 'Команда /start',
                config: {
                  'trigger.command': { command: '/start' }
                }
              }
            },
            {
              id: 'message-1',
              type: 'message',
              position: { x: 400, y: 100 },
              data: {
                label: 'Приветственное сообщение',
                config: {
                  message: {
                    text: 'Добро пожаловать в службу поддержки! Выберите категорию обращения:'
                  }
                }
              }
            },
            {
              id: 'end-1',
              type: 'flow.end',
              position: { x: 700, y: 100 },
              data: {
                label: 'Завершение',
                config: {
                  'flow.end': { success: true }
                }
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              source: 'trigger-1',
              target: 'message-1',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'conn-2',
              source: 'message-1',
              target: 'end-1',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            }
          ],
          variables: [],
          settings: {}
        },

        features: ['Обработка тикетов', 'Автоматизация поддержки', 'CRM интеграция'],
        integrations: ['Telegram', 'Database', 'CRM'],
        useCases: ['Служба поддержки', 'Обработка обращений'],
        installs: 0,
        rating: 0,
        reviews: 0,
        author: 'SaaS Bonus System',
        version: '1.0.0',
        createdAt: new Date('2025-01-12'),
        updatedAt: new Date('2025-01-12'),
        isPublic: true
      },
      {
        id: 'welcome_bot',
        name: 'Простой приветственный бот',
        description: 'Базовый бот для приветствия новых пользователей с простым меню',
        category: 'customer_support',
        difficulty: 'beginner',
        tags: ['welcome', 'greeting', 'simple', 'menu'],
        estimatedTime: 15,
        icon: '👋',
        color: '#10b981',

        workflowConfig: {
          name: 'Welcome Bot',
          description: 'Simple welcome bot with basic menu',
          nodes: [
            {
              id: 'welcome-trigger',
              type: 'trigger.command',
              position: { x: 50, y: 50 },
              data: {
                label: 'Приветствие',
                config: {
                  'trigger.command': { command: '/start' }
                }
              }
            },
            {
              id: 'welcome-message',
              type: 'message',
              position: { x: 350, y: 50 },
              data: {
                label: 'Главное меню',
                config: {
                  message: {
                    text: '👋 Привет! Добро пожаловать в наш бот!\n\nВыбери действие:',
                    buttons: [
                      {
                        text: 'ℹ️ О нас',
                        callbackData: 'about'
                      },
                      {
                        text: '📞 Поддержка',
                        callbackData: 'support'
                      },
                      {
                        text: '🛍️ Каталог',
                        callbackData: 'catalog'
                      }
                    ]
                  }
                }
              }
            },
            {
              id: 'menu-trigger',
              type: 'trigger.callback',
              position: { x: 50, y: 250 },
              data: {
                label: 'Обработчик меню',
                config: {
                  'trigger.callback': { callbackData: 'about|support|catalog' }
                }
              }
            },
            {
              id: 'response-message',
              type: 'message',
              position: { x: 350, y: 250 },
              data: {
                label: 'Ответ на выбор',
                config: {
                  message: {
                    text: 'Спасибо за выбор! Эта функция скоро будет доступна. 🚀\n\nИспользуй /start для возврата в главное меню.',
                    buttons: [
                      {
                        text: '🏠 Главное меню',
                        callbackData: 'menu'
                      }
                    ]
                  }
                }
              }
            },
            {
              id: 'welcome-end',
              type: 'flow.end',
              position: { x: 650, y: 250 },
              data: {
                label: 'Завершение',
                config: {
                  'flow.end': { success: true }
                }
              }
            }
          ],
          connections: [
            {
              id: 'welcome-flow',
              source: 'welcome-trigger',
              target: 'welcome-message',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'menu-flow',
              source: 'menu-trigger',
              target: 'response-message',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'response-end',
              source: 'response-message',
              target: 'welcome-end',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            }
          ],
          variables: [],
          settings: {
            maxExecutionTime: 30000,
            retryAttempts: 2
          }
        },

        features: ['Приветствие', 'Простота', 'Базовый функционал'],
        integrations: ['Telegram'],
        useCases: ['Приветствие новых пользователей', 'Базовое взаимодействие'],
        installs: 0,
        rating: 0,
        reviews: 0,
        author: 'SaaS Bonus System',
        version: '1.0.0',
        createdAt: new Date('2025-01-12'),
        updatedAt: new Date('2025-01-12'),
        isPublic: true
      },
      {
        id: 'feedback_bot',
        name: 'Бот для сбора отзывов',
        description: 'Автоматизированный сбор отзывов и оценок от клиентов',
        category: 'survey',
        difficulty: 'intermediate',
        tags: ['feedback', 'rating', 'survey'],
        estimatedTime: 30,
        icon: '⭐',
        color: '#f59e0b',

        workflowConfig: {
          name: 'Feedback Bot',
          description: 'Collects customer feedback and ratings',
          nodes: [
            {
              id: 'trigger-node',
              type: 'trigger',
              position: { x: 100, y: 100 },
              data: {
                label: 'Триггер',
                config: {
                  trigger: {
                    type: 'command',
                    command: '/feedback'
                  }
                }
              }
            },
            {
              id: 'message-node',
              type: 'message',
              position: { x: 400, y: 100 },
              data: {
                label: 'Запрос отзыва',
                config: {
                  message: {
                    text: 'Пожалуйста, оцените наш сервис от 1 до 5 звезд:'
                  }
                }
              }
            },
            {
              id: 'condition-node',
              type: 'condition',
              position: { x: 700, y: 100 },
              data: {
                label: 'Проверка оценки',
                config: {
                  condition: {
                    variable: 'rating',
                    operator: 'greater',
                    value: 3
                  }
                }
              }
            },
            {
              id: 'thank-message-node',
              type: 'message',
              position: { x: 1000, y: 50 },
              data: {
                label: 'Благодарность',
                config: {
                  message: {
                    text: 'Спасибо за высокую оценку! 🙏'
                  }
                }
              }
            },
            {
              id: 'improve-message-node',
              type: 'message',
              position: { x: 1000, y: 150 },
              data: {
                label: 'Улучшение',
                config: {
                  message: {
                    text: 'Спасибо за отзыв! Мы работаем над улучшением сервиса.'
                  }
                }
              }
            },
            {
              id: 'end-node',
              type: 'end',
              position: { x: 1300, y: 100 },
              data: {
                label: 'Завершение',
                config: {}
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              source: 'trigger-node',
              target: 'message-node',
              type: 'default'
            },
            {
              id: 'conn-2',
              source: 'message-node',
              target: 'condition-node',
              type: 'default'
            },
            {
              id: 'conn-3',
              source: 'condition-node',
              target: 'thank-message-node',
              type: 'true'
            },
            {
              id: 'conn-4',
              source: 'condition-node',
              target: 'improve-message-node',
              type: 'false'
            },
            {
              id: 'conn-5',
              source: 'thank-message-node',
              target: 'end-node',
              type: 'default'
            },
            {
              id: 'conn-6',
              source: 'improve-message-node',
              target: 'end-node',
              type: 'default'
            }
          ],
          variables: [
            {
              name: 'rating',
              type: 'number',
              defaultValue: 0,
              description: 'Оценка пользователя',
              required: true
            }
          ],
          settings: {}
        },

        features: ['Сбор отзывов', 'Оценка сервиса', 'Автоматизация обратной связи'],
        integrations: ['Telegram', 'Database'],
        useCases: ['Сбор отзывов клиентов', 'Оценка качества сервиса'],
        installs: 0,
        rating: 0,
        reviews: 0,
        author: 'SaaS Bonus System',
        version: '1.0.0',
        createdAt: new Date('2025-01-12'),
        updatedAt: new Date('2025-01-12'),
        isPublic: true
      },
      {
        id: 'ecommerce_bot',
        name: 'Бот интернет-магазина',
        description: 'Полнофункциональный бот для интернет-магазина с каталогом и заказами',
        category: 'ecommerce',
        difficulty: 'advanced',
        tags: ['ecommerce', 'catalog', 'orders', 'payments'],
        estimatedTime: 60,
        icon: '🛒',
        color: '#8b5cf6',

        workflowConfig: {
          name: 'E-commerce Bot',
          description: 'Full-featured e-commerce bot with catalog and orders',
          nodes: [
            {
              id: 'trigger-node',
              type: 'trigger',
              position: { x: 100, y: 100 },
              data: {
                label: 'Триггер',
                config: {
                  trigger: {
                    type: 'command',
                    command: '/start'
                  }
                }
              }
            },
            {
              id: 'welcome-message-node',
              type: 'message',
              position: { x: 400, y: 100 },
              data: {
                label: 'Приветствие',
                config: {
                  message: {
                    text: 'Добро пожаловать в наш магазин! 🛍️\n\nВыберите действие:'
                  }
                }
              }
            },
            {
              id: 'catalog-action-node',
              type: 'action',
              position: { x: 700, y: 50 },
              data: {
                label: 'Показать каталог',
                config: {
                  action: {
                    type: 'api_call',
                    url: '/api/catalog',
                    method: 'GET'
                  }
                }
              }
            },
            {
              id: 'catalog-message-node',
              type: 'message',
              position: { x: 1000, y: 50 },
              data: {
                label: 'Каталог товаров',
                config: {
                  message: {
                    text: 'Вот наш каталог товаров:'
                  }
                }
              }
            },
            {
              id: 'end-node',
              type: 'end',
              position: { x: 1300, y: 100 },
              data: {
                label: 'Завершение',
                config: {}
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              source: 'trigger-node',
              target: 'welcome-message-node',
              type: 'default'
            },
            {
              id: 'conn-2',
              source: 'welcome-message-node',
              target: 'catalog-action-node',
              type: 'default'
            },
            {
              id: 'conn-3',
              source: 'catalog-action-node',
              target: 'catalog-message-node',
              type: 'default'
            },
            {
              id: 'conn-4',
              source: 'catalog-message-node',
              target: 'end-node',
              type: 'default'
            }
          ],
          variables: [
            {
              name: 'user_id',
              type: 'string',
              defaultValue: '',
              description: 'ID пользователя',
              required: true
            },
            {
              name: 'cart',
              type: 'array',
              defaultValue: [],
              description: 'Корзина покупок',
              required: false
            }
          ],
          settings: {
            timeout: 30000,
            maxRetries: 3
          }
        },

        features: ['Каталог товаров', 'Обработка заказов', 'Интеграция с платежами'],
        integrations: ['Telegram', 'Database', 'Payment Gateway'],
        useCases: ['Интернет-магазин', 'Онлайн продажи'],
        installs: 0,
        rating: 0,
        reviews: 0,
        author: 'SaaS Bonus System',
        version: '1.0.0',
        createdAt: new Date('2025-01-12'),
        updatedAt: new Date('2025-01-12'),
        isPublic: true
      },
      // Basic Template - Simplified
      {
        id: 'basic_account_linking_bot',
        name: 'Система лояльности',
        description: 'Бот для привязки пользователей и начисления приветственных бонусов',
        category: 'loyalty',
        difficulty: 'intermediate',
        tags: ['loyalty', 'bonuses', 'registration', 'contact'],
        estimatedTime: 15,
        icon: '🎁',
        color: '#10b981',

        workflowConfig: {
          name: 'Система лояльности',
          description: 'Регистрация пользователя и начисление приветственных бонусов',
          nodes: [
            // 1. Триггер /start
            {
              id: 'start-trigger',
              type: 'trigger.command',
              position: { x: 100, y: 200 },
              data: {
                label: 'Команда /start',
                config: {
                  'trigger.command': {
                    command: '/start'
                  }
                }
              }
            },
            // 2. Приветственное сообщение
            {
              id: 'welcome-message',
              type: 'message',
              position: { x: 350, y: 200 },
              data: {
                label: 'Приветствие',
                config: {
                  message: {
                    text: '🎁 Добро пожаловать в программу лояльности!\n\n💰 Получите приветственные бонусы прямо сейчас!\n\n📱 Для регистрации, пожалуйста, поделитесь вашим номером телефона или укажите email.'
                  }
                }
              }
            },
            // 3. Запрос контакта
            {
              id: 'request-contact',
              type: 'trigger.contact',
              position: { x: 600, y: 200 },
              data: {
                label: 'Запрос контакта',
                config: {
                  'trigger.contact': {
                    requestPhone: true,
                    buttonText: '📱 Поделиться номером'
                  }
                }
              }
            },
            // 4. Проверка существующего пользователя
            {
              id: 'check-user',
              type: 'action.database_query',
              position: { x: 850, y: 200 },
              data: {
                label: 'Проверить пользователя',
                config: {
                  'action.database_query': {
                    query: 'check_user_by_telegram',
                    parameters: {
                      telegramId: '{{telegram.userId}}',
                      phone: '{{telegram.contact.phone}}',
                      email: '{{telegram.message.text}}'
                    }
                  }
                }
              }
            },
            // 5. Условие: новый пользователь?
            {
              id: 'is-new-user',
              type: 'condition',
              position: { x: 1100, y: 200 },
              data: {
                label: 'Новый пользователь?',
                config: {
                  condition: {
                    expression: '!get("user") || !get("user").id'
                  }
                }
              }
            },
            // 6. Создать пользователя (если новый)
            {
              id: 'create-user',
              type: 'action.database_query',
              position: { x: 1350, y: 100 },
              data: {
                label: 'Создать пользователя',
                config: {
                  'action.database_query': {
                    query: 'create_user',
                    parameters: {
                      telegramId: '{{telegram.userId}}',
                      username: '{{telegram.username}}',
                      firstName: '{{telegram.firstName}}',
                      phone: '{{telegram.contact.phone}}',
                      email: '{{telegram.message.text}}'
                    }
                  }
                }
              }
            },
            // 7. Начислить приветственные бонусы
            {
              id: 'add-welcome-bonus',
              type: 'action.database_query',
              position: { x: 1600, y: 100 },
              data: {
                label: 'Начислить бонусы',
                config: {
                  'action.database_query': {
                    query: 'add_bonus',
                    parameters: {
                      userId: '{{user.id}}',
                      amount: 100,
                      type: 'welcome',
                      description: 'Приветственные бонусы'
                    }
                  }
                }
              }
            },
            // 8. Сообщение об успешной регистрации
            {
              id: 'success-new-user',
              type: 'message',
              position: { x: 1850, y: 100 },
              data: {
                label: 'Успешная регистрация',
                config: {
                  message: {
                    text: '🎉 Поздравляем с регистрацией!\n\n💰 Вам начислено 100 приветственных бонусов!\n\n✨ Используйте их для покупок и получайте выгоду!'
                  }
                }
              }
            },
            // 9. Сообщение для существующего пользователя
            {
              id: 'existing-user-message',
              type: 'message',
              position: { x: 1350, y: 300 },
              data: {
                label: 'Уже зарегистрирован',
                config: {
                  message: {
                    text: '👋 Рады видеть вас снова!\n\n💰 Ваш текущий баланс: {{user.balance}} бонусов\n\n🛍️ Продолжайте делать покупки и копить бонусы!'
                  }
                }
              }
            },
            // 10. Завершение
            {
              id: 'end-node',
              type: 'flow.end',
              position: { x: 2100, y: 200 },
              data: {
                label: 'Завершение',
                config: {
                  'flow.end': { success: true }
                }
              }
            }
          ],
          connections: [
            {
              id: 'start-to-welcome',
              source: 'start-trigger',
              target: 'welcome-message',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'welcome-to-request',
              source: 'welcome-message',
              target: 'request-contact',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'request-to-check',
              source: 'request-contact',
              target: 'check-user',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'check-to-condition',
              source: 'check-user',
              target: 'is-new-user',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'condition-to-create',
              source: 'is-new-user',
              target: 'create-user',
              sourceHandle: 'true',
              targetHandle: 'input',
              type: 'true'
            },
            {
              id: 'create-to-bonus',
              source: 'create-user',
              target: 'add-welcome-bonus',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'bonus-to-success',
              source: 'add-welcome-bonus',
              target: 'success-new-user',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'success-to-end',
              source: 'success-new-user',
              target: 'end-node',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            {
              id: 'condition-to-existing',
              source: 'is-new-user',
              target: 'existing-user-message',
              sourceHandle: 'false',
              targetHandle: 'input',
              type: 'false'
            },
            {
              id: 'existing-to-end',
              source: 'existing-user-message',
              target: 'end-node',
              sourceHandle: 'output',
              targetHandle: 'input',
              type: 'default'
            },
            // Анимированные связи для визуализации
            {
              id: 'edge-start-trigger-welcome-message',
              source: 'start-trigger',
              target: 'welcome-message',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-request-contact-check-user',
              source: 'request-contact',
              target: 'check-user',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-check-user-is-new-user',
              source: 'check-user',
              target: 'is-new-user',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-is-new-user-create-user',
              source: 'is-new-user',
              target: 'create-user',
              type: 'default',
              animated: true,
              sourceHandle: 'true'
            },
            {
              id: 'edge-create-user-add-welcome-bonus',
              source: 'create-user',
              target: 'add-welcome-bonus',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-add-welcome-bonus-success-new-user',
              source: 'add-welcome-bonus',
              target: 'success-new-user',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-success-new-user-end-node',
              source: 'success-new-user',
              target: 'end-node',
              type: 'default',
              animated: true
            },
            {
              id: 'edge-is-new-user-existing-user-message',
              source: 'is-new-user',
              target: 'existing-user-message',
              type: 'default',
              animated: true,
              sourceHandle: 'false'
            },
            {
              id: 'edge-existing-user-message-end-node',
              source: 'existing-user-message',
              target: 'end-node',
              type: 'default',
              animated: true
            }
          ],
          variables: [
            {
              id: 'user',
              name: 'user',
              type: 'object',
              defaultValue: null,
              description: 'Данные пользователя'
            },
            {
              id: 'welcome_bonus',
              name: 'welcome_bonus',
              type: 'number',
              defaultValue: 100,
              description: 'Размер приветственного бонуса'
            }
          ],
          settings: {
            maxExecutionTime: 60000,
            retryAttempts: 3
          }
        },

        features: [
          'Запрос контакта или email',
          'Проверка существующего пользователя',
          'Автоматическая регистрация',
          'Начисление приветственных бонусов',
          'Отображение баланса'
        ],
        integrations: ['Telegram', 'Database', 'Bonus System'],
        useCases: [
          'Программа лояльности',
          'Регистрация пользователей',
          'Начисление бонусов',
          'Интернет-магазины',
          'Сервисные компании'
        ],
        installs: 0,
        rating: 0,
        reviews: 0,
        author: 'SaaS Bonus System',
        version: '2.0.0',
        createdAt: new Date('2025-01-13'),
        updatedAt: new Date('2025-10-14'),
        isPublic: true
      }
    ];

    logger.info('Bot templates initialized', { count: this.templates.length });
  }
}

// Экспорт синглтона
export { BotTemplatesService };
export const botTemplates = new BotTemplatesService();
