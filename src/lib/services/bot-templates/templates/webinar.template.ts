import { BotTemplate } from '../bot-templates.service';

export const webinarTemplate: BotTemplate = {
  id: 'webinar_registration',
  name: 'Регистрация на вебинар',
  description:
    'Простая воронка для регистрации участников на мероприятие с напоминаниями.',
  category: 'booking',
  difficulty: 'beginner',
  tags: ['webinar', 'event', 'registration', 'reminders', 'marketing'],
  estimatedTime: 20,
  icon: '📅',
  color: '#ec4899',

  features: [
    'Презентация мероприятия',
    'Сбор контактов участников',
    'Отправка ссылки на вход',
    'Напоминания (за день, за час)',
    'Рассылка материалов после эфира'
  ],
  integrations: ['Google Calendar', 'Zoom/Kinescope'],
  useCases: [
    'Онлайн-школы',
    'Конференции',
    'Презентации продуктов',
    'Мастер-классы'
  ],

  installs: 0,
  rating: 4.7,
  reviews: 28,
  author: 'Gupil Team',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: true,

  workflowConfig: {
    name: 'Регистрация на вебинар',
    description: 'Воронка регистрации и прогрева',
    nodes: [],
    connections: [],
    variables: [],
    settings: {}
  }
};
