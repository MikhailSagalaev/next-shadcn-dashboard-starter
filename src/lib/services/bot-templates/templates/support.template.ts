import { BotTemplate } from '../bot-templates.service';

export const supportTemplate: BotTemplate = {
  id: 'smart_support',
  name: 'Умная техподдержка',
  description:
    'Бот первой линии поддержки с базой знаний (FAQ) и возможностью вызова оператора.',
  category: 'customer_support',
  difficulty: 'intermediate',
  tags: ['support', 'faq', 'helpdesk', 'automation', 'service'],
  estimatedTime: 40,
  icon: '🆘',
  color: '#3b82f6',

  features: [
    'База знаний (FAQ) по категориям',
    'Поиск ответов по ключевым словам',
    'Создание тикета поддержки',
    'Переключение на живого оператора',
    'Оценка качества ответа'
  ],
  integrations: ['Zendesk', 'Jira', 'Telegram Admin Group'],
  useCases: [
    'SaaS сервисы',
    'Банкинг',
    'Интернет-провайдеры',
    'Сервисные центры'
  ],

  installs: 0,
  rating: 4.6,
  reviews: 18,
  author: 'Gupil Team',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: true,

  workflowConfig: {
    name: 'Техподдержка',
    description: 'FAQ и создание тикетов',
    nodes: [],
    connections: [],
    variables: [],
    settings: {}
  }
};
