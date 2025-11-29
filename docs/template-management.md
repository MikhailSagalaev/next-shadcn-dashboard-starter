# Управление шаблонами рассылок

## Обзор

Система поддерживает создание, загрузку и удаление шаблонов сообщений для рассылок. Шаблоны доступны в двух местах:
- Диалог отправки расширенных уведомлений
- Редактор ноды сообщения в workflow конструкторе

## Возможности

### Создание шаблона
1. Введите текст сообщения в редакторе
2. Нажмите кнопку "Сохранить шаблон"
3. Введите название шаблона
4. Нажмите "Сохранить"

### Загрузка шаблона
1. Выберите шаблон из выпадающего списка
2. Текст сообщения автоматически загрузится в редактор

### Удаление шаблона
1. Выберите шаблон из выпадающего списка
2. Нажмите кнопку "Удалить выбранный шаблон"
3. Подтвердите удаление

## Структура шаблона

```typescript
interface MessageTemplate {
  id: string;              // Уникальный ID
  name: string;            // Название шаблона
  message: string;         // Текст сообщения (HTML)
  imageUrl?: string;       // URL изображения (опционально)
  buttons?: any;           // Кнопки (опционально)
  parseMode: string;       // Режим парсинга (HTML/Markdown)
  projectId: string;       // ID проекта
  createdAt: Date;         // Дата создания
  updatedAt: Date;         // Дата обновления
}
```

## API Endpoints

### GET /api/projects/[id]/notification-templates
Получить все шаблоны проекта

**Response:**
```json
[
  {
    "id": "template-id",
    "name": "Приветствие",
    "message": "<b>Привет!</b> Добро пожаловать!",
    "parseMode": "HTML",
    "createdAt": "2025-01-31T10:00:00Z"
  }
]
```

### POST /api/projects/[id]/notification-templates
Создать новый шаблон

**Request:**
```json
{
  "name": "Приветствие",
  "message": "<b>Привет!</b> Добро пожаловать!",
  "parseMode": "HTML",
  "imageUrl": "https://example.com/image.jpg",
  "buttons": [
    {
      "text": "Начать",
      "url": "https://example.com"
    }
  ]
}
```

### DELETE /api/projects/[id]/notification-templates/[templateId]
Удалить шаблон

**Response:**
```json
{
  "success": true
}
```

## Использование в коде

### В React компоненте

```tsx
import { useState, useEffect } from 'react';

function MyComponent({ projectId }) {
  const [templates, setTemplates] = useState([]);

  // Загрузка шаблонов
  useEffect(() => {
    fetch(`/api/projects/${projectId}/notification-templates`)
      .then(res => res.json())
      .then(data => setTemplates(data));
  }, [projectId]);

  // Удаление шаблона
  const deleteTemplate = async (templateId) => {
    const response = await fetch(
      `/api/projects/${projectId}/notification-templates/${templateId}`,
      { method: 'DELETE' }
    );
    
    if (response.ok) {
      setTemplates(templates.filter(t => t.id !== templateId));
    }
  };

  return (
    <div>
      {templates.map(template => (
        <div key={template.id}>
          <span>{template.name}</span>
          <button onClick={() => deleteTemplate(template.id)}>
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Лучшие практики

1. **Именование шаблонов**
   - Используйте понятные названия
   - Указывайте назначение (например, "Приветствие новых пользователей")

2. **Организация**
   - Группируйте похожие шаблоны
   - Удаляйте неиспользуемые шаблоны

3. **Безопасность**
   - Не храните чувствительные данные в шаблонах
   - Используйте переменные для персонализации

4. **Тестирование**
   - Проверяйте шаблоны перед массовой рассылкой
   - Используйте превью для проверки форматирования

## Переменные в шаблонах

Поддерживаемые переменные:
- `{user.firstName}` - Имя пользователя
- `{user.lastName}` - Фамилия
- `{user.fullName}` - Полное имя
- `{user.balanceFormatted}` - Баланс бонусов
- `{user.currentLevel}` - Текущий уровень
- `{user.referralCode}` - Реферальный код

Пример:
```html
<b>Привет, {user.firstName}!</b>

Ваш баланс: {user.balanceFormatted}
Уровень: {user.currentLevel}
```
