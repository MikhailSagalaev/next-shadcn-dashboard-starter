import { BotTemplate } from '../bot-templates.service';

export const feedbackTemplate: BotTemplate = {
  id: 'feedback_loop',
  name: 'Сбор отзывов за бонусы',
  description:
    'Автоматизированный сбор обратной связи. Клиенты получают бонусы за оставленные отзывы.',
  category: 'survey',
  difficulty: 'beginner',
  tags: ['feedback', 'rating', 'bonuses', 'loyalty', 'reviews'],
  estimatedTime: 15,
  icon: '⭐',
  color: '#8b5cf6',

  features: [
    'Оценка качества (1-5 звезд)',
    'Сбор текстовых отзывов',
    'Начисление бонусов за отзыв',
    'Мгновенное уведомление о негативе',
    'Благодарность клиенту'
  ],
  integrations: ['Internal CRM', 'Telegram Notifications'],
  useCases: ['Рестораны', 'Салоны красоты', 'Службы доставки', 'Мероприятия'],

  installs: 0,
  rating: 4.9,
  reviews: 45,
  author: 'Gupil Team',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: true,

  workflowConfig: {
    name: 'Сбор отзывов',
    description: 'Оставьте отзыв и получите бонусы',
    nodes: [],
    connections: [],
    variables: [],
    settings: {}
  }
};
