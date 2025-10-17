# 🔘 Гайд по кнопкам в конструкторе ботов

**Проект:** SaaS Bonus System  
**Дата:** 2025-10-14  
**Автор:** AI Assistant + User

---

## 📋 Оглавление
1. [Типы кнопок](#типы-кнопок)
2. [Reply Keyboard (кнопки под полем ввода)](#reply-keyboard)
3. [Inline Keyboard (кнопки под сообщением)](#inline-keyboard)
4. [Примеры использования](#примеры-использования)
5. [FAQ и troubleshooting](#faq)

---

## 🎯 Типы кнопок

В Telegram существует **два типа** кнопок:

| Тип | Внешний вид | Использование | Node Type |
|-----|-------------|---------------|-----------|
| **Reply Keyboard** | Под полем ввода (вместо клавиатуры) | Запрос контакта, локации, опросы | `message.keyboard.reply` |
| **Inline Keyboard** | Под сообщением | Навигация, callback actions, URL | `message.keyboard.inline` |

---

## 📱 Reply Keyboard

### Когда использовать:
- ✅ Запрос номера телефона (`request_contact`)
- ✅ Запрос геолокации (`request_location`)
- ✅ Создание опроса (`request_poll`)
- ✅ Постоянное меню (Main menu)

### Структура ноды:

```json
{
  "id": "welcome-with-button",
  "type": "message.keyboard.reply",
  "data": {
    "label": "Приветствие с кнопкой",
    "config": {
      "message.keyboard.reply": {
        "text": "Текст сообщения",
        "keyboard": [
          [
            {
              "text": "📱 Поделиться номером",
              "request_contact": true
            }
          ],
          [
            {
              "text": "📍 Отправить локацию",
              "request_location": true
            }
          ]
        ],
        "resize_keyboard": true,
        "one_time_keyboard": true
      }
    }
  }
}
```

### Параметры:

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `text` | string | Текст сообщения | ✅ |
| `keyboard` | array | Массив рядов кнопок | ✅ |
| `resize_keyboard` | boolean | Подогнать размер клавиатуры | ❌ (default: false) |
| `one_time_keyboard` | boolean | Скрыть клавиатуру после нажатия | ❌ (default: false) |

### Типы кнопок:

#### 1. Обычная текстовая кнопка
```json
{
  "text": "Главное меню"
}
```

#### 2. Запрос контакта
```json
{
  "text": "📱 Поделиться номером",
  "request_contact": true
}
```

#### 3. Запрос локации
```json
{
  "text": "📍 Моя геолокация",
  "request_location": true
}
```

#### 4. Создание опроса
```json
{
  "text": "📊 Создать опрос",
  "request_poll": {
    "type": "quiz"
  }
}
```

### Пример: Запрос контакта

```json
{
  "id": "request-phone",
  "type": "message.keyboard.reply",
  "data": {
    "config": {
      "message.keyboard.reply": {
        "text": "📱 Для регистрации нажмите кнопку ниже:",
        "keyboard": [
          [
            {
              "text": "📱 Поделиться номером телефона",
              "request_contact": true
            }
          ],
          [
            {
              "text": "❌ Отмена"
            }
          ]
        ],
        "resize_keyboard": true,
        "one_time_keyboard": true
      }
    }
  }
}
```

**Что происходит:**
1. Бот отправляет сообщение с кнопкой
2. Пользователь нажимает "Поделиться номером"
3. Telegram **автоматически** отправляет контакт
4. Бот получает сообщение с полем `contact`:
   ```json
   {
     "contact": {
       "phone_number": "+79001234567",
       "first_name": "Иван",
       "user_id": 123456789
     }
   }
   ```

**Как обработать контакт:**
- Контакт доступен в `context.telegram.contact`
- Или в `context.telegram.message.contact`

---

## 🔘 Inline Keyboard

### Когда использовать:
- ✅ Навигация по меню
- ✅ Callback actions (like, confirm, cancel)
- ✅ Ссылки (URL)
- ✅ Web App интеграция

### Структура ноды:

```json
{
  "id": "menu-message",
  "type": "message.keyboard.inline",
  "data": {
    "label": "Меню с inline кнопками",
    "config": {
      "message.keyboard.inline": {
        "text": "Выберите действие:",
        "buttons": [
          [
            {
              "text": "💰 Мои бонусы",
              "callback_data": "show_balance"
            },
            {
              "text": "📊 Статистика",
              "callback_data": "show_stats"
            }
          ],
          [
            {
              "text": "🌐 Наш сайт",
              "url": "https://example.com"
            }
          ]
        ]
      }
    }
  }
}
```

### Параметры:

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `text` | string | Текст сообщения | ✅ |
| `buttons` | array | Массив рядов кнопок | ✅ |

### Типы inline кнопок:

#### 1. Callback кнопка (action)
```json
{
  "text": "✅ Подтвердить",
  "callback_data": "confirm_action"
}
```

**Обработка:**
- Callback приходит в `context.telegram.callbackQuery.data`
- Используйте `trigger.callback` для обработки

#### 2. URL кнопка (ссылка)
```json
{
  "text": "🌐 Наш сайт",
  "url": "https://example.com"
}
```

#### 3. Web App кнопка
```json
{
  "text": "🎮 Открыть игру",
  "web_app": {
    "url": "https://app.example.com"
  }
}
```

#### 4. Login URL (OAuth)
```json
{
  "text": "🔐 Войти",
  "login_url": {
    "url": "https://example.com/auth",
    "forward_text": "Login to Example",
    "bot_username": "example_bot",
    "request_write_access": true
  }
}
```

### Пример: Меню выбора

```json
{
  "id": "main-menu",
  "type": "message.keyboard.inline",
  "data": {
    "config": {
      "message.keyboard.inline": {
        "text": "🎯 Главное меню",
        "buttons": [
          [
            {
              "text": "💰 Баланс бонусов",
              "callback_data": "balance"
            }
          ],
          [
            {
              "text": "📜 История",
              "callback_data": "history"
            },
            {
              "text": "🎁 Акции",
              "callback_data": "promotions"
            }
          ],
          [
            {
              "text": "🌐 Наш сайт",
              "url": "https://example.com"
            }
          ]
        ]
      }
    }
  }
}
```

**Как обработать callback:**
1. Создайте ноду `trigger.callback`
2. Настройте `callback_data` в триггере
3. Подключите к нужным actions

---

## 📚 Примеры использования

### Пример 1: Регистрация с запросом контакта

**Workflow:**
```
start-trigger 
  → welcome-message (message.keyboard.reply с кнопкой контакта)
  → check-user (action.database_query, использует context.telegram.contact)
  → condition (проверка существования пользователя)
  → create-user / show-existing-user
```

**Нода приветствия:**
```json
{
  "id": "welcome",
  "type": "message.keyboard.reply",
  "data": {
    "config": {
      "message.keyboard.reply": {
        "text": "👋 Добро пожаловать!\n\n📱 Поделитесь контактом для регистрации:",
        "keyboard": [
          [
            {
              "text": "📱 Поделиться номером",
              "request_contact": true
            }
          ]
        ],
        "resize_keyboard": true,
        "one_time_keyboard": true
      }
    }
  }
}
```

**⚠️ ВАЖНО:** После отправки кнопки workflow **останавливается**!  
Контакт придёт **в следующем сообщении**, поэтому:
- **НЕ добавляйте** связь `welcome → check-user`
- Контакт обработается **при следующем запуске** workflow (trigger: `message`)

---

### Пример 2: Inline меню с callback

**Workflow:**
```
start-trigger
  → main-menu (message.keyboard.inline)

callback-balance (trigger.callback: "balance")
  → show-balance (message)

callback-history (trigger.callback: "history")
  → show-history (message)
```

**Нода меню:**
```json
{
  "id": "main-menu",
  "type": "message.keyboard.inline",
  "data": {
    "config": {
      "message.keyboard.inline": {
        "text": "Выберите действие:",
        "buttons": [
          [
            {
              "text": "💰 Баланс",
              "callback_data": "balance"
            }
          ],
          [
            {
              "text": "📜 История",
              "callback_data": "history"
            }
          ]
        ]
      }
    }
  }
}
```

**Триггер callback:**
```json
{
  "id": "callback-balance",
  "type": "trigger.callback",
  "data": {
    "config": {
      "trigger.callback": {
        "callback_data": "balance"
      }
    }
  }
}
```

---

### Пример 3: Комбинированное меню (Reply + Inline)

**Reply клавиатура для основных команд:**
```json
{
  "keyboard": [
    [
      {
        "text": "💰 Бонусы"
      },
      {
        "text": "📜 История"
      }
    ],
    [
      {
        "text": "⚙️ Настройки"
      }
    ]
  ],
  "resize_keyboard": true
}
```

**Inline кнопки для действий:**
```json
{
  "buttons": [
    [
      {
        "text": "✅ Подтвердить",
        "callback_data": "confirm"
      },
      {
        "text": "❌ Отмена",
        "callback_data": "cancel"
      }
    ]
  ]
}
```

---

## ❓ FAQ

### Q: Почему кнопка "Поделиться контактом" не работает?

**A:** Проверьте:
1. ✅ Используете `message.keyboard.reply`, а не `message`
2. ✅ `request_contact: true` указан в кнопке
3. ✅ Workflow не пытается сразу обработать контакт в той же ноде

### Q: Как скрыть Reply клавиатуру?

**A:** Отправьте сообщение с `remove_keyboard`:
```json
{
  "type": "message",
  "data": {
    "config": {
      "message": {
        "text": "Клавиатура скрыта",
        "reply_markup": {
          "remove_keyboard": true
        }
      }
    }
  }
}
```

### Q: Inline кнопки не реагируют на нажатия?

**A:** Убедитесь, что:
1. Создан `trigger.callback` с нужным `callback_data`
2. Триггер подключён к action нодам
3. Бот отвечает на callback через `answerCallbackQuery`

### Q: Можно ли сделать кнопку с emoji?

**A:** Да! Просто добавьте emoji в текст:
```json
{
  "text": "🎁 Получить бонус",
  "callback_data": "get_bonus"
}
```

### Q: Сколько кнопок можно добавить?

**A:** 
- **Reply Keyboard:** до 100 кнопок (не рекомендуется > 20)
- **Inline Keyboard:** до 100 кнопок (не рекомендуется > 10)

---

## 🎨 Best Practices

### ✅ DO:
- Используйте понятные названия кнопок
- Добавляйте emoji для визуального оформления
- Группируйте связанные кнопки в ряды
- Используйте `one_time_keyboard: true` для одноразовых действий
- Используйте `resize_keyboard: true` для адаптивного размера

### ❌ DON'T:
- Не создавайте больше 3-4 рядов кнопок
- Не используйте слишком длинные названия
- Не смешивайте Reply и Inline в одном сообщении
- Не забывайте обрабатывать callback queries

---

## 🔗 Связанные документы

- [docs/workflow-nodes-analysis.md](./workflow-nodes-analysis.md) - Анализ всех типов нод
- [docs/NEW_NODES_GUIDE.md](./NEW_NODES_GUIDE.md) - Гайд по новым нодам
- [docs/telegram-bots.md](./telegram-bots.md) - Настройка Telegram ботов

---

**Обновлено:** 2025-10-14  
**Версия:** 1.0

