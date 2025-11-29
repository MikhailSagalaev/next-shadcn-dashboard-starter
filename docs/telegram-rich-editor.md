# Telegram Rich Editor

WYSIWYG редактор для Telegram сообщений с поддержкой переменных и HTML форматирования.

## Особенности

✅ **WYSIWYG редактирование** - визуальное форматирование текста
✅ **Telegram-совместимые теги** - только поддерживаемые Telegram форматы
✅ **Поддержка переменных** - вставка динамических данных пользователя
✅ **Горячие клавиши** - быстрое форматирование (Ctrl+B, Ctrl+I, и т.д.)
✅ **Счетчик символов** - отслеживание длины сообщения
✅ **История изменений** - отмена/повтор действий

## Поддерживаемое форматирование

| Формат | Тег HTML | Горячая клавиша |
|--------|----------|-----------------|
| **Жирный** | `<b>` | Ctrl+B |
| *Курсив* | `<i>` | Ctrl+I |
| <u>Подчеркнутый</u> | `<u>` | Ctrl+U |
| ~~Зачеркнутый~~ | `<s>` | - |
| `Код` | `<code>` | - |
| Ссылка | `<a href="...">` | - |

## Использование

### Базовое использование

```tsx
import { TelegramRichEditor } from '@/components/ui/telegram-rich-editor';

function MyComponent() {
  const [message, setMessage] = useState('');

  return (
    <TelegramRichEditor
      value={message}
      onChange={setMessage}
      placeholder="Введите текст сообщения..."
    />
  );
}
```

### С переменными

```tsx
<TelegramRichEditor
  value={message}
  onChange={setMessage}
  showVariableHelper={true}
  placeholder="Введите текст сообщения..."
/>
```

### Настройка высоты

```tsx
<TelegramRichEditor
  value={message}
  onChange={setMessage}
  minHeight="300px"
/>
```

## Места использования

### 1. Workflow конструктор

**Файл:** `src/features/workflow/components/workflow-properties.tsx`

Используется для редактирования текста сообщений в нодах workflow.

```tsx
<TelegramRichEditor
  value={nodeConfig.message?.text || ''}
  onChange={(text) => {
    setNodeConfig((prevConfig) => ({
      ...prevConfig,
      message: {
        ...prevConfig.message,
        text,
        parseMode: 'HTML'
      }
    }));
  }}
  placeholder='Введите текст сообщения...'
  showVariableHelper={true}
  minHeight='200px'
/>
```

### 2. Бот-конструктор

**Файл:** `src/features/bot-constructor/components/bot-constructor-properties.tsx`

Используется для редактирования сообщений в нодах бота.

```tsx
<TelegramRichEditor
  value={localNode.data.config.message?.text || ''}
  onChange={(text) =>
    updateNodeData({
      config: {
        ...localNode.data.config,
        message: {
          ...localNode.data.config.message,
          text,
          parseMode: 'HTML'
        }
      }
    })
  }
  placeholder='Введите текст сообщения...'
  showVariableHelper={true}
  minHeight='200px'
/>
```

### 3. Система бонусов - массовые уведомления

**Файл:** `src/features/bonuses/components/rich-notification-dialog.tsx`

Используется через обертку `TelegramMessageEditor` для создания массовых уведомлений.

```tsx
<TelegramMessageEditor
  value={field.value}
  onChange={field.onChange}
  placeholder='Введите текст уведомления...'
  showVariableHelper={true}
/>
```

## API

### Props

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `value` | `string` | - | HTML строка с текстом сообщения |
| `onChange` | `(value: string) => void` | - | Callback при изменении текста |
| `placeholder` | `string` | `'Введите текст сообщения...'` | Placeholder текст |
| `className` | `string` | - | Дополнительные CSS классы |
| `showVariableHelper` | `boolean` | `true` | Показывать кнопку выбора переменных |
| `minHeight` | `string` | `'150px'` | Минимальная высота редактора |

## Переменные

Редактор поддерживает вставку переменных в формате `{variable.name}`. Доступные переменные:

### Пользовательские данные
- `{user.firstName}` - Имя пользователя
- `{user.lastName}` - Фамилия пользователя
- `{user.fullName}` - Полное имя
- `{user.username}` - Username в Telegram
- `{user.telegramId}` - ID пользователя в Telegram

### Бонусная система
- `{user.balance}` - Текущий баланс бонусов
- `{user.balanceFormatted}` - Форматированный баланс
- `{user.currentLevel}` - Текущий уровень
- `{user.referralCode}` - Реферальный код

### Telegram данные
- `{telegram.chatId}` - ID чата
- `{telegram.userId}` - ID пользователя
- `{telegram.messageId}` - ID сообщения

## Технические детали

### Архитектура

Редактор построен на базе [Lexical](https://lexical.dev/) - современного фреймворка для создания текстовых редакторов от Meta.

**Основные компоненты:**

1. **TelegramRichEditor** - основной компонент редактора
2. **ToolbarPlugin** - панель инструментов форматирования
3. **HTMLConverterPlugin** - конвертация HTML ↔ Lexical
4. **VariableInsertPlugin** - вставка переменных

### Конвертация HTML

Редактор автоматически конвертирует:
- **Входящий HTML** → Lexical EditorState (при инициализации)
- **Lexical EditorState** → HTML (при каждом изменении)

Это позволяет сохранять данные в базе как HTML и использовать их напрямую в Telegram API.

### Безопасность

Редактор использует только безопасные HTML теги, поддерживаемые Telegram:
- `<b>`, `<i>`, `<u>`, `<s>` - форматирование текста
- `<code>`, `<pre>` - код
- `<a href="...">` - ссылки

Все остальные теги автоматически удаляются при конвертации.

## Миграция со старого редактора

Если вы использовали старый `MessageEditor` или `TelegramMessageEditor`, миграция проста:

### Было:
```tsx
<MessageEditor
  value={text}
  onChange={setText}
  keyboard={keyboard}
  onKeyboardChange={setKeyboard}
  showPreview={true}
  showVariableHelper={true}
/>
```

### Стало:
```tsx
<TelegramRichEditor
  value={text}
  onChange={setText}
  showVariableHelper={true}
/>

{/* Клавиатура теперь отдельно */}
<KeyboardEditor
  value={keyboard}
  onChange={setKeyboard}
/>
```

## Troubleshooting

### Редактор не отображается

Убедитесь, что установлены все зависимости:
```bash
yarn install
```

### Форматирование не работает

Проверьте, что используется режим парсинга `HTML`:
```tsx
parseMode: 'HTML'
```

### Переменные не вставляются

Убедитесь, что `showVariableHelper={true}` и компонент `VariableSelector` доступен.

## Roadmap

- [ ] Поддержка Markdown режима
- [ ] Drag & drop изображений
- [ ] Предпросмотр в стиле Telegram
- [ ] Шаблоны сообщений
- [ ] Эмодзи пикер

## Лицензия

MIT
