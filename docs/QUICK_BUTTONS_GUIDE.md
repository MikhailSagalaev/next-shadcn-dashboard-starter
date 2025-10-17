# ⚡ Быстрый гайд: Кнопки в конструкторе ботов

## 🎯 **3 способа добавить кнопки**

### **1️⃣ Кнопки в обычной message ноде** (РЕКОМЕНДУЕТСЯ)

```json
{
  "type": "message",
  "data": {
    "config": {
      "message": {
        "text": "Выберите действие:",
        "keyboard": {
          "type": "inline",
          "buttons": [
            [
              { "text": "Вариант 1", "goto_node": "step-1" },
              { "text": "Вариант 2", "goto_node": "step-2" }
            ]
          ]
        }
      }
    }
  }
}
```

✅ **Плюсы:** Просто, быстро, минимум нод  
✅ **Когда использовать:** Всегда, если не нужны actions

---

### **2️⃣ Отдельная keyboard нода**

```json
{
  "type": "message.keyboard.inline",
  "data": {
    "config": {
      "buttons": [
        [{ "text": "OK", "callback_data": "ok" }]
      ]
    }
  }
}
```

✅ **Плюсы:** Переиспользование клавиатуры  
⚠️ **Когда использовать:** Редко (в основном для сложных сценариев)

---

### **3️⃣ Кнопки с встроенными действиями** (МОЩНЕЙШИЙ)

```json
{
  "type": "message.keyboard.reply",
  "data": {
    "config": {
      "buttons": [
        [
          {
            "text": "📱 Поделиться номером",
            "request_contact": true,
            "actions": [
              {
                "type": "database_query",
                "query": "check_user_by_telegram",
                "assignTo": "user"
              },
              {
                "type": "condition",
                "variable": "user",
                "operator": "is_empty",
                "true_actions": [
                  { "type": "database_query", "query": "create_user" },
                  { "type": "send_message", "text": "✅ Вы зарегистрированы!" }
                ]
              }
            ]
          }
        ]
      ]
    }
  }
}
```

✅ **Плюсы:** Минимум нод, вся логика в одном месте  
✅ **Когда использовать:** Для сложной логики без лишних нод

---

## 🔘 **Типы кнопок**

### **Inline кнопки** (под сообщением)

| Тип | Код | Пример |
|-----|-----|--------|
| **Переход** | `goto_node: "id"` | Навигация без триггера |
| **Callback** | `callback_data: "data"` | Требует trigger.callback |
| **Ссылка** | `url: "https://..."` | Открывает URL |
| **Web App** | `web_app: {url: "..."}` | Открывает приложение |

### **Reply кнопки** (заменяют клавиатуру)

| Тип | Код | Пример |
|-----|-----|--------|
| **Контакт** | `request_contact: true` | Запрос телефона |
| **Локация** | `request_location: true` | Запрос геопозиции |
| **Опрос** | `request_poll: {...}` | Создание опроса |
| **Обычная** | `text: "..."` | Простая кнопка |

---

## 🚀 **Примеры**

### **Простое меню**

```json
{
  "text": "Главное меню",
  "keyboard": {
    "type": "inline",
    "buttons": [
      [
        { "text": "💰 Баланс", "goto_node": "balance" },
        { "text": "🎁 Акции", "goto_node": "promo" }
      ],
      [
        { "text": "📞 Поддержка", "url": "https://t.me/support" }
      ]
    ]
  }
}
```

### **Регистрация с контактом**

```json
{
  "text": "Поделитесь номером для регистрации",
  "keyboard": {
    "type": "reply",
    "buttons": [
      [
        { "text": "📱 Поделиться", "request_contact": true }
      ]
    ],
    "one_time_keyboard": true
  }
}
```

### **Подтверждение с действиями**

```json
{
  "buttons": [
    [
      {
        "text": "✅ Подтвердить",
        "callback_data": "confirm",
        "actions": [
          { "type": "database_query", "query": "update_status" },
          { "type": "send_message", "text": "Готово!" }
        ]
      }
    ]
  ]
}
```

---

## ✅ **Выбор подхода**

| Задача | Подход | Количество нод |
|--------|--------|----------------|
| Простое меню | message + keyboard | 1 |
| Навигация | goto_node | 1 |
| Запрос данных | reply keyboard | 1 |
| Сложная логика | actions в кнопке | 1 |
| Callback обработка | trigger.callback + message | 2 |

---

## 📖 **Полная документация**

- 📱 [Кнопки в message ноде](./MESSAGE_WITH_BUTTONS_GUIDE.md)
- 🎯 [Встроенные действия](./SIMPLIFIED_BUTTONS_ARCHITECTURE.md)
- 🔧 [Детальный гайд по кнопкам](./BOT_BUTTONS_GUIDE.md)

---

## 🎉 **Результат**

**Было:** 10 нод для простого меню  
**Стало:** 2-3 ноды для того же функционала  

**Начните использовать новые возможности прямо сейчас!** 🚀

