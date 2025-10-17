# 🎨 Руководство по новым нодам конструктора

## 📋 Оглавление
1. [Клавиатуры](#клавиатуры)
2. [Медиа сообщения](#медиа-сообщения)
3. [Циклы](#циклы)
4. [Switch/Case](#switchcase)
5. [Примеры сценариев](#примеры-сценариев)

---

## 🎹 Клавиатуры

### Inline клавиатуры (message.keyboard.inline)

**Когда использовать**: Для интерактивных меню, подтверждений, выбора опций

**Пример 1: Простое меню**
```json
{
  "type": "message.keyboard.inline",
  "data": {
    "config": {
      "message.keyboard.inline": {
        "text": "🎯 Главное меню:\n\nВыберите действие:",
        "buttons": [
          [
            { "text": "💰 Мой баланс", "callback_data": "balance" }
          ],
          [
            { "text": "🎁 Получить бонусы", "callback_data": "get_bonus" },
            { "text": "🛍️ Потратить", "callback_data": "spend" }
          ],
          [
            { "text": "📊 История", "callback_data": "history" }
          ]
        ]
      }
    }
  }
}
```

**Пример 2: С URL кнопками**
```json
{
  "buttons": [
    [
      { "text": "📱 Открыть сайт", "url": "https://{domain}" }
    ],
    [
      { "text": "💬 Поддержка", "url": "https://t.me/{support_username}" }
    ]
  ]
}
```

**Пример 3: Web App**
```json
{
  "buttons": [
    [
      { 
        "text": "🌐 Открыть приложение", 
        "web_app": { "url": "https://{domain}/app" }
      }
    ]
  ]
}
```

**Переменные**:
- `{username}` - имя пользователя Telegram
- `{first_name}` - имя
- `{domain}` - домен проекта
- Любые переменные проекта

---

### Reply клавиатуры (message.keyboard.reply)

**Когда использовать**: Для постоянных меню, запроса контактов/геолокации

**Пример 1: Главное меню**
```json
{
  "type": "message.keyboard.reply",
  "data": {
    "config": {
      "message.keyboard.reply": {
        "text": "Главное меню:",
        "buttons": [
          [
            { "text": "💰 Баланс" },
            { "text": "🎁 Бонусы" }
          ],
          [
            { "text": "📊 История" },
            { "text": "⚙️ Настройки" }
          ]
        ],
        "resize_keyboard": true,
        "one_time_keyboard": false
      }
    }
  }
}
```

**Пример 2: Запрос контакта**
```json
{
  "text": "Для регистрации поделитесь контактом:",
  "buttons": [
    [
      { "text": "📱 Поделиться номером", "request_contact": true }
    ],
    [
      { "text": "❌ Отмена" }
    ]
  ],
  "resize_keyboard": true,
  "one_time_keyboard": true
}
```

**Пример 3: Запрос геолокации**
```json
{
  "text": "Отправьте вашу геолокацию:",
  "buttons": [
    [
      { "text": "📍 Отправить геолокацию", "request_location": true }
    ]
  ],
  "one_time_keyboard": true
}
```

**Опции**:
- `resize_keyboard: true` - автоматический размер
- `one_time_keyboard: true` - скрыть после использования
- `input_field_placeholder` - подсказка в поле ввода

---

## 📸 Медиа сообщения

### Отправка фото (message.photo)

**Пример 1: Фото по URL**
```json
{
  "type": "message.photo",
  "data": {
    "config": {
      "message.photo": {
        "photo": "https://example.com/image.jpg",
        "caption": "🎉 Поздравляем!\n\nВы получили бонус!",
        "parse_mode": "HTML"
      }
    }
  }
}
```

**Пример 2: С переменными**
```json
{
  "photo": "https://{domain}/promo/{promo_id}.jpg",
  "caption": "Привет, {first_name}! 👋\n\nСпециально для вас!",
  "has_spoiler": false
}
```

**Пример 3: File ID (для повторной отправки)**
```json
{
  "photo": "AgACAgIAAxkBAAIC...",
  "caption": "Ваш QR-код"
}
```

---

### Отправка видео (message.video)

**Пример**:
```json
{
  "type": "message.video",
  "data": {
    "config": {
      "message.video": {
        "video": "https://example.com/video.mp4",
        "caption": "📹 Инструкция по использованию",
        "duration": 60,
        "supports_streaming": true
      }
    }
  }
}
```

---

### Отправка документа (message.document)

**Пример**:
```json
{
  "type": "message.document",
  "data": {
    "config": {
      "message.document": {
        "document": "https://example.com/rules.pdf",
        "caption": "📄 Правила программы лояльности"
      }
    }
  }
}
```

---

### Редактирование сообщения (message.edit)

**Когда использовать**: Обновление статуса, изменение текста

**Пример**:
```json
{
  "type": "message.edit",
  "data": {
    "config": {
      "message.edit": {
        "message_id": "{{last_message_id}}",
        "text": "✅ Операция завершена!\n\nБонусы начислены.",
        "parse_mode": "HTML"
      }
    }
  }
}
```

**Важно**: Нужно сохранить `message_id` в переменную при отправке исходного сообщения

---

### Удаление сообщения (message.delete)

**Когда использовать**: Очистка чата, удаление временных сообщений

**Пример**:
```json
{
  "type": "message.delete",
  "data": {
    "config": {
      "message.delete": {
        "message_id": "{{temp_message_id}}"
      }
    }
  }
}
```

---

## 🔄 Циклы

### Count Loop (фиксированное количество)

**Когда использовать**: Повторить действие N раз

**Пример: Отправить 5 сообщений**
```json
{
  "type": "flow.loop",
  "data": {
    "config": {
      "flow.loop": {
        "type": "count",
        "count": 5,
        "indexVariable": "loop_index",
        "maxIterations": 100
      }
    }
  }
}
```

**Использование индекса**:
```json
{
  "type": "message",
  "data": {
    "config": {
      "message": {
        "text": "Сообщение номер {{loop_index}}"
      }
    }
  }
}
```

---

### Foreach Loop (по массиву)

**Когда использовать**: Обработать каждый элемент массива

**Пример: Отправить сообщение каждому пользователю**
```json
{
  "type": "flow.loop",
  "data": {
    "config": {
      "flow.loop": {
        "type": "foreach",
        "array": "users",
        "itemVariable": "current_user",
        "indexVariable": "user_index",
        "maxIterations": 100
      }
    }
  }
}
```

**Использование элемента**:
```json
{
  "type": "message",
  "data": {
    "config": {
      "message": {
        "text": "Привет, {{current_user.name}}!"
      }
    }
  }
}
```

---

### While Loop (по условию)

**Когда использовать**: Повторять пока условие истинно

**Пример: Пока счетчик меньше 10**
```json
{
  "type": "flow.loop",
  "data": {
    "config": {
      "flow.loop": {
        "type": "while",
        "condition": "{{counter}} < 10",
        "maxIterations": 100
      }
    }
  }
}
```

**⚠️ Важно**: 
- Всегда устанавливайте `maxIterations`
- Убедитесь, что условие когда-то станет false
- Используйте `action.set_variable` для изменения счетчика

---

## 🔀 Switch/Case

**Когда использовать**: Множественный выбор на основе значения

**Пример 1: Статус пользователя**
```json
{
  "type": "flow.switch",
  "data": {
    "config": {
      "flow.switch": {
        "variable": "user_status",
        "cases": [
          { "value": "new", "label": "Новый" },
          { "value": "active", "label": "Активный" },
          { "value": "vip", "label": "VIP" },
          { "value": "blocked", "label": "Заблокирован" }
        ],
        "hasDefault": true
      }
    }
  }
}
```

**Connections**:
- `case_0` → для "new"
- `case_1` → для "active"
- `case_2` → для "vip"
- `case_3` → для "blocked"
- `default` → если не совпало

**Пример 2: Выбор языка**
```json
{
  "variable": "language",
  "cases": [
    { "value": "ru", "label": "Русский" },
    { "value": "en", "label": "English" },
    { "value": "es", "label": "Español" }
  ],
  "hasDefault": true
}
```

---

## 🎯 Примеры сценариев

### Сценарий 1: Регистрация с бонусом

```
1. trigger.command (/start)
   ↓
2. message.keyboard.inline (Приветствие + кнопка "Регистрация")
   ↓
3. trigger.callback (callback_data: "register")
   ↓
4. message.keyboard.reply (Запрос контакта)
   ↓
5. trigger.contact (Получение контакта)
   ↓
6. action.database_query (create_user)
   ↓
7. action.database_query (add_bonus: 100)
   ↓
8. message.photo (Поздравление с фото)
```

---

### Сценарий 2: Проверка баланса

```
1. trigger.command (/balance)
   ↓
2. action.database_query (get_user_balance)
   ↓
3. condition (balance > 0?)
   ├─ true → message (У вас {{balance}} бонусов)
   └─ false → message (Баланс пуст)
```

---

### Сценарий 3: Меню с выбором

```
1. trigger.command (/menu)
   ↓
2. message.keyboard.inline (Главное меню)
   ↓
3. trigger.callback
   ↓
4. flow.switch (по callback_data)
   ├─ case "balance" → Показать баланс
   ├─ case "bonus" → Начислить бонус
   ├─ case "history" → Показать историю
   └─ default → Неизвестная команда
```

---

### Сценарий 4: Рассылка с циклом

```
1. trigger.command (/broadcast)
   ↓
2. action.database_query (get_all_users)
   ↓
3. flow.loop (foreach users)
   ↓
4. message (Отправить каждому пользователю)
   ↓
5. flow.delay (1000ms между сообщениями)
```

---

### Сценарий 5: Опрос с вариантами

```
1. trigger.command (/poll)
   ↓
2. message.keyboard.inline (Вопрос + варианты)
   ↓
3. trigger.callback
   ↓
4. action.set_variable (Сохранить ответ)
   ↓
5. message.edit (Обновить вопрос → "Спасибо!")
   ↓
6. message (Следующий вопрос)
```

---

## 💡 Best Practices

### Клавиатуры
- ✅ Используйте inline для временных действий
- ✅ Используйте reply для постоянных меню
- ✅ Не более 8 кнопок в одном ряду
- ✅ Используйте эмодзи для наглядности
- ❌ Не делайте слишком длинные тексты кнопок

### Медиа
- ✅ Используйте file_id для повторной отправки
- ✅ Сжимайте изображения перед отправкой
- ✅ Добавляйте caption для контекста
- ❌ Не отправляйте слишком большие файлы (>20MB)

### Циклы
- ✅ Всегда устанавливайте maxIterations
- ✅ Логируйте прогресс
- ✅ Добавляйте delay между итерациями
- ❌ Не делайте бесконечные циклы
- ❌ Не делайте слишком много итераций (>100)

### Switch/Case
- ✅ Всегда добавляйте default case
- ✅ Используйте понятные labels
- ✅ Группируйте похожие cases
- ❌ Не делайте слишком много вариантов (>10)

---

## 🐛 Troubleshooting

### Клавиатура не отображается
- Проверьте формат buttons (массив массивов)
- Убедитесь, что у каждой кнопки есть text
- Проверьте, что есть callback_data или url

### Фото не отправляется
- Проверьте URL (должен быть доступен)
- Убедитесь, что формат поддерживается (jpg, png)
- Попробуйте использовать file_id

### Цикл не работает
- Проверьте тип цикла (count, foreach, while)
- Убедитесь, что переменная существует (для foreach)
- Проверьте maxIterations

### Switch не переходит
- Проверьте, что переменная установлена
- Убедитесь, что значения совпадают
- Проверьте connections (case_0, case_1, default)

---

**Дата**: 2025-10-14  
**Версия**: 1.0.0  
**Статус**: Production Ready

