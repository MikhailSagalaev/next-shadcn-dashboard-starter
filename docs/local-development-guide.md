# 🏠 Руководство по локальной разработке ботов

## 🚨 Проблема 409 Conflict при локальном запуске

### Причина ошибки
Ошибка `409 Conflict: terminated by other getUpdates request` возникает когда:
1. **Один токен используется в нескольких местах одновременно**
2. **Telegram API не позволяет нескольким экземплярам бота работать с одним токеном**
3. **Локальная разработка часто приводит к конфликтам**

### 📋 Решения для локальной разработки

#### 1. **Использование разных токенов для разных сред**

```bash
# Создайте отдельного бота для локальной разработки
# Через @BotFather в Telegram:
# /newbot -> LocalDevBot -> получите новый токен
```

**Настройка переменных окружения:**
```env
# .env.local
BOT_TOKEN_LOCAL=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_TOKEN_PROD=7739551433:AAEkg4ogMW6g-IBMV4oxvHQ7rmP4jNlbClw
```

#### 2. **Проверка запущенных экземпляров**

```bash
# Проверьте процессы Node.js
ps aux | grep node

# Проверьте порты
netstat -tulpn | grep :3000

# Остановите все экземпляры бота
pkill -f "node.*bot"
```

#### 3. **Использование ngrok для webhook режима**

```bash
# Установите ngrok
npm install -g ngrok

# Запустите туннель
ngrok http 3000

# Используйте HTTPS URL для webhook
# https://abc123.ngrok.io -> ваш локальный сервер
```

#### 4. **Настройка BotManager для локальной разработки**

```typescript
// src/lib/telegram/bot-manager.ts
class BotManager {
  private isLocalDevelopment = process.env.NODE_ENV === 'development';
  
  async createBot(projectId: string, botSettings: BotSettings) {
    if (this.isLocalDevelopment) {
      // В локальной разработке используем polling
      logger.info('🏠 Локальная разработка - используем polling', {
        projectId,
        component: 'bot-manager'
      });
      
      // Принудительно отключаем webhook
      await bot.api.deleteWebhook({ drop_pending_updates: true });
    }
    
    // ... остальная логика
  }
}
```

### 🛠️ Рекомендуемая настройка для локальной разработки

#### 1. **Создайте отдельного бота для разработки**

```bash
# В Telegram:
# 1. Найдите @BotFather
# 2. Отправьте /newbot
# 3. Назовите бота: YourProjectLocalDev
# 4. Получите токен: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

#### 2. **Настройте переменные окружения**

```env
# .env.local
NODE_ENV=development
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
WEBHOOK_URL=https://your-domain.com
```

#### 3. **Используйте polling вместо webhook**

```typescript
// В локальной разработке принудительно используем polling
if (process.env.NODE_ENV === 'development') {
  // Удаляем webhook если он установлен
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  
  // Запускаем polling
  bot.start();
}
```

### 🔧 Скрипты для диагностики

#### 1. **Проверка состояния бота**

```bash
# Проверьте, не запущен ли бот в другом месте
npx tsx scripts/test-bot-connection.ts YOUR_TOKEN

# Проверьте состояние всех ботов
npx tsx scripts/debug-bot-status.ts
```

#### 2. **Остановка всех экземпляров**

```bash
# Остановите все процессы Node.js
pkill -f node

# Или более специфично
pkill -f "next"
pkill -f "tsx"
```

#### 3. **Проверка портов**

```bash
# Проверьте, какие порты заняты
netstat -tulpn | grep :3000
netstat -tulpn | grep :5006

# Освободите порт если нужно
sudo kill -9 $(lsof -t -i:3000)
```

### 📝 Чек-лист для локальной разработки

- [ ] Используйте отдельный токен для локальной разработки
- [ ] Проверьте, что бот не запущен в другом месте
- [ ] Остановите все лишние процессы Node.js
- [ ] Используйте polling вместо webhook
- [ ] Проверьте переменные окружения
- [ ] Запустите скрипты диагностики

### 🚀 Рекомендации для продакшена

1. **Используйте webhook режим** - более надежный для продакшена
2. **Настройте HTTPS** - обязательно для webhook
3. **Используйте отдельный сервер** - избегайте локальных конфликтов
4. **Настройте мониторинг** - отслеживайте состояние бота

### 🔍 Отладка проблем

#### Если 409 ошибка продолжается:

1. **Проверьте переменные окружения:**
   ```bash
   # Убедитесь, что NODE_ENV=development
   echo $NODE_ENV
   
   # Если не установлен, установите:
   export NODE_ENV=development  # Linux/Mac
   $env:NODE_ENV="development"  # Windows PowerShell
   ```

2. **Проверьте логи:**
   ```bash
   # Ищите в логах
   grep -i "409" logs/*.log
   grep -i "conflict" logs/*.log
   grep -i "локальная разработка" logs/*.log
   ```

3. **Проверьте процессы:**
   ```bash
   # Найдите все процессы с вашим токеном
   ps aux | grep "7739551433"
   
   # Windows PowerShell:
   Get-Process | Where-Object {$_.ProcessName -like "*node*"}
   ```

4. **Используйте скрипты диагностики:**
   ```bash
   # Проверка настроек локальной разработки
   npx tsx scripts/check-local-development.ts <BOT_TOKEN>
   
   # Отладка состояния ботов
   npx tsx scripts/debug-bot-status.ts
   
   # Тестирование подключения бота
   npx tsx scripts/test-bot-connection.ts <BOT_TOKEN>
   ```

5. **Перезапустите систему:**
   ```bash
   # Иногда помогает полный перезапуск
   sudo reboot
   ```

### 📚 Дополнительные ресурсы

- [Grammy.js документация](https://grammy.dev/ru/guide/deployment-types)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [ngrok документация](https://ngrok.com/docs)

---

**Важно:** Для стабильной работы в продакшене рекомендуется развернуть бота на удаленном сервере с использованием webhook режима.
