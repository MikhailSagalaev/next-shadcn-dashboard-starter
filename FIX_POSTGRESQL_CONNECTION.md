# 🔧 Решение проблемы с подключением к PostgreSQL

## 🚨 Проблема
```
psql: error: connection to server at "localhost" (::1), port 5432 failed: Connection refused
```

**Причина:** PostgreSQL не запущен на сервере.

---

## ✅ Решение

### Шаг 1: Проверить статус PostgreSQL

```bash
# Проверка через systemd
systemctl status postgresql

# Или через Docker (если используете Docker)
docker ps -a | grep postgres
```

### Шаг 2: Запустить PostgreSQL

**Вариант A: Если используете Docker**

```bash
# Проверить docker-compose файл
cat docker-compose.yml | grep -A 20 postgres

# Запустить контейнер
docker-compose up -d postgres

# Проверить логи
docker logs postgres_container_name

# Проверить что порт 5440 открыт (не 5432!)
docker ps | grep postgres
```

**Вариант B: Если PostgreSQL установлен как системный сервис**

```bash
# Запустить PostgreSQL
systemctl start postgresql

# Включить автозапуск
systemctl enable postgresql

# Проверить статус
systemctl status postgresql
```

### Шаг 3: Проверить порт

**ВАЖНО:** В вашем `.env` указан порт **5440**, а не стандартный 5432!

```bash
# Проверить на каком порту работает PostgreSQL
netstat -tlnp | grep postgres

# Или
ss -tlnp | grep postgres
```

Если PostgreSQL работает на порту **5432**, нужно либо:
1. Изменить порт PostgreSQL на 5440
2. Или изменить `.env` на стандартный порт 5432

### Шаг 4: Применить миграцию

После запуска PostgreSQL:

```bash
# Проверить подключение
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -c "SELECT 1;"

# Если ошибка аутентификации, проверить пароль
# Пароль из вашего .env: bonus_password_123

# Применить миграцию
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -c "ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS metadata JSONB;"

# Сгенерировать Prisma Client
npx prisma generate
```

---

## 🐳 Если используете Docker

### Проверить docker-compose.yml

Убедитесь что в файле указан правильный порт:

```yaml
services:
  postgres:
    image: postgres:15
    container_name: bonus_postgres
    ports:
      - "5440:5432"  # Внешний порт 5440 -> Внутренний 5432
    environment:
      POSTGRES_USER: bonus_admin
      POSTGRES_PASSWORD: bonus_password_123
      POSTGRES_DB: bonus_system
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Запустить/перезапустить контейнеры

```bash
# Остановить всё
docker-compose down

# Запустить заново
docker-compose up -d

# Проверить логи
docker-compose logs postgres

# Проверить что PostgreSQL принимает подключения
docker exec -it bonus_postgres psql -U bonus_admin -d bonus_system -c "SELECT 1;"
```

---

## 🔍 Диагностика

### 1. Проверить переменные окружения

```bash
# Показать DATABASE_URL
cat .env | grep DATABASE_URL

# Должно быть:
# DATABASE_URL=postgresql://bonus_admin:bonus_password_123@127.0.0.1:5440/bonus_system?schema=public
```

### 2. Проверить firewall

```bash
# Ubuntu/Debian
ufw status
ufw allow 5440/tcp

# CentOS/RHEL
firewall-cmd --list-ports
firewall-cmd --add-port=5440/tcp --permanent
firewall-cmd --reload
```

### 3. Проверить pg_hba.conf (если системный PostgreSQL)

```bash
# Найти файл конфигурации
sudo -u postgres psql -c "SHOW hba_file;"

# Добавить строку для локального доступа
# host    all             all             127.0.0.1/32            md5
```

---

## ⚡ Быстрое решение (Docker)

Если у вас есть `docker-compose.yml`:

```bash
# В директории проекта
cd /opt/next-shadcn-dashboard-starter

# Запустить PostgreSQL и Redis
docker-compose up -d

# Подождать 10 секунд
sleep 10

# Проверить статус
docker ps

# Применить миграцию
npx prisma db push

# Сгенерировать клиент
npx prisma generate
```

---

## 🎯 Итоговая проверка

После запуска PostgreSQL выполните:

```bash
# 1. Проверка подключения
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -c "\dt"

# 2. Применение миграции
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system << EOF
ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS metadata JSONB;
\d admin_accounts
EOF

# 3. Prisma generate
npx prisma generate

# 4. Проверка что всё работает
npx prisma db pull
```

---

## 📞 Если ничего не помогло

Попробуйте **полную переустановку PostgreSQL через Docker**:

```bash
# Удалить старый контейнер и данные
docker-compose down -v
docker volume prune -f

# Создать заново
docker-compose up -d postgres

# Подождать запуска
sleep 15

# Применить миграции Prisma
npx prisma db push

# Готово!
```

**Успехов! 🚀**

