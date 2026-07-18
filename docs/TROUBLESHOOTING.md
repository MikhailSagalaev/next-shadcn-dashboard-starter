# 🔧 Troubleshooting - Решение проблем

## 🚨 Частые проблемы и решения

### ❌ [400] Bad request: Invalid JSON (Tilda Webhook)

**Симптомы:**
```json
{
  "error": "Invalid JSON"
}
```

**Причина:**  
Tilda отправляет данные в формате `application/x-www-form-urlencoded`, а не JSON.

**Решение:**  
✅ Система теперь поддерживает оба формата. Обновите до последней версии.

**Подробнее:** [Tilda Webhook Setup](./tilda-webhook-setup.md)

---

### ❌ Invalid webhook secret

**Симптомы:**
```json
{
  "error": "Invalid webhook secret"
}
```

**Причина:**  
Неправильный webhook secret в URL.

**Решение:**
1. Откройте админ панель
2. Перейдите в настройки проекта
3. Скопируйте правильный webhook secret
4. Обновите URL: `https://your-domain.com/api/webhook/CORRECT_SECRET`

---

### ❌ User not found

**Симптомы:**
```json
{
  "error": "User not found"
}
```

**Причина:**  
Пользователь с указанным email/phone не зарегистрирован в системе.

**Решение:**
1. Убедитесь, что виджет установлен на сайте
2. Пользователь должен сначала зарегистрироваться через виджет
3. Проверьте, что email/phone совпадают в webhook и виджете

---

### ❌ USER_NOT_ACTIVE (403)

**Симптомы:**
```json
{
  "error": "User is not active",
  "code": "USER_NOT_ACTIVE"
}
```

**Причина:**  
Проект работает в режиме `WITH_BOT`, пользователь не активировал аккаунт через Telegram.

**Решение:**
1. Пользователь должен привязать аккаунт в Telegram боте
2. Или переключите проект в режим `WITHOUT_BOT` (автоактивация)

---

### ❌ Telegram bot not responding

**Симптомы:**  
Бот не отвечает на команды в Telegram.

**Причина:**  
Бот не запущен или неправильно настроен.

**Решение:**
1. Проверьте статус бота в админ панели
2. Убедитесь, что `TELEGRAM_BOT_TOKEN` правильный
3. Перезапустите бот через админ панель
4. Проверьте логи: `yarn logs:bot`

---

### ❌ Bonuses not earned after purchase

**Симптомы:**  
После покупки бонусы не начислились.

**Причина:**  
Неправильная настройка `bonusBehavior` или webhook не отправлен.

**Решение:**
1. Проверьте логи webhook в админ панели
2. Убедитесь, что webhook отправляется после оплаты
3. Проверьте настройки `bonusBehavior`:
   - `EARN_ONLY` - только начисление
   - `SPEND_ONLY` - только списание
   - `SPEND_AND_EARN` - и то, и другое
4. Проверьте, что `amount` > `minOrderAmount`

---

### ❌ Cannot spend bonuses

**Симптомы:**  
Виджет не позволяет списать бонусы.

**Причина:**  
Недостаточно бонусов или неправильная настройка.

**Решение:**
1. Проверьте баланс пользователя
2. Убедитесь, что `bonusBehavior` = `SPEND_ONLY` или `SPEND_AND_EARN`
3. Проверьте, что сумма заказа >= `minOrderAmount`
4. Убедитесь, что бонусы не истекли (expiry date)

---

### ❌ Widget not loading on Tilda

**Симптомы:**  
Виджет не появляется на странице Tilda.

**Причина:**  
Неправильная установка или конфликт скриптов.

**Решение:**
1. Проверьте, что скрипт добавлен в "Настройки сайта" → "HTML-код для вставки внутри HEAD"
2. Используйте правильный loader:
   ```html
   <script src="https://your-domain.com/widget-loader.js"></script>
   ```
3. Проверьте консоль браузера на ошибки (F12)
4. Убедитесь, что `projectId` правильный

**Подробнее:** [Tilda Adapter Guide](./tilda-adapter-guide.md)

---

### ❌ Database connection error

**Симптомы:**
```
Error: Can't reach database server
```

**Причина:**  
Неправильная настройка `DATABASE_URL` или база данных недоступна.

**Решение:**
1. Проверьте `.env.local`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
   ```
2. Убедитесь, что PostgreSQL запущен
3. Проверьте подключение:
   ```powershell
   npx prisma db pull
   ```
4. Примените миграции:
   ```powershell
   npx prisma migrate deploy
   ```

---

### ❌ Build errors

**Симптомы:**  
Ошибки при `yarn build`.

**Решение:**
1. Проверьте TypeScript ошибки:
   ```powershell
   npx tsc --noEmit
   ```
2. Проверьте ESLint:
   ```powershell
   yarn lint
   ```
3. Очистите кеш:
   ```powershell
   Remove-Item -Recurse -Force .next
   yarn build
   ```

---

### ❌ Production build завис или запущен дважды

**Симптомы:**
- build долго не создаёт `.next/BUILD_ID`;
- одновременно видны несколько `next build`/`yarn build` процессов;
- VPS исчерпал RAM/swap, SSH отвечает медленно;
- в логе есть compile-сообщения, но процесс не завершился.

**Диагностика:**

```bash
cd /opt/next-shadcn-dashboard-starter
pgrep -af "next build|yarn.*build"
free -h
tail -n 100 logs/deploy-build.log
```

Наличие `Compiled successfully` не означает завершение всей сборки: дождитесь exit code `0` и непустого `.next/BUILD_ID`.

**Исправление:**
1. Не запускайте ещё один build.
2. Определите PID основной и случайно запущенной сборки; завершите только лишний процесс (`kill <pid>`, после таймаута — `kill -9 <pid>`). Не используйте `pkill node` или `killall`.
3. На low-memory VPS остановите приложение: `pm2 stop bonus-app`.
4. Когда build-процессов больше нет, удалите неполный `.next` и запустите одну Webpack-сборку:
   ```bash
   rm -rf .next
   mkdir -p logs
   nohup env NEXT_PHASE=phase-production-build NODE_OPTIONS=--max-old-space-size=1536 yarn next build --webpack > logs/deploy-build.log 2>&1 &
   echo $! > /tmp/bonus-build.pid
   ```
5. Контролируйте сохранённый PID и лог. После успешного завершения проверьте `test -s .next/BUILD_ID`.
6. Только затем выполните `pm2 restart bonus-app --update-env`, health-check и просмотр startup-логов.

**Профилактика SSH quoting:** не передавайте `|`, `$()` и сложные конструкции внутри незащищённой интерполируемой SSH-строки. В PowerShell используйте single-quoted `$remote`/here-string и передавайте сценарий в `ssh ... 'bash -s'`. Ошибочный quoting уже может породить второй build, выполняя часть команды не на той стороне.

Полный сценарий: [VPS Deployment Guide](./VPS_DEPLOYMENT_GUIDE.md#фактический-pm2-deploy-этого-проекта).

---

## 🧪 Отладка

### Проверка webhook

1. Используйте тестовую страницу:
   ```
   https://your-domain.com/test-tilda-webhook.html
   ```

2. Проверьте логи в админ панели:
   - Перейдите в "Webhook Logs"
   - Найдите последние запросы
   - Проверьте `status`, `success`, `body`

### Проверка базы данных

```powershell
# Открыть Prisma Studio
npx prisma studio

# Проверить схему
npx prisma validate

# Посмотреть данные
npx prisma db pull
```

### Проверка логов

```powershell
# Логи приложения
yarn logs

# Логи ботов
yarn logs:bot

# Логи в реальном времени
yarn logs:follow
```

---

## 📚 Дополнительные ресурсы

- [API Documentation](./api.md)
- [Webhook Integration Guide](./webhook-integration.md)
- [Tilda Webhook Setup](./tilda-webhook-setup.md)
- [Telegram Bots Guide](./telegram-bots.md)
- [Database Schema](./database-schema.md)

---

## 🆘 Нужна помощь?

Если проблема не решена:
1. Проверьте логи webhook и приложения
2. Используйте тестовые страницы для отладки
3. Убедитесь, что система обновлена до последней версии
4. Проверьте документацию по конкретной проблеме
