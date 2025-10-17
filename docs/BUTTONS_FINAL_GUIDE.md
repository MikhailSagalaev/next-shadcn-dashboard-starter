# 🔘 Финальный гайд по кнопкам в конструкторе

**Дата:** 2025-10-14  
**Статус:** 🚀 ГОТОВО К ИСПОЛЬЗОВАНИЮ

---

## ⚠️ **КРИТИЧНО: ПЕРЕЗАПУСТИТЕ СЕРВЕР!**

Handlers для кнопок уже реализованы, но **не загружены**.

### Перезапуск:
```powershell
# 1. Остановите сервер (Ctrl+C)
# 2. Запустите снова:
.\start.ps1 dev
```

---

## 🎯 **Два способа работы с кнопками**

### **Способ 1: Прямые связи (goto_node) ⭐ РЕКОМЕНДУЕТСЯ**

**Для чего:** Простая навигация без сложной логики

```json
{
  "id": "main-menu",
  "type": "message.keyboard.inline",
  "data": {
    "config": {
      "message.keyboard.inline": {
        "text": "Главное меню:",
        "buttons": [
          [
            {
              "text": "💰 Мой баланс",
              "callback_data": "balance",
              "goto_node": "show-balance"  // ← Прямая связь!
            }
          ],
          [
            {
              "text": "📜 История",
              "callback_data": "history",
              "goto_node": "show-history"
            }
          ]
        ]
      }
    }
  }
}
```

**Как работает:**
1. Пользователь нажимает кнопку "Мой баланс"
2. Система автоматически переходит к ноде `show-balance`
3. **НЕ НУЖНО** создавать trigger.callback ноды!

**Визуализация в конструкторе:**
```
[main-menu] ──┬──> [show-balance]
              └──> [show-history]
```

---

### **Способ 2: Триггеры (callback_data) 💪 ДЛЯ СЛОЖНОЙ ЛОГИКИ**

**Для чего:** Когда нужна обработка данных, условия, БД запросы

```json
{
  "id": "product-list",
  "type": "message.keyboard.inline",
  "data": {
    "config": {
      "message.keyboard.inline": {
        "text": "Выберите товар:",
        "buttons": [
          [
            {
              "text": "📦 Товар #123",
              "callback_data": "product_123"  // ← Только callback_data
            }
          ],
          [
            {
              "text": "📦 Товар #456",
              "callback_data": "product_456"
            }
          ]
        ]
      }
    }
  }
}
```

Затем создаём **триггеры**:
```json
{
  "id": "product-callback",
  "type": "trigger.callback",
  "data": {
    "config": {
      "trigger.callback": {
        "callback_data": "product_*",  // Wildcard
        "extract_params": true  // Извлекает product_id
      }
    }
  }
}
```

**Workflow:**
```
[product-list] → отправляет кнопки

При клике на кнопку:
[trigger.callback] → [check-product-stock] → [show-product-details]
```

---

## 📚 **Примеры использования**

### **Пример 1: Меню навигации (Способ 1)**

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "trigger.command",
      "config": { "command": "/start" }
    },
    {
      "id": "main-menu",
      "type": "message.keyboard.inline",
      "config": {
        "message.keyboard.inline": {
          "text": "🎯 Главное меню",
          "buttons": [
            [
              {
                "text": "💰 Баланс",
                "callback_data": "balance",
                "goto_node": "show-balance"
              }
            ],
            [
              {
                "text": "📊 Статистика",
                "callback_data": "stats",
                "goto_node": "show-stats"
              }
            ],
            [
              {
                "text": "🌐 Наш сайт",
                "url": "https://example.com"  // URL кнопка
              }
            ]
          ]
        }
      }
    },
    {
      "id": "show-balance",
      "type": "message",
      "config": {
        "message": {
          "text": "Ваш баланс: {{balance}} бонусов"
        }
      }
    },
    {
      "id": "show-stats",
      "type": "message",
      "config": {
        "message": {
          "text": "Статистика: {{totalEarned}} заработано"
        }
      }
    }
  ],
  "connections": [
    { "source": "start", "target": "main-menu" }
  ]
}
```

**✅ Преимущества:**
- Просто и понятно
- Меньше нод
- Визуально связанно

---

### **Пример 2: Подтверждение заказа (Способ 2)**

```json
{
  "nodes": [
    {
      "id": "order-confirm",
      "type": "message.keyboard.inline",
      "config": {
        "message.keyboard.inline": {
          "text": "Подтвердить заказ #{{order_id}}?",
          "buttons": [
            [
              {
                "text": "✅ Подтвердить",
                "callback_data": "confirm_{{order_id}}"
              },
              {
                "text": "❌ Отменить",
                "callback_data": "cancel_{{order_id}}"
              }
            ]
          ]
        }
      }
    },
    {
      "id": "confirm-callback",
      "type": "trigger.callback",
      "config": {
        "callback_data": "confirm_*"
      }
    },
    {
      "id": "process-order",
      "type": "action.database_query",
      "config": {
        "query": "process_order",
        "parameters": {
          "orderId": "{{order_id}}"
        }
      }
    },
    {
      "id": "success-message",
      "type": "message",
      "config": {
        "message": {
          "text": "✅ Заказ #{{order_id}} подтверждён!"
        }
      }
    }
  ],
  "connections": [
    { "source": "confirm-callback", "target": "process-order" },
    { "source": "process-order", "target": "success-message" }
  ]
}
```

---

### **Пример 3: Reply Keyboard с запросом контакта**

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "trigger.command",
      "config": { "command": "/start" }
    },
    {
      "id": "ask-contact",
      "type": "message.keyboard.reply",
      "config": {
        "message.keyboard.reply": {
          "text": "📱 Поделитесь контактом для регистрации:",
          "keyboard": [  // ← или "buttons"
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
    },
    {
      "id": "contact-received",
      "type": "trigger.contact"
    },
    {
      "id": "save-user",
      "type": "action.database_query",
      "config": {
        "query": "create_user",
        "parameters": {
          "telegramId": "{{telegram.userId}}",
          "phone": "{{telegram.contact.phone}}"
        }
      }
    },
    {
      "id": "success",
      "type": "message",
      "config": {
        "message": {
          "text": "✅ Регистрация завершена!"
        }
      }
    }
  ],
  "connections": [
    { "source": "start", "target": "ask-contact" },
    { "source": "contact-received", "target": "save-user" },
    { "source": "save-user", "target": "success" }
  ]
}
```

**Как работает:**
1. `/start` → отправляет кнопку "Поделиться номером"
2. Workflow **завершается**
3. Пользователь нажимает кнопку → Telegram отправляет контакт
4. **Новый запуск workflow** с trigger `contact-received`
5. Сохраняем пользователя → Успех

---

## 🔧 **Конфигурация кнопок**

### **Inline Keyboard**

```typescript
{
  "text": "Текст сообщения",
  "buttons": [
    [
      {
        "text": "💰 Баланс",
        "callback_data": "balance",      // Для триггеров
        "goto_node": "show-balance"      // Прямая связь (опционально)
      },
      {
        "text": "🌐 Сайт",
        "url": "https://example.com"     // URL кнопка
      }
    ],
    [
      {
        "text": "🎮 Открыть игру",
        "web_app": {
          "url": "https://game.example.com"
        }
      }
    ]
  ],
  "parse_mode": "HTML",                  // HTML | Markdown | MarkdownV2
  "disable_web_page_preview": false
}
```

### **Reply Keyboard**

```typescript
{
  "text": "Текст сообщения",
  "keyboard": [  // или "buttons"
    [
      {
        "text": "📱 Контакт",
        "request_contact": true
      }
    ],
    [
      {
        "text": "📍 Локация",
        "request_location": true
      }
    ],
    [
      {
        "text": "Главное меню"  // Обычная кнопка
      }
    ]
  ],
  "resize_keyboard": true,
  "one_time_keyboard": true,
  "input_field_placeholder": "Выберите действие..."
}
```

---

## ❓ FAQ

### Q: Когда использовать `goto_node`, а когда триггеры?

**A:**
- **`goto_node`** - для простой навигации (меню, "назад", "далее")
- **Триггеры** - когда нужна обработка данных, условия, БД запросы

### Q: Можно ли комбинировать оба подхода?

**A:** Да! Можно указать и `goto_node`, и `callback_data`:
```json
{
  "text": "💰 Баланс",
  "callback_data": "balance",      // Для логирования
  "goto_node": "show-balance"      // Прямой переход
}
```

### Q: Как обработать нажатие reply кнопки?

**A:** Reply кнопки отправляют **текст** как обычное сообщение. Используйте `trigger.message` с фильтром по тексту.

### Q: Сколько кнопок можно добавить?

**A:**
- **Inline Keyboard:** до 100 кнопок (рекомендуется ≤ 10)
- **Reply Keyboard:** до 100 кнопок (рекомендуется ≤ 20)

---

## ✅ Чек-лист для старта

- [x] Перезапустить сервер после обновления кода
- [x] Создать workflow с кнопками
- [x] Добавить `goto_node` для простой навигации
- [x] Или создать триггеры для сложной логики
- [x] Протестировать в боте

---

## 🚀 **СЛЕДУЮЩИЙ ШАГ: ПЕРЕЗАПУСТИТЕ СЕРВЕР!**

```powershell
# Ctrl+C → Остановка
.\start.ps1 dev
```

После перезапуска бот заработает с кнопками! 🎉

---

**Обновлено:** 2025-10-14  
**Версия:** 1.0 (FINAL)

