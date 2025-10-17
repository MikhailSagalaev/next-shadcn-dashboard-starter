# 📱 Гайд: Кнопки в обычной ноде "Сообщение"

## 🎯 **Обзор**

Теперь в обычную ноду типа `message` можно добавлять кнопки (inline и reply) без необходимости создавать отдельные ноды `message.keyboard.inline` или `message.keyboard.reply`.

---

## ✨ **Преимущества**

✅ **Меньше нод** - не нужны отдельные keyboard ноды  
✅ **Удобство** - сообщение и кнопки в одном месте  
✅ **Гибкость** - поддержка inline и reply кнопок  
✅ **Совместимость** - работает со всеми типами кнопок  

---

## 📋 **Структура конфигурации**

### **Базовая структура:**

```json
{
  "id": "welcome-message",
  "type": "message",
  "data": {
    "label": "Приветственное сообщение",
    "config": {
      "message": {
        "text": "Привет! Выбери действие:",
        "parseMode": "HTML",
        "keyboard": {
          "type": "inline",  // или "reply"
          "buttons": [
            [
              {
                "text": "Кнопка 1",
                "callback_data": "action_1"
              }
            ]
          ]
        }
      }
    }
  }
}
```

---

## 🔘 **Типы кнопок**

### **1. Inline кнопки** (появляются под сообщением)

#### **A. Callback кнопка**
```json
{
  "type": "inline",
  "buttons": [
    [
      {
        "text": "Мой баланс",
        "callback_data": "check_balance"
      }
    ]
  ]
}
```

#### **B. URL кнопка**
```json
{
  "type": "inline",
  "buttons": [
    [
      {
        "text": "🌐 Наш сайт",
        "url": "https://example.com"
      }
    ]
  ]
}
```

#### **C. Кнопка с goto_node** (прямой переход)
```json
{
  "type": "inline",
  "buttons": [
    [
      {
        "text": "Далее →",
        "goto_node": "next-step"
      }
    ]
  ]
}
```

#### **D. Web App кнопка**
```json
{
  "type": "inline",
  "buttons": [
    [
      {
        "text": "🎮 Открыть приложение",
        "web_app": {
          "url": "https://app.example.com"
        }
      }
    ]
  ]
}
```

---

### **2. Reply кнопки** (заменяют клавиатуру)

#### **A. Кнопка запроса контакта**
```json
{
  "type": "reply",
  "buttons": [
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
```

#### **B. Кнопка запроса локации**
```json
{
  "type": "reply",
  "buttons": [
    [
      {
        "text": "📍 Отправить геолокацию",
        "request_location": true
      }
    ]
  ]
}
```

#### **C. Обычная reply кнопка**
```json
{
  "type": "reply",
  "buttons": [
    [
      {
        "text": "Меню"
      },
      {
        "text": "Помощь"
      }
    ],
    [
      {
        "text": "Настройки"
      }
    ]
  ]
}
```

---

## 🎨 **Примеры использования**

### **Пример 1: Приветственное сообщение с меню**

```json
{
  "id": "welcome",
  "type": "message",
  "data": {
    "label": "Приветствие",
    "config": {
      "message": {
        "text": "👋 Добро пожаловать!\n\nВыберите действие:",
        "keyboard": {
          "type": "inline",
          "buttons": [
            [
              {
                "text": "💰 Мой баланс",
                "callback_data": "balance"
              },
              {
                "text": "🎁 Акции",
                "callback_data": "promotions"
              }
            ],
            [
              {
                "text": "📞 Поддержка",
                "url": "https://t.me/support"
              }
            ]
          ]
        }
      }
    }
  }
}
```

---

### **Пример 2: Регистрация с запросом контакта**

```json
{
  "id": "registration",
  "type": "message",
  "data": {
    "label": "Регистрация",
    "config": {
      "message": {
        "text": "📱 Для регистрации поделитесь номером телефона:",
        "keyboard": {
          "type": "reply",
          "buttons": [
            [
              {
                "text": "📱 Поделиться номером",
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
}
```

---

### **Пример 3: Навигация с goto_node**

```json
{
  "id": "step-1",
  "type": "message",
  "data": {
    "label": "Шаг 1",
    "config": {
      "message": {
        "text": "Это первый шаг. Готовы продолжить?",
        "keyboard": {
          "type": "inline",
          "buttons": [
            [
              {
                "text": "✅ Да, продолжить",
                "goto_node": "step-2"
              }
            ],
            [
              {
                "text": "❌ Нет, отменить",
                "goto_node": "cancel"
              }
            ]
          ]
        }
      }
    }
  }
}
```

---

### **Пример 4: Смешанные кнопки (несколько рядов)**

```json
{
  "id": "menu",
  "type": "message",
  "data": {
    "label": "Главное меню",
    "config": {
      "message": {
        "text": "🏠 <b>Главное меню</b>\n\nВыберите раздел:",
        "parseMode": "HTML",
        "keyboard": {
          "type": "inline",
          "buttons": [
            [
              {
                "text": "💰 Баланс",
                "callback_data": "balance"
              },
              {
                "text": "📊 История",
                "callback_data": "history"
              }
            ],
            [
              {
                "text": "🎁 Акции",
                "goto_node": "promotions"
              }
            ],
            [
              {
                "text": "⚙️ Настройки",
                "callback_data": "settings"
              },
              {
                "text": "❓ Помощь",
                "url": "https://help.example.com"
              }
            ]
          ]
        }
      }
    }
  }
}
```

---

## 🔧 **Параметры конфигурации**

### **Для Inline клавиатуры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `type` | `"inline"` | Тип клавиатуры |
| `buttons` | `InlineButton[][]` | Массив рядов кнопок |

### **Для Reply клавиатуры:**

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `type` | `"reply"` | Тип клавиатуры | - |
| `buttons` | `ReplyButton[][]` | Массив рядов кнопок | - |
| `resize_keyboard` | `boolean` | Адаптировать размер | `true` |
| `one_time_keyboard` | `boolean` | Скрыть после использования | `false` |
| `selective` | `boolean` | Показать выборочно | `false` |

---

## ⚡ **Обработка нажатий кнопок**

### **1. Callback кнопки** (callback_data)
Требуют триггер `trigger.callback`:

```json
{
  "id": "balance-trigger",
  "type": "trigger.callback",
  "data": {
    "config": {
      "callback_data": "balance"
    }
  }
}
```

### **2. Goto кнопки** (goto_node)
Автоматически переходят к указанной ноде. Триггер не нужен!

### **3. URL кнопки**
Открывают ссылку. Обработка не требуется.

### **4. Request Contact/Location**
Требуют триггер `trigger.contact`:

```json
{
  "id": "contact-trigger",
  "type": "trigger.contact"
}
```

---

## 📊 **Сравнение подходов**

| Подход | Количество нод | Удобство | Когда использовать |
|--------|----------------|----------|-------------------|
| **message + keyboard** | 1 | ⭐⭐⭐⭐⭐ | Простые меню и навигация |
| **message.keyboard.inline** | 2 | ⭐⭐⭐ | Сложная логика кнопок |
| **message.keyboard.reply** | 2 | ⭐⭐⭐ | Когда нужны специальные параметры |

---

## ✅ **Лучшие практики**

1. **Используйте inline кнопки** для меню и навигации
2. **Используйте reply кнопки** для запроса данных (контакт, локация)
3. **Группируйте связанные кнопки** в один ряд
4. **Используйте goto_node** для простой навигации
5. **Используйте callback_data** для сложной логики
6. **Добавляйте эмодзи** для визуальной привлекательности
7. **Ограничивайте количество кнопок** (максимум 8-10)

---

## 🚀 **Миграция со старого подхода**

### **Было (2 ноды):**

```
[message] → [message.keyboard.inline]
```

### **Стало (1 нода):**

```
[message с keyboard]
```

### **Пример миграции:**

**Старый подход:**
```json
{
  "nodes": [
    {
      "id": "msg",
      "type": "message",
      "data": { "config": { "message": { "text": "Привет!" } } }
    },
    {
      "id": "kbd",
      "type": "message.keyboard.inline",
      "data": { "config": { "buttons": [[{ "text": "OK", "callback_data": "ok" }]] } }
    }
  ]
}
```

**Новый подход:**
```json
{
  "nodes": [
    {
      "id": "msg",
      "type": "message",
      "data": {
        "config": {
          "message": {
            "text": "Привет!",
            "keyboard": {
              "type": "inline",
              "buttons": [[{ "text": "OK", "callback_data": "ok" }]]
            }
          }
        }
      }
    }
  ]
}
```

---

## 🎯 **Заключение**

Теперь создание ботов стало **еще проще**:

✅ Меньше нод → быстрее разработка  
✅ Все в одном месте → удобнее редактировать  
✅ Совместимость → работает со всеми типами кнопок  
✅ Гибкость → можно использовать оба подхода  

**Начните использовать кнопки в message нодах уже сейчас!** 🚀

