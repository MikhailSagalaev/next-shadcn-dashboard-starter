# 🚀 Упрощённая архитектура кнопок (как у конкурентов)

**Дата:** 2025-10-14  
**Статус:** ✅ РЕАЛИЗОВАНО

---

## 🎯 **ДО и ПОСЛЕ**

### ❌ **БЫЛО: Много нод**

```
start → welcome-message
          ↓
       trigger.contact
          ↓
       check-user
          ↓
       condition
        /     \
   create   existing
     ↓         ↓
   bonus    message
     ↓
  message
```

**Проблемы:**
- 10+ нод для простого сценария
- Сложно понять flow
- Триггеры занимают место

---

### ✅ **СТАЛО: Встроенные действия**

```
start → welcome-message
          [Кнопка с actions внутри]
            1. check-user
            2. if (new) {
                 create-user
                 add-bonus
                 send-message
               } else {
                 send-message
               }
```

**Преимущества:**
- Всего 2 ноды!
- Понятный flow
- Как у конкурентов

---

## 📝 **Структура встроенных действий**

```json
{
  "text": "📱 Поделиться номером",
  "request_contact": true,
  "actions": [
    {
      "id": "step-1",
      "type": "database_query",
      "query": "check_user",
      "parameters": {
        "telegramId": "{{telegram.userId}}"
      },
      "assignTo": "user"
    },
    {
      "id": "step-2",
      "type": "condition",
      "variable": "user",
      "operator": "is_empty",
      "true_actions": [
        {
          "type": "database_query",
          "query": "create_user"
        },
        {
          "type": "send_message",
          "text": "✅ Регистрация завершена!"
        }
      ],
      "false_actions": [
        {
          "type": "send_message",
          "text": "👋 С возвращением!"
        }
      ]
    }
  ]
}
```

---

## 🔧 **Поддерживаемые типы действий**

### **1. database_query**
```json
{
  "type": "database_query",
  "query": "check_user_by_telegram",
  "parameters": {
    "telegramId": "{{telegram.userId}}"
  },
  "assignTo": "user"
}
```

### **2. send_message**
```json
{
  "type": "send_message",
  "text": "Привет, {{telegram.first_name}}!",
  "parse_mode": "HTML"
}
```

### **3. condition**
```json
{
  "type": "condition",
  "variable": "user",
  "operator": "is_empty",
  "true_actions": [...],
  "false_actions": [...]
}
```

### **4. set_variable**
```json
{
  "type": "set_variable",
  "key": "balance",
  "value": "{{user.balance}}"
}
```

### **5. delay**
```json
{
  "type": "delay",
  "seconds": 2
}
```

---

## 📊 **Сравнение с конкурентами**

| Функция | Конкурент | Наш проект (ДО) | Наш проект (ПОСЛЕ) |
|---------|-----------|-----------------|---------------------|
| Кнопки с действиями | ✅ | ❌ | ✅ |
| Количество нод | 2-3 | 10+ | 2-3 |
| Условия внутри | ✅ | ❌ | ✅ |
| БД запросы | ✅ | Отдельные ноды | ✅ Встроенные |
| Понятность | ✅ | ⚠️ Сложно | ✅ |

---

## 🚀 **Пример: Система лояльности**

**Файл:** `Система лояльности УПРОЩЁННАЯ.json`

```json
{
  "nodes": [
    {
      "id": "start-trigger",
      "type": "trigger.command"
    },
    {
      "id": "welcome-message",
      "type": "message.keyboard.reply",
      "config": {
        "keyboard": [
          [
            {
              "text": "📱 Поделиться номером",
              "request_contact": true,
              "actions": [
                // Шаг 1: Проверка пользователя
                {
                  "type": "database_query",
                  "query": "check_user_by_telegram"
                },
                // Шаг 2: Условие
                {
                  "type": "condition",
                  "variable": "existingUser",
                  "operator": "is_empty",
                  "true_actions": [
                    // Новый пользователь
                    { "type": "database_query", "query": "create_user" },
                    { "type": "database_query", "query": "add_bonus" },
                    { "type": "send_message", "text": "✅ Регистрация!" }
                  ],
                  "false_actions": [
                    // Существующий пользователь
                    { "type": "send_message", "text": "👋 С возвращением!" }
                  ]
                }
              ]
            }
          ]
        ]
      }
    }
  ]
}
```

**Итого: 2 ноды вместо 10!** 🎉

---

## ✅ **Что дальше?**

1. ✅ Создан упрощённый шаблон
2. 🔄 Нужно обновить `ReplyKeyboardHandler` для обработки `actions`
3. 🔄 Нужно обновить `InlineKeyboardHandler` для обработки `actions`
4. 🔄 Добавить обработчик массива действий
5. 🔄 Тестирование

---

**Статус:** В разработке  
**Приоритет:** 🔴 P0

