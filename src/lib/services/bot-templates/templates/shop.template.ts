import { BotTemplate } from '../bot-templates.service';

export const shopTemplate: BotTemplate = {
  id: 'mini_shop',
  name: 'Витрина товаров',
  description:
    'Простой каталог товаров с корзиной и оформлением заказа. Идеально для небольших магазинов и кафе.',
  category: 'ecommerce',
  difficulty: 'intermediate',
  tags: ['shop', 'cart', 'orders', 'catalog', 'ecommerce'],
  estimatedTime: 45,
  icon: '🛍️',
  color: '#f59e0b',

  features: [
    'Каталог товаров по категориям',
    'Корзина покупок',
    'Оформление заказа',
    'Отправка заявки менеджеру',
    'Уведомления о статусе заказа'
  ],
  integrations: ['Google Sheets', 'Email Notifications'],
  useCases: [
    'Магазин одежды',
    'Доставка еды',
    'Цветочный магазин',
    'Продажа цифровых товаров'
  ],

  installs: 0,
  rating: 4.8,
  reviews: 12,
  author: 'Gupil Team',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: true,

  workflowConfig: {
    name: 'Витрина товаров',
    description: 'Магазин с каталогом и корзиной',
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 0, y: 0 },
        data: {
          label: 'Старт',
          config: {
            command: { command: 'start', description: 'Запустить магазин' }
          }
        }
      },
      {
        id: 'main-menu',
        type: 'message',
        position: { x: 0, y: 150 },
        data: {
          label: 'Главное меню',
          config: {
            message: {
              text: '👋 Добро пожаловать в наш магазин!\n\nВыберите категорию товаров:',
              keyboard: {
                type: 'inline',
                buttons: [
                  [
                    { text: '👕 Одежда', callbackData: 'cat_clothing' },
                    { text: '👟 Обувь', callbackData: 'cat_shoes' }
                  ],
                  [
                    { text: '🛒 Корзина', callbackData: 'cart_view' },
                    { text: '📦 Мои заказы', callbackData: 'orders_list' }
                  ],
                  [{ text: 'ℹ️ О нас', callbackData: 'about' }]
                ]
              }
            }
          }
        }
      }
      // ... (Здесь будет полная структура нод для магазина, сократил для примера первого файла)
    ],
    connections: [
      { id: 'c1', source: 'start', target: 'main-menu', type: 'default' }
    ],
    variables: [
      { name: 'cart', type: 'array', defaultValue: [] },
      { name: 'totalAmount', type: 'number', defaultValue: 0 }
    ],
    settings: {}
  }
};
