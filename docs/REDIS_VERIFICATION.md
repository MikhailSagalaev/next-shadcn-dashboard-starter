# ✅ Быстрая проверка Redis на сервере

## 🚀 Быстрый чеклист (5 минут)

### 1. Проверить Redis запущен
```bash
systemctl status redis-server
redis-cli -a 'Ro4UV2BT6ZAEFsSo5a' ping
# ✅ Ожидается: PONG
```

### 2. Проверить .env файл
```bash
cd /opt/next-shadcn-dashboard-starter
cat .env | grep -E '^REDIS|^NODE_ENV'
# ✅ Должно быть:
# NODE_ENV=production
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=Ro4UV2BT6ZAEFsSo5a
```

### 3. Обновить код (если нужно)
```bash
git pull origin main
```

### 4. Перезапустить приложение
```bash
pm2 restart all --update-env
```

### 5. Проверить подключение в логах
```bash
pm2 logs bonus-app --lines 50 --nostream | grep -i redis
# ✅ Должно быть: "Redis connected successfully"
# ❌ НЕ должно быть: "Redis disabled: using in-memory fallback"
```

### 6. Проверить кеширование работает
```bash
# Отправить сообщение боту через Telegram, затем:
redis-cli -a 'Ro4UV2BT6ZAEFsSo5a' DBSIZE
# ✅ Если > 0 - кеширование работает!

redis-cli -a 'Ro4UV2BT6ZAEFsSo5a' KEYS 'workflow:*' | head -5
redis-cli -a 'Ro4UV2BT6ZAEFsSo5a' KEYS 'user:*' | head -5
# ✅ Если есть ключи - все работает!
```

## 🔧 Если что-то не работает

### Проблема: "Redis disabled: using in-memory fallback"
**Решение:**
```bash
# Проверить что в .env есть:
grep -E 'REDIS_HOST|REDIS_URL' .env

# Если нет - добавить:
echo "REDIS_HOST=localhost" >> .env
echo "REDIS_PORT=6379" >> .env
echo "REDIS_PASSWORD=Ro4UV2BT6ZAEFsSo5a" >> .env

# Перезапустить:
pm2 restart all --update-env
```

### Проблема: "Redis connection error"
**Решение:**
```bash
# Проверить Redis запущен:
systemctl status redis-server

# Проверить пароль правильный:
redis-cli -a 'Ro4UV2BT6ZAEFsSo5a' ping

# Проверить конфиг Redis:
cat /etc/redis/redis.conf | grep requirepass

# Если пароль не совпадает - исправить в /etc/redis/redis.conf
# Затем: systemctl restart redis-server
```

### Проблема: Нет ключей в Redis
**Решение:**
```bash
# Отправить сообщение боту
# Подождать 1-2 секунды
# Проверить снова:
redis-cli -a 'Ro4UV2BT6ZAEFsSo5a' DBSIZE

# Если все равно 0 - проверить логи приложения:
pm2 logs bonus-app --lines 200 | grep -E 'error|Error|ERROR'
```

## 📊 Проверка производительности

```bash
# Отправить несколько сообщений боту
# Проверить время обработки в логах:
pm2 logs bonus-app --lines 500 | grep -E 'processingTime|cache hit|cache miss'

# ✅ Хорошие показатели:
# - cache hit rate > 80%
# - processingTime < 500ms
# - время отклика бота < 1 секунды
```

## 🎯 Итоговая проверка

Все должно работать если:
1. ✅ `redis-cli ping` возвращает `PONG`
2. ✅ `pm2 logs` показывает `Redis connected successfully`
3. ✅ После отправки сообщения боту `DBSIZE > 0`
4. ✅ Бот отвечает быстро (< 1 секунды)

