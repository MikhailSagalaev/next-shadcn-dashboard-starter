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
    // Импортируем шаблон "Система лояльности"
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
        name: 'Система лояльности',
        description:
          'Умная система лояльности с проверкой статуса пользователей и флоу регистрации на сайте. Приветственные бонусы начисляются автоматически при активации.',
        nodes: [
          {
            id: 'start-trigger',
            data: {
              label: 'Команда /start',
              config: {
                'trigger.command': {
                  command: '/start'
                }
              }
            },
            type: 'trigger.command',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'welcome-message',
            data: {
              label: 'Приветствие',
              config: {
                message: {
                  text: '🎁 Добро пожаловать в программу лояльности!\n\n💰 Получите приветственные бонусы прямо сейчас!\n\n📱 Для начала работы поделитесь номером телефона кнопкой ниже ИЛИ отправьте свой email текстом в чат.',
                  keyboard: {
                    type: 'reply',
                    buttons: [
                      [
                        {
                          text: '📱 Поделиться контактом',
                          request_contact: true
                        }
                      ],
                      [
                        {
                          text: '✉️ Ввести email'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 1624,
              y: 625
            },
            selected: false
          },
          {
            id: 'check-telegram-user',
            data: {
              label: 'Проверить по Telegram ID',
              config: {
                'action.database_query': {
                  query: 'check_user_by_telegram',
                  assignTo: 'telegramUser',
                  parameters: {
                    projectId: '{{projectId}}',
                    telegramId: '{{telegram.userId}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 406,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-user-status',
            data: {
              label: 'Пользователь найден?',
              config: {
                condition: {
                  operator: 'is_not_empty',
                  variable: 'telegramUser'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 812,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-user-active',
            data: {
              label: 'Пользователь активен?',
              config: {
                condition: {
                  value: true,
                  operator: 'equals',
                  variable: 'telegramUser.isActive'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 1218,
              y: 0
            },
            selected: false
          },
          {
            id: 'active-user-profile',
            data: {
              label: 'Профиль активного пользователя',
              config: {
                message: {
                  text: '👋 Добро пожаловать назад, <b>{user.firstName}</b>!\n\n💵 Ваш баланс бонусов: <b>{user.balanceFormatted}</b>\n📊 Всего заработано: <b>{user.totalEarnedFormatted}</b>\n🛒 Потрачено: <b>{user.totalSpentFormatted}</b>\n🏆 Истекает в ближайшие 30 дней: <b>{user.expiringBonusesFormatted}</b>\n\nВыберите действие:',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '💰 Баланс',
                          callback_data: 'menu_balance'
                        },
                        {
                          text: '📜 История',
                          callback_data: 'menu_history'
                        }
                      ],
                      [
                        {
                          text: '🏆 Уровень',
                          callback_data: 'menu_level'
                        },
                        {
                          text: '👥 Рефералы',
                          callback_data: 'menu_referrals'
                        }
                      ],
                      [
                        {
                          text: '🔗 Пригласить',
                          callback_data: 'menu_invite'
                        },
                        {
                          text: '❓ Помощь',
                          callback_data: 'menu_help'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 1624,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'request-contact-confirmation',
            data: {
              label: 'Запросить подтверждение контакта',
              config: {
                message: {
                  text: '🔍 Мы нашли ваш аккаунт, но он неактивен.\n\n📱 Для активации поделитесь контактом или введите email:\n\n• Нажмите кнопку для отправки контакта\n• Или введите ваш email вручную',
                  keyboard: {
                    type: 'reply',
                    buttons: [
                      [
                        {
                          text: 'Поделиться контактом',
                          request_contact: true
                        }
                      ],
                      [
                        {
                          text: 'Ввести email',
                          callback_data: 'enter_email'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 1624,
              y: 0
            },
            selected: false
          },
          {
            id: 'enter-email-trigger',
            data: {
              label: 'Триггер: ручной ввод email',
              config: {
                'trigger.callback': {
                  callbackData: 'enter_email'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 1218,
              y: -200
            },
            selected: false
          },
          {
            id: 'enter-email-instructions',
            data: {
              label: 'Запросить email вручную',
              config: {
                message: {
                  text: '✉️ Пожалуйста, укажите email, который использовался на сайте.\n\nПросто отправьте его сообщением в ответ на это сообщение. Если ошиблись — введите ещё раз.',
                  keyboard: {
                    type: 'reply',
                    one_time_keyboard: true,
                    buttons: [
                      [
                        {
                          text: 'Отмена'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 2030,
              y: -200
            },
            selected: false
          },
          {
            id: 'check-contact-user',
            data: {
              label: 'Проверить по контакту/email',
              config: {
                'action.database_query': {
                  query: 'check_user_by_contact',
                  assignTo: 'contactUser',
                  parameters: {
                    email: '{{telegram.message.text}}',
                    phone: '{{contactReceived.phoneNumber}}',
                    projectId: '{{projectId}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 2030,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-contact-found',
            data: {
              label: 'Контакт найден?',
              config: {
                condition: {
                  operator: 'is_not_empty',
                  variable: 'contactUser'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 2436,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-telegram-already-linked',
            data: {
              label: 'Telegram уже привязан?',
              config: {
                condition: {
                  operator: 'is_not_empty',
                  variable: 'contactUser.telegramId'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 2842,
              y: 186.5
            },
            selected: false
          },
          {
            id: 'already-active-message',
            data: {
              label: 'Уже активирован',
              config: {
                message: {
                  text: '✅ Ваш аккаунт уже активирован!\n\n💰 Текущий баланс: {user.balanceFormatted}\n📊 Уровень: {user.currentLevel}\n🎁 Реферальный код: {user.referralCode}\n\n🛍️ Продолжайте делать покупки и копить бонусы!'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 4872,
              y: 55.5
            },
            selected: false
          },
          {
            id: 'activate-user',
            data: {
              label: 'Активировать пользователя',
              config: {
                'action.database_query': {
                  query: 'activate_user',
                  parameters: {
                    userId: '{{contactUser.id}}',
                    telegramId: '{{telegram.userId}}',
                    telegramUsername: '{{telegram.username}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 3248,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-welcome-bonus',
            data: {
              label: 'Проверить приветственные бонусы',
              config: {
                'action.database_query': {
                  query: 'check_welcome_bonus',
                  assignTo: 'hasWelcomeBonus',
                  parameters: {
                    userId: '{{contactUser.id}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 3654,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-bonus-exists',
            data: {
              label: 'Есть приветственные бонусы?',
              config: {
                condition: {
                  value: false,
                  operator: 'equals',
                  variable: 'hasWelcomeBonus'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 4060,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'add-welcome-bonus',
            data: {
              label: 'Начислить приветственные бонусы',
              config: {
                'action.database_query': {
                  query: 'add_bonus',
                  assignTo: '',
                  parameters: {
                    type: 'WELCOME',
                    amount: '555',
                    userId: '{{contactUser.id}}',
                    expiresAt: '',
                    description: 'Приветственные бонусы за активацию аккаунта'
                  },
                  resultMapping: {}
                }
              },
              description: ''
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 4466,
              y: 242
            },
            selected: false
          },
          {
            id: 'success-activated-user',
            data: {
              label: 'Успешная активация',
              config: {
                message: {
                  text: '🎉 Аккаунт успешно активирован!\n\n💰 Вам начислено 100 приветственных бонусов!\n\n📊 Ваш профиль:\n• Баланс: {user.balanceFormatted}\n• Уровень: {user.currentLevel}\n• Реферальный код: {user.referralCode}\n\n✨ Добро пожаловать в программу лояльности!'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 4872,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'website-registration-required',
            data: {
              label: 'Требуется регистрация на сайте',
              config: {
                message: {
                  text: '🌐 Для участия в программе лояльности необходимо зарегистрироваться на нашем сайте.\n\n📝 Пожалуйста, перейдите по ссылке и создайте аккаунт:\n\n🔗 https://your-website.com/register\n\n✨ После регистрации вернитесь к боту и поделитесь контактом для активации бонусов!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          url: 'https://your-website.com/register',
                          text: '🌐 Зарегистрироваться на сайте'
                        }
                      ],
                      [
                        {
                          text: '🔄 Проверить снова',
                          callback_data: 'check_again'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 4872,
              y: 549.5
            },
            selected: false
          },
          {
            id: 'check-again-trigger',
            data: {
              label: 'Триггер: проверить снова',
              config: {
                'trigger.callback': {
                  callbackData: 'check_again'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 5280,
              y: 780
            },
            selected: false
          },
          {
            id: 'menu-balance-trigger',
            data: {
              label: 'Триггер: Баланс',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_balance'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 549.5
            },
            selected: false
          },
          {
            id: 'show-balance-details',
            data: {
              label: 'Показать баланс',
              config: {
                message: {
                  text: '<b>💰 Ваш баланс бонусов</b>\n\n💵 <b>Текущий баланс:</b> {user.balanceFormatted}\n📈 <b>Всего заработано:</b> {user.totalEarnedFormatted}\n📉 <b>Всего потрачено:</b> {user.totalSpentFormatted}\n🛍️ <b>Покупок на сумму:</b> {user.totalPurchasesFormatted}\n\n✨ Продолжайте совершать покупки для накопления бонусов!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 549.5
            },
            selected: false
          },
          {
            id: 'menu-history-trigger',
            data: {
              label: 'Триггер: История',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_history'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 791.5
            },
            selected: false
          },
          {
            id: 'show-history-list',
            data: {
              label: 'Показать историю',
              config: {
                message: {
                  text: '<b>📜 История операций</b>\n\n<b>Последние 10 операций:</b>\n\n{transactions.formatted}\n\nПоказаны последние 10 операций.\n\n💡 Для полной истории посетите личный кабинет на сайте.',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 791.5
            },
            selected: false
          },
          {
            id: 'menu-level-trigger',
            data: {
              label: 'Триггер: Уровень',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_level'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 1033.5
            },
            selected: false
          },
          {
            id: 'show-level-info',
            data: {
              label: 'Показать уровень',
              config: {
                message: {
                  text: '<b>🏆 Ваш уровень:</b> {user.currentLevel}\n\n<b>📊 Прогресс к следующему уровню:</b>\n{user.progressBar} ({user.progressPercent}%)\n\n<b>💰 Бонусный процент:</b> {user.levelBonusPercent}%\n<b>💵 Процент оплаты бонусами:</b> {user.levelPaymentPercent}%\n\n<b>Следующий уровень:</b> {user.nextLevelName}\n<b>Нужно покупок на сумму:</b> {user.nextLevelAmountFormatted}\n\n🎯 Продолжайте совершать покупки для повышения уровня!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 1033.5
            },
            selected: false
          },
          {
            id: 'menu-referrals-trigger',
            data: {
              label: 'Триггер: Рефералы',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_referrals'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 0,
              y: 1275.5
            },
            selected: false
          },
          {
            id: 'show-referrals-stats',
            data: {
              label: 'Показать рефералы',
              config: {
                message: {
                  text: '<b>👥 Реферальная программа</b>\n\n<b>📊 Статистика по проекту:</b>\n👤 <b>Приглашено пользователей:</b> {user.referralCount}\n💰 <b>Бонусов от рефералов:</b> {user.referralBonusTotalFormatted}\n\n<b>🔗 Ваша реферальная ссылка:</b>\n{user.referralLink}\n\n📱 Поделитесь ссылкой с друзьями и получайте бонусы за их покупки!\n\n💡 Приглашайте друзей и зарабатывайте вместе!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 1275.5
            },
            selected: false
          },
          {
            id: 'show-invite-info',
            data: {
              label: 'Показать приглашение',
              config: {
                message: {
                  text: '<b>🔗 Пригласите друзей и получайте бонусы!</b>\n\nПоделитесь персональной ссылкой и получайте вознаграждение за каждую покупку приглашённых пользователей.\n\n<b>Ваша ссылка:</b>\n{user.referralLink}\n\n1️⃣ Скопируйте ссылку\n2️⃣ Отправьте друзьям в мессенджерах или соцсетях\n3️⃣ Получайте бонусы автоматически\n\n🎁 Больше друзей — больше бонусов!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 406,
              y: 1517.5
            },
            selected: false
          },
          {
            id: 'menu-invite-trigger',
            data: {
              label: 'Триггер: Пригласить',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_invite'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 0,
              y: 1517.5
            },
            selected: false
          },
          {
            id: 'menu-help-trigger',
            data: {
              label: 'Триггер: Помощь',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_help'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 1759.5
            },
            selected: false
          },
          {
            id: 'show-help-info',
            data: {
              label: 'Показать помощь',
              config: {
                message: {
                  text: '<b>❓ Помощь</b>\n\n<b>🎯 Как работает бонусная система:</b>\n\n💰 <b>Бонусы</b> - накапливайте бонусы за покупки\n🛒 <b>Списание</b> - оплачивайте часть покупки бонусами\n🏆 <b>Уровни</b> - повышайте уровень для лучших условий\n👥 <b>Рефералы</b> - приглашайте друзей и получайте бонусы\n\n<b>📱 Команды:</b>\n• /start - начать работу с ботом\n• 💰 Баланс - посмотреть текущий баланс\n• 📜 История - история операций\n• 🏆 Уровень - ваш текущий уровень\n• 👥 Рефералы - реферальная программа\n• 🔗 Пригласить - пригласить друга\n\n💬 Если возникли вопросы, напишите в поддержку!',
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 1759.5
            },
            selected: false
          },
          {
            id: 'menu-main-trigger',
            data: {
              label: 'Триггер: Главное меню',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_main'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 1218,
              y: 252
            },
            selected: false
          },
          {
            id: 'back-to-menu-trigger',
            data: {
              label: 'Триггер: Назад в меню',
              config: {
                'trigger.callback': {
                  callbackData: 'back_to_menu'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 1218,
              y: 494
            },
            selected: false
          },
          {
            id: 'end-node',
            data: {
              label: 'Завершение',
              config: {
                'flow.end': {}
              }
            },
            type: 'flow.end',
            dragging: false,
            measured: {
              width: 256,
              height: 78
            },
            position: {
              x: 5278,
              y: 307.5
            },
            selected: false
          }
        ],
        connections: [
          {
            id: 'edge-start-trigger-check-telegram-user-1760624947114',
            type: 'default',
            source: 'start-trigger',
            target: 'check-telegram-user',
            animated: true
          },
          {
            id: 'edge-check-telegram-user-check-user-status-1760624947115',
            type: 'default',
            source: 'check-telegram-user',
            target: 'check-user-status',
            animated: true
          },
          {
            id: 'edge-check-user-status-check-user-active-1760624947116',
            type: 'default',
            source: 'check-user-status',
            target: 'check-user-active',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-user-status-welcome-message-1760624947117',
            type: 'default',
            source: 'check-user-status',
            target: 'welcome-message',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-welcome-message-check-contact-user-1760624947118',
            type: 'default',
            source: 'welcome-message',
            target: 'check-contact-user',
            animated: true
          },
          {
            id: 'edge-check-user-active-active-user-profile-1760624947119',
            type: 'default',
            source: 'check-user-active',
            target: 'active-user-profile',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-user-active-request-contact-confirmation-1760624947120',
            type: 'default',
            source: 'check-user-active',
            target: 'request-contact-confirmation',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-request-contact-confirmation-check-contact-user-1760624947121',
            type: 'default',
            source: 'request-contact-confirmation',
            target: 'check-contact-user',
            animated: true
          },
          {
            id: 'edge-enter-email-trigger-enter-email-instructions',
            type: 'default',
            source: 'enter-email-trigger',
            target: 'enter-email-instructions',
            animated: true
          },
          {
            id: 'edge-enter-email-instructions-check-contact-user',
            type: 'default',
            source: 'enter-email-instructions',
            target: 'check-contact-user',
            animated: true
          },
          {
            id: 'edge-check-contact-user-check-contact-found-1760624947122',
            type: 'default',
            source: 'check-contact-user',
            target: 'check-contact-found',
            animated: true
          },
          {
            id: 'edge-check-contact-found-check-telegram-already-linked-1760624947123',
            type: 'default',
            source: 'check-contact-found',
            target: 'check-telegram-already-linked',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-contact-found-website-registration-required-1760624947124',
            type: 'default',
            source: 'check-contact-found',
            target: 'website-registration-required',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-check-telegram-already-linked-already-active-message-1760624947125',
            type: 'default',
            source: 'check-telegram-already-linked',
            target: 'already-active-message',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-telegram-already-linked-activate-user-1760624947126',
            type: 'default',
            source: 'check-telegram-already-linked',
            target: 'activate-user',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-activate-user-check-welcome-bonus-1760624947127',
            type: 'default',
            source: 'activate-user',
            target: 'check-welcome-bonus',
            animated: true
          },
          {
            id: 'edge-check-welcome-bonus-check-bonus-exists-1760624947128',
            type: 'default',
            source: 'check-welcome-bonus',
            target: 'check-bonus-exists',
            animated: true
          },
          {
            id: 'edge-check-bonus-exists-add-welcome-bonus-1760624947129',
            type: 'default',
            source: 'check-bonus-exists',
            target: 'add-welcome-bonus',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-bonus-exists-success-activated-user-1760624947130',
            type: 'default',
            source: 'check-bonus-exists',
            target: 'success-activated-user',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-add-welcome-bonus-success-activated-user-1760624947131',
            type: 'default',
            source: 'add-welcome-bonus',
            target: 'success-activated-user',
            animated: true
          },
          {
            id: 'edge-already-active-message-end-node-1760624947133',
            type: 'default',
            source: 'already-active-message',
            target: 'end-node',
            animated: true
          },
          {
            id: 'edge-success-activated-user-end-node-1760624947134',
            type: 'default',
            source: 'success-activated-user',
            target: 'end-node',
            animated: true
          },
          {
            id: 'edge-website-registration-required-end-node-1760624947135',
            type: 'default',
            source: 'website-registration-required',
            target: 'end-node',
            animated: true
          },
          {
            id: 'edge-check-again-trigger-request-contact-confirmation',
            type: 'default',
            source: 'check-again-trigger',
            target: 'request-contact-confirmation',
            animated: true
          },
          {
            id: 'edge-menu-balance-trigger-show-balance-details',
            type: 'default',
            source: 'menu-balance-trigger',
            target: 'show-balance-details',
            animated: true
          },
          {
            id: 'edge-menu-history-trigger-show-history-list',
            type: 'default',
            source: 'menu-history-trigger',
            target: 'show-history-list',
            animated: true
          },
          {
            id: 'edge-menu-level-trigger-show-level-info',
            type: 'default',
            source: 'menu-level-trigger',
            target: 'show-level-info',
            animated: true
          },
          {
            id: 'edge-menu-referrals-trigger-show-referrals-stats',
            type: 'default',
            source: 'menu-referrals-trigger',
            target: 'show-referrals-stats',
            animated: true
          },
          {
            id: 'edge-menu-invite-trigger-show-invite-info',
            type: 'default',
            source: 'menu-invite-trigger',
            target: 'show-invite-info',
            animated: true
          },
          {
            id: 'edge-menu-help-trigger-show-help-info',
            type: 'default',
            source: 'menu-help-trigger',
            target: 'show-help-info',
            animated: true
          },
          {
            id: 'edge-menu-main-trigger-active-user-profile',
            type: 'default',
            source: 'menu-main-trigger',
            target: 'active-user-profile',
            animated: true
          },
          {
            id: 'edge-back-to-menu-trigger-active-user-profile',
            type: 'default',
            source: 'back-to-menu-trigger',
            target: 'active-user-profile',
            animated: true
          }
        ],
        variables: [
          {
            id: 'telegramUser',
            name: 'telegramUser',
            type: 'object',
            description: 'Данные пользователя по Telegram ID',
            defaultValue: null
          },
          {
            id: 'contactUser',
            name: 'contactUser',
            type: 'object',
            description: 'Данные пользователя по контакту/email',
            defaultValue: null
          },
          {
            id: 'hasWelcomeBonus',
            name: 'hasWelcomeBonus',
            type: 'boolean',
            description: 'Есть ли приветственные бонусы',
            defaultValue: false
          }
        ],
        settings: {
          autoSave: true,
          gridSnap: true,
          retryAttempts: 3,
          maxExecutionTime: 60000
        }
      },

      features: [
        'Проверка статуса пользователя',
        'Автоматическое начисление приветственных бонусов',
        'Регистрация через контакт/email',
        'Меню с балансом, историей, уровнем',
        'Реферальная программа',
        'Защита от повторного начисления'
      ],
      integrations: ['Telegram', 'Database', 'Webhook'],
      useCases: [
        'Программа лояльности',
        'Бонусная система',
        'Реферальная программа'
      ],
      installs: 0,
      rating: 0,
      reviews: 0,
      author: 'SaaS Bonus System',
      version: '2.2.0',
      createdAt: new Date('2025-10-31'),
      updatedAt: new Date('2025-01-30'),
      isPublic: true
    };

    // Шаблон с проверкой подписки на канал
    const loyaltySystemWithChannelTemplate: BotTemplate = {
      id: 'loyalty_system_with_channel',
      name: 'Система лояльности с подпиской',
      description:
        'Система лояльности с обязательной подпиской на канал. Приветственные бонусы начисляются только после подтверждения подписки на канал.',
      category: 'loyalty',
      difficulty: 'advanced',
      tags: [
        'loyalty',
        'bonuses',
        'channel',
        'subscription',
        'registration',
        'contact',
        'welcome-bonus'
      ],
      estimatedTime: 45,
      icon: '📺',
      color: '#8b5cf6',

      workflowConfig: {
        name: 'Система лояльности с подпиской',
        description:
          'Система лояльности с обязательной подпиской на канал. Приветственные бонусы начисляются только после подтверждения подписки на канал.',
        nodes: [
          {
            id: 'start-trigger',
            data: {
              label: 'Команда /start',
              config: {
                'trigger.command': {
                  command: '/start'
                }
              }
            },
            type: 'trigger.command',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-telegram-user',
            data: {
              label: 'Проверить по Telegram ID',
              config: {
                'action.database_query': {
                  query: 'check_user_by_telegram',
                  assignTo: 'telegramUser',
                  parameters: {
                    projectId: '{{projectId}}',
                    telegramId: '{{telegram.userId}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 406,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-user-status',
            data: {
              label: 'Пользователь найден?',
              config: {
                condition: {
                  operator: 'is_not_empty',
                  variable: 'telegramUser'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 812,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-user-active',
            data: {
              label: 'Пользователь активен?',
              config: {
                condition: {
                  value: true,
                  operator: 'equals',
                  variable: 'telegramUser.isActive'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 1218,
              y: 0
            },
            selected: false
          },
          {
            id: 'active-user-profile',
            data: {
              label: 'Профиль активного пользователя',
              config: {
                message: {
                  text: '👋 Добро пожаловать назад, <b>{user.firstName}</b>!\n\n💵 Ваш баланс бонусов: <b>{user.balanceFormatted}</b>\n📊 Всего заработано: <b>{user.totalEarnedFormatted}</b>\n🛒 Потрачено: <b>{user.totalSpentFormatted}</b>\n🏆 Истекает в ближайшие 30 дней: <b>{user.expiringBonusesFormatted}</b>\n\nВыберите действие:',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '💰 Баланс',
                          callback_data: 'menu_balance'
                        },
                        {
                          text: '📜 История',
                          callback_data: 'menu_history'
                        }
                      ],
                      [
                        {
                          text: '🏆 Уровень',
                          callback_data: 'menu_level'
                        },
                        {
                          text: '👥 Рефералы',
                          callback_data: 'menu_referrals'
                        }
                      ],
                      [
                        {
                          text: '🔗 Пригласить',
                          callback_data: 'menu_invite'
                        },
                        {
                          text: '❓ Помощь',
                          callback_data: 'menu_help'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 1624,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'welcome-message',
            data: {
              label: 'Приветствие',
              config: {
                message: {
                  text: '🎁 Добро пожаловать в программу лояльности!\n\n📺 Для получения приветственных бонусов необходимо:\n1️⃣ Подписаться на наш канал\n2️⃣ Поделиться контактом или ввести email\n\n💰 После выполнения условий вы получите бонусы!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '📺 Подписаться на канал',
                          url: 'https://t.me/{{project.telegramChannel}}'
                        }
                      ],
                      [
                        {
                          text: '✅ Я подписался',
                          callback_data: 'check_subscription'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 1624,
              y: 625
            },
            selected: false
          },
          {
            id: 'check-subscription-trigger',
            data: {
              label: 'Триггер: проверить подписку',
              config: {
                'trigger.callback': {
                  callbackData: 'check_subscription'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 2030,
              y: 625
            },
            selected: false
          },
          {
            id: 'check-channel-subscription',
            data: {
              label: 'Проверить подписку на канал',
              config: {
                'action.check_channel_subscription': {
                  channelId: '@{{project.telegramChannel}}',
                  assignTo: 'isChannelSubscribed'
                }
              }
            },
            type: 'action.check_channel_subscription',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 2436,
              y: 625
            },
            selected: false
          },
          {
            id: 'check-subscription-result',
            data: {
              label: 'Подписан на канал?',
              config: {
                condition: {
                  value: true,
                  operator: 'equals',
                  variable: 'isChannelSubscribed'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 2842,
              y: 625
            },
            selected: false
          },
          {
            id: 'subscription-required-message',
            data: {
              label: 'Требуется подписка',
              config: {
                message: {
                  text: '❌ Вы не подписаны на канал!\n\n📺 Для получения бонусов обязательно подпишитесь на наш канал и нажмите "Проверить снова".',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '📺 Подписаться на канал',
                          url: 'https://t.me/{{project.telegramChannel}}'
                        }
                      ],
                      [
                        {
                          text: '🔄 Проверить снова',
                          callback_data: 'check_subscription'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 3248,
              y: 800
            },
            selected: false
          },
          {
            id: 'request-contact-after-subscription',
            data: {
              label: 'Запросить контакт после подписки',
              config: {
                message: {
                  text: '✅ Отлично! Вы подписаны на канал.\n\n📱 Теперь поделитесь контактом или введите email для активации бонусов:',
                  keyboard: {
                    type: 'reply',
                    buttons: [
                      [
                        {
                          text: '📱 Поделиться контактом',
                          request_contact: true
                        }
                      ],
                      [
                        {
                          text: '✉️ Ввести email'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 3248,
              y: 450
            },
            selected: false
          },
          {
            id: 'request-contact-confirmation',
            data: {
              label: 'Запросить подтверждение контакта',
              config: {
                message: {
                  text: '🔍 Мы нашли ваш аккаунт, но он неактивен.\n\n📱 Для активации поделитесь контактом или введите email:\n\n• Нажмите кнопку для отправки контакта\n• Или введите ваш email вручную',
                  keyboard: {
                    type: 'reply',
                    buttons: [
                      [
                        {
                          text: 'Поделиться контактом',
                          request_contact: true
                        }
                      ],
                      [
                        {
                          text: 'Ввести email',
                          callback_data: 'enter_email'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 1624,
              y: 0
            },
            selected: false
          },
          {
            id: 'enter-email-trigger',
            data: {
              label: 'Триггер: ручной ввод email',
              config: {
                'trigger.callback': {
                  callbackData: 'enter_email'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 1218,
              y: -200
            },
            selected: false
          },
          {
            id: 'enter-email-instructions',
            data: {
              label: 'Запросить email вручную',
              config: {
                message: {
                  text: '✉️ Пожалуйста, укажите email, который использовался на сайте.\n\nПросто отправьте его сообщением в ответ на это сообщение. Если ошиблись — введите ещё раз.',
                  keyboard: {
                    type: 'reply',
                    one_time_keyboard: true,
                    buttons: [
                      [
                        {
                          text: 'Отмена'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 2030,
              y: -200
            },
            selected: false
          },
          {
            id: 'check-contact-user',
            data: {
              label: 'Проверить по контакту/email',
              config: {
                'action.database_query': {
                  query: 'check_user_by_contact',
                  assignTo: 'contactUser',
                  parameters: {
                    email: '{{telegram.message.text}}',
                    phone: '{{contactReceived.phoneNumber}}',
                    projectId: '{{projectId}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 3654,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-contact-found',
            data: {
              label: 'Контакт найден?',
              config: {
                condition: {
                  operator: 'is_not_empty',
                  variable: 'contactUser'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 4060,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-telegram-already-linked',
            data: {
              label: 'Telegram уже привязан?',
              config: {
                condition: {
                  operator: 'is_not_empty',
                  variable: 'contactUser.telegramId'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 4466,
              y: 186.5
            },
            selected: false
          },
          {
            id: 'already-active-message',
            data: {
              label: 'Уже активирован',
              config: {
                message: {
                  text: '✅ Ваш аккаунт уже активирован!\n\n💰 Текущий баланс: {user.balanceFormatted}\n📊 Уровень: {user.currentLevel}\n🎁 Реферальный код: {user.referralCode}\n\n🛍️ Продолжайте делать покупки и копить бонусы!'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 5496,
              y: 55.5
            },
            selected: false
          },
          {
            id: 'activate-user',
            data: {
              label: 'Активировать пользователя',
              config: {
                'action.database_query': {
                  query: 'activate_user',
                  parameters: {
                    userId: '{{contactUser.id}}',
                    telegramId: '{{telegram.userId}}',
                    telegramUsername: '{{telegram.username}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 4872,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-welcome-bonus',
            data: {
              label: 'Проверить приветственные бонусы',
              config: {
                'action.database_query': {
                  query: 'check_welcome_bonus',
                  assignTo: 'hasWelcomeBonus',
                  parameters: {
                    userId: '{{contactUser.id}}'
                  }
                }
              }
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 5278,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'check-bonus-exists',
            data: {
              label: 'Есть приветственные бонусы?',
              config: {
                condition: {
                  value: false,
                  operator: 'equals',
                  variable: 'hasWelcomeBonus'
                }
              }
            },
            type: 'condition',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 5684,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'add-welcome-bonus',
            data: {
              label: 'Начислить приветственные бонусы',
              config: {
                'action.database_query': {
                  query: 'add_bonus',
                  assignTo: '',
                  parameters: {
                    type: 'WELCOME',
                    amount: '{{project.referralProgram.welcomeBonus}}',
                    userId: '{{contactUser.id}}',
                    expiresAt: '',
                    description:
                      'Приветственные бонусы за подписку на канал и активацию аккаунта'
                  },
                  resultMapping: {}
                }
              },
              description: ''
            },
            type: 'action.database_query',
            dragging: false,
            measured: {
              width: 256,
              height: 162
            },
            position: {
              x: 6090,
              y: 242
            },
            selected: false
          },
          {
            id: 'success-activated-user',
            data: {
              label: 'Успешная активация с бонусами',
              config: {
                message: {
                  text: '🎉 Аккаунт успешно активирован!\n\n💰 Вам начислены приветственные бонусы за подписку на канал!\n\n📊 Ваш профиль:\n• Баланс: {user.balanceFormatted}\n• Уровень: {user.currentLevel}\n• Реферальный код: {user.referralCode}\n\n✨ Добро пожаловать в программу лояльности!'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 6496,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'website-registration-required',
            data: {
              label: 'Требуется регистрация на сайте',
              config: {
                message: {
                  text: '🌐 Для участия в программе лояльности необходимо зарегистрироваться на нашем сайте.\n\n📝 Пожалуйста, перейдите по ссылке и создайте аккаунт:\n\n🔗 https://your-website.com/register\n\n✨ После регистрации вернитесь к боту и поделитесь контактом для активации бонусов!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          url: 'https://your-website.com/register',
                          text: '🌐 Зарегистрироваться на сайте'
                        }
                      ],
                      [
                        {
                          text: '🔄 Проверить снова',
                          callback_data: 'check_again'
                        }
                      ]
                    ]
                  }
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 6496,
              y: 549.5
            },
            selected: false
          },
          {
            id: 'check-again-trigger',
            data: {
              label: 'Триггер: проверить снова',
              config: {
                'trigger.callback': {
                  callbackData: 'check_again'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 6904,
              y: 780
            },
            selected: false
          },
          {
            id: 'end-node',
            data: {
              label: 'Завершение',
              config: {
                'flow.end': {}
              }
            },
            type: 'flow.end',
            dragging: false,
            measured: {
              width: 256,
              height: 78
            },
            position: {
              x: 6902,
              y: 307.5
            },
            selected: false
          },
          {
            id: 'menu-balance-trigger',
            data: {
              label: 'Триггер: Баланс',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_balance'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 549.5
            },
            selected: false
          },
          {
            id: 'show-balance-details',
            data: {
              label: 'Показать баланс',
              config: {
                message: {
                  text: '<b>💰 Ваш баланс бонусов</b>\n\n💵 <b>Текущий баланс:</b> {user.balanceFormatted}\n📈 <b>Всего заработано:</b> {user.totalEarnedFormatted}\n📉 <b>Всего потрачено:</b> {user.totalSpentFormatted}\n🛍️ <b>Покупок на сумму:</b> {user.totalPurchasesFormatted}\n\n✨ Продолжайте совершать покупки для накопления бонусов!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 549.5
            },
            selected: false
          },
          {
            id: 'menu-history-trigger',
            data: {
              label: 'Триггер: История',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_history'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 791.5
            },
            selected: false
          },
          {
            id: 'show-history-list',
            data: {
              label: 'Показать историю',
              config: {
                message: {
                  text: '<b>📜 История операций</b>\n\n<b>Последние 10 операций:</b>\n\n{transactions.formatted}\n\nПоказаны последние 10 операций.\n\n💡 Для полной истории посетите личный кабинет на сайте.',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 791.5
            },
            selected: false
          },
          {
            id: 'menu-level-trigger',
            data: {
              label: 'Триггер: Уровень',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_level'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 1033.5
            },
            selected: false
          },
          {
            id: 'show-level-info',
            data: {
              label: 'Показать уровень',
              config: {
                message: {
                  text: '<b>🏆 Ваш уровень:</b> {user.currentLevel}\n\n<b>📊 Прогресс к следующему уровню:</b>\n{user.progressBar} ({user.progressPercent}%)\n\n<b>💰 Бонусный процент:</b> {user.levelBonusPercent}%\n<b>💵 Процент оплаты бонусами:</b> {user.levelPaymentPercent}%\n\n<b>Следующий уровень:</b> {user.nextLevelName}\n<b>Нужно покупок на сумму:</b> {user.nextLevelAmountFormatted}\n\n🎯 Продолжайте совершать покупки для повышения уровня!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 1033.5
            },
            selected: false
          },
          {
            id: 'menu-referrals-trigger',
            data: {
              label: 'Триггер: Рефералы',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_referrals'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 0,
              y: 1275.5
            },
            selected: false
          },
          {
            id: 'show-referrals-stats',
            data: {
              label: 'Показать рефералы',
              config: {
                message: {
                  text: '<b>👥 Реферальная программа</b>\n\n<b>📊 Статистика по проекту:</b>\n👤 <b>Приглашено пользователей:</b> {user.referralCount}\n💰 <b>Бонусов от рефералов:</b> {user.referralBonusTotalFormatted}\n\n<b>🔗 Ваша реферальная ссылка:</b>\n{user.referralLink}\n\n📱 Поделитесь ссылкой с друзьями и получайте бонусы за их покупки!\n\n💡 Приглашайте друзей и зарабатывайте вместе!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 1275.5
            },
            selected: false
          },
          {
            id: 'menu-invite-trigger',
            data: {
              label: 'Триггер: Пригласить',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_invite'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 0,
              y: 1517.5
            },
            selected: false
          },
          {
            id: 'show-invite-info',
            data: {
              label: 'Показать приглашение',
              config: {
                message: {
                  text: '<b>🔗 Пригласите друзей и получайте бонусы!</b>\n\nПоделитесь персональной ссылкой и получайте вознаграждение за каждую покупку приглашённых пользователей.\n\n<b>Ваша ссылка:</b>\n{user.referralLink}\n\n1️⃣ Скопируйте ссылку\n2️⃣ Отправьте друзьям в мессенджерах или соцсетях\n3️⃣ Получайте бонусы автоматически\n\n🎁 Больше друзей — больше бонусов!',
                  keyboard: {
                    type: 'inline',
                    buttons: [
                      [
                        {
                          text: '⬅️ Назад в меню',
                          callback_data: 'back_to_menu'
                        }
                      ]
                    ]
                  },
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 224
            },
            position: {
              x: 406,
              y: 1517.5
            },
            selected: false
          },
          {
            id: 'menu-help-trigger',
            data: {
              label: 'Триггер: Помощь',
              config: {
                'trigger.callback': {
                  callbackData: 'menu_help'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 122
            },
            position: {
              x: 0,
              y: 1759.5
            },
            selected: false
          },
          {
            id: 'show-help-info',
            data: {
              label: 'Показать помощь',
              config: {
                message: {
                  text: '<b>❓ Помощь</b>\n\n<b>🎯 Как работает бонусная система:</b>\n\n💰 <b>Бонусы</b> - накапливайте бонусы за покупки\n🛒 <b>Списание</b> - оплачивайте часть покупки бонусами\n🏆 <b>Уровни</b> - повышайте уровень для лучших условий\n👥 <b>Рефералы</b> - приглашайте друзей и получайте бонусы\n\n<b>📱 Команды:</b>\n• /start - начать работу с ботом\n• 💰 Баланс - посмотреть текущий баланс\n• 📜 История - история операций\n• 🏆 Уровень - ваш текущий уровень\n• 👥 Рефералы - реферальная программа\n• 🔗 Пригласить - пригласить друга\n\n💬 Если возникли вопросы, напишите в поддержку!',
                  parseMode: 'HTML'
                }
              }
            },
            type: 'message',
            dragging: false,
            measured: {
              width: 320,
              height: 204
            },
            position: {
              x: 406,
              y: 1759.5
            },
            selected: false
          },
          {
            id: 'back-to-menu-trigger',
            data: {
              label: 'Триггер: Назад в меню',
              config: {
                'trigger.callback': {
                  callbackData: 'back_to_menu'
                }
              }
            },
            type: 'trigger.callback',
            dragging: false,
            measured: {
              width: 256,
              height: 142
            },
            position: {
              x: 1218,
              y: 494
            },
            selected: false
          }
        ],
        connections: [
          {
            id: 'edge-start-trigger-check-telegram-user',
            type: 'default',
            source: 'start-trigger',
            target: 'check-telegram-user',
            animated: true
          },
          {
            id: 'edge-check-telegram-user-check-user-status',
            type: 'default',
            source: 'check-telegram-user',
            target: 'check-user-status',
            animated: true
          },
          {
            id: 'edge-check-user-status-check-user-active',
            type: 'default',
            source: 'check-user-status',
            target: 'check-user-active',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-user-status-welcome-message',
            type: 'default',
            source: 'check-user-status',
            target: 'welcome-message',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-check-user-active-active-user-profile',
            type: 'default',
            source: 'check-user-active',
            target: 'active-user-profile',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-user-active-request-contact-confirmation',
            type: 'default',
            source: 'check-user-active',
            target: 'request-contact-confirmation',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-check-subscription-trigger-check-channel-subscription',
            type: 'default',
            source: 'check-subscription-trigger',
            target: 'check-channel-subscription',
            animated: true
          },
          {
            id: 'edge-check-channel-subscription-check-subscription-result',
            type: 'default',
            source: 'check-channel-subscription',
            target: 'check-subscription-result',
            animated: true
          },
          {
            id: 'edge-check-subscription-result-request-contact-after-subscription',
            type: 'default',
            source: 'check-subscription-result',
            target: 'request-contact-after-subscription',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-subscription-result-subscription-required-message',
            type: 'default',
            source: 'check-subscription-result',
            target: 'subscription-required-message',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-request-contact-after-subscription-check-contact-user',
            type: 'default',
            source: 'request-contact-after-subscription',
            target: 'check-contact-user',
            animated: true
          },
          {
            id: 'edge-request-contact-confirmation-check-contact-user',
            type: 'default',
            source: 'request-contact-confirmation',
            target: 'check-contact-user',
            animated: true
          },
          {
            id: 'edge-enter-email-trigger-enter-email-instructions',
            type: 'default',
            source: 'enter-email-trigger',
            target: 'enter-email-instructions',
            animated: true
          },
          {
            id: 'edge-enter-email-instructions-check-contact-user',
            type: 'default',
            source: 'enter-email-instructions',
            target: 'check-contact-user',
            animated: true
          },
          {
            id: 'edge-check-contact-user-check-contact-found',
            type: 'default',
            source: 'check-contact-user',
            target: 'check-contact-found',
            animated: true
          },
          {
            id: 'edge-check-contact-found-check-telegram-already-linked',
            type: 'default',
            source: 'check-contact-found',
            target: 'check-telegram-already-linked',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-contact-found-website-registration-required',
            type: 'default',
            source: 'check-contact-found',
            target: 'website-registration-required',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-check-telegram-already-linked-already-active-message',
            type: 'default',
            source: 'check-telegram-already-linked',
            target: 'already-active-message',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-telegram-already-linked-activate-user',
            type: 'default',
            source: 'check-telegram-already-linked',
            target: 'activate-user',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-activate-user-check-welcome-bonus',
            type: 'default',
            source: 'activate-user',
            target: 'check-welcome-bonus',
            animated: true
          },
          {
            id: 'edge-check-welcome-bonus-check-bonus-exists',
            type: 'default',
            source: 'check-welcome-bonus',
            target: 'check-bonus-exists',
            animated: true
          },
          {
            id: 'edge-check-bonus-exists-add-welcome-bonus',
            type: 'default',
            source: 'check-bonus-exists',
            target: 'add-welcome-bonus',
            animated: true,
            sourceHandle: 'true'
          },
          {
            id: 'edge-check-bonus-exists-success-activated-user',
            type: 'default',
            source: 'check-bonus-exists',
            target: 'success-activated-user',
            animated: true,
            sourceHandle: 'false'
          },
          {
            id: 'edge-add-welcome-bonus-success-activated-user',
            type: 'default',
            source: 'add-welcome-bonus',
            target: 'success-activated-user',
            animated: true
          },
          {
            id: 'edge-already-active-message-end-node',
            type: 'default',
            source: 'already-active-message',
            target: 'end-node',
            animated: true
          },
          {
            id: 'edge-success-activated-user-end-node',
            type: 'default',
            source: 'success-activated-user',
            target: 'end-node',
            animated: true
          },
          {
            id: 'edge-website-registration-required-end-node',
            type: 'default',
            source: 'website-registration-required',
            target: 'end-node',
            animated: true
          },
          {
            id: 'edge-check-again-trigger-request-contact-confirmation',
            type: 'default',
            source: 'check-again-trigger',
            target: 'request-contact-confirmation',
            animated: true
          },
          {
            id: 'edge-menu-balance-trigger-show-balance-details',
            type: 'default',
            source: 'menu-balance-trigger',
            target: 'show-balance-details',
            animated: true
          },
          {
            id: 'edge-menu-history-trigger-show-history-list',
            type: 'default',
            source: 'menu-history-trigger',
            target: 'show-history-list',
            animated: true
          },
          {
            id: 'edge-menu-level-trigger-show-level-info',
            type: 'default',
            source: 'menu-level-trigger',
            target: 'show-level-info',
            animated: true
          },
          {
            id: 'edge-menu-referrals-trigger-show-referrals-stats',
            type: 'default',
            source: 'menu-referrals-trigger',
            target: 'show-referrals-stats',
            animated: true
          },
          {
            id: 'edge-menu-invite-trigger-show-invite-info',
            type: 'default',
            source: 'menu-invite-trigger',
            target: 'show-invite-info',
            animated: true
          },
          {
            id: 'edge-menu-help-trigger-show-help-info',
            type: 'default',
            source: 'menu-help-trigger',
            target: 'show-help-info',
            animated: true
          },
          {
            id: 'edge-back-to-menu-trigger-active-user-profile',
            type: 'default',
            source: 'back-to-menu-trigger',
            target: 'active-user-profile',
            animated: true
          }
        ],
        variables: [
          {
            id: 'telegramUser',
            name: 'telegramUser',
            type: 'object',
            description: 'Данные пользователя по Telegram ID',
            defaultValue: null
          },
          {
            id: 'contactUser',
            name: 'contactUser',
            type: 'object',
            description: 'Данные пользователя по контакту/email',
            defaultValue: null
          },
          {
            id: 'hasWelcomeBonus',
            name: 'hasWelcomeBonus',
            type: 'boolean',
            description: 'Есть ли приветственные бонусы',
            defaultValue: false
          },
          {
            id: 'isChannelSubscribed',
            name: 'isChannelSubscribed',
            type: 'boolean',
            description: 'Подписан ли пользователь на канал',
            defaultValue: false
          }
        ],
        settings: {
          autoSave: true,
          gridSnap: true,
          retryAttempts: 3,
          maxExecutionTime: 60000
        }
      },

      features: [
        'Проверка подписки на канал',
        'Проверка статуса пользователя',
        'Автоматическое начисление приветственных бонусов',
        'Регистрация через контакт/email',
        'Защита от повторного начисления',
        'Использование настроек проекта для суммы бонусов'
      ],
      integrations: ['Telegram', 'Database', 'Webhook', 'Channel Subscription'],
      useCases: [
        'Программа лояльности с подпиской',
        'Бонусная система',
        'Привлечение подписчиков канала'
      ],
      installs: 0,
      rating: 0,
      reviews: 0,
      author: 'SaaS Bonus System',
      version: '1.0.0',
      createdAt: new Date('2025-12-23'),
      updatedAt: new Date('2025-12-23'),
      isPublic: true
    };

    this.templates = [loyaltySystemTemplate, loyaltySystemWithChannelTemplate];

    logger.info('Bot templates initialized', { count: this.templates.length });
  }

  /**
   * Удалить шаблон по ID
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const index = this.templates.findIndex((t) => t.id === templateId);

      if (index === -1) {
        logger.warn('Template not found for deletion', { templateId });
        return false;
      }

      const template = this.templates[index];
      this.templates.splice(index, 1);

      logger.info('Template deleted', {
        templateId,
        templateName: template.name
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete template', {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Экспорт синглтона
export { BotTemplatesService };
export const botTemplates = new BotTemplatesService();
