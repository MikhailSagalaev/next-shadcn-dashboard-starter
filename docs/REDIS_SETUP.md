# 🚀 Развертывание Redis на сервере

## 📋 Вариант 1: Установка Redis без Docker (рекомендуется)

### 1. Установка Redis

```bash
# Обновить пакеты
apt update

# Установить Redis
apt install -y redis-server

# Включить автозапуск
systemctl enable redis-server

# Запустить Redis
systemctl start redis-server

# Проверить статус
systemctl status redis-server
```

### 2. Настройка пароля и конфигурации

```bash
# Отредактировать конфиг Redis
nano /etc/redis/redis.conf

# Найти и раскомментировать/добавить:
# requirepass Ro4UV2BT6ZAEfSo5a
# (используйте ваш пароль из .env файла)

# Или установить пароль напрямую
redis-cli CONFIG SET requirepass "Ro4UV2BT6ZAEfSo5a"

# Сохранить настройки в конфиге
redis-cli CONFIG REWRITE
```

### 3. Настройка безопасности

```bash
# Отредактировать /etc/redis/redis.conf
nano /etc/redis/redis.conf

# Установить:
bind 127.0.0.1
port 6379
protected-mode yes
```

### 4. Перезапустить Redis

```bash
systemctl restart redis-server

# Проверить подключение с паролем
redis-cli -a "Ro4UV2BT6ZAEfSo5a" ping
# Должен вернуть: PONG
```

## 📋 Вариант 2: Установка Redis через Docker

```bash
# Перейти в директорию проекта
cd /opt/next-shadcn-dashboard-starter

# Запустить только Redis
docker-compose -f docker-compose.production.yml up -d redis

# Проверить статус
docker ps | grep redis
```

## ✅ Проверка работы Redis

```bash
# Проверить подключение
redis-cli -a "Ro4UV2BT6ZAEfSo5a" ping

# Проверить количество ключей
redis-cli -a "Ro4UV2BT6ZAEfSo5a" DBSIZE

# Проверить информацию о сервере
redis-cli -a "Ro4UV2BT6ZAEfSo5a" INFO server
```

## 🔧 Настройка автозапуска (без Docker)

```bash
# Redis уже настроен на автозапуск через systemctl
# Проверить:
systemctl is-enabled redis-server
# Должно вернуть: enabled
```

## 🛡️ Оптимизация Redis (опционально)

```bash
# Установить максимальную память (256MB)
redis-cli -a "Ro4UV2BT6ZAEfSo5a" CONFIG SET maxmemory 256mb

# Установить политику eviction
redis-cli -a "Ro4UV2BT6ZAEfSo5a" CONFIG SET maxmemory-policy allkeys-lru

# Включить AOF persistence
redis-cli -a "Ro4UV2BT6ZAEfSo5a" CONFIG SET appendonly yes

# Сохранить настройки
redis-cli -a "Ro4UV2BT6ZAEfSo5a" CONFIG REWRITE
```

