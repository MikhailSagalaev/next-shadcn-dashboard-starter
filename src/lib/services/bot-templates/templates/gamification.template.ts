import { BotTemplate } from '../bot-templates.service';

export const gamificationTemplate: BotTemplate = {
  id: 'daily_reward_game',
  name: 'Колесо фортуны',
  description:
    'Ежедневная лотерея для пользователей. Повышает вовлеченность (Retention rate) и раздает бонусы.',
  category: 'entertainment',
  difficulty: 'advanced',
  tags: ['game', 'retention', 'daily', 'rewards', 'loyalty'],
  estimatedTime: 60,
  icon: '🎡',
  color: '#8b5cf6',

  features: [
    'Механика "Ежедневная награда"',
    'Случайный выбор приза (веса вероятности)',
    'Проверка таймера (раз в 24 часа)',
    'Начисление выигрыша на баланс',
    'Вирусная механика (приведи друга для доп. попытки)'
  ],
  integrations: ['Bonus System', 'User Profile'],
  useCases: ['Мобильные приложения', 'Ритейл', 'Кофейни', 'Клубы'],

  installs: 0,
  rating: 5.0,
  reviews: 32,
  author: 'Gupil Team',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: true,

  workflowConfig: {
    name: 'Колесо фортуны',
    description: 'Ежедневная раздача призов',
    nodes: [],
    connections: [],
    variables: [],
    settings: {}
  }
};
