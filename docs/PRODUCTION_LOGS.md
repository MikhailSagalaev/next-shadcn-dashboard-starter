# 📊 Просмотр логов на продакшене

## Команды для просмотра логов

### PM2 (Process Manager 2)

```bash
# Просмотр всех логов
pm2 logs

# Просмотр логов конкретного приложения
pm2 logs app-name

# Последние 100 строк
pm2 logs --lines 100

# Только ошибки
pm2 logs --err

# Живой просмотр (follow)
pm2 logs --lines 50 --raw
```

### Systemd

```bash
# Просмотр логов сервиса
journalctl -u your-service-name

# Последние 100 строк
journalctl -u your-service-name -n 100

# Живой просмотр (follow)
journalctl -u your-service-name -f

# С временными метками
journalctl -u your-service-name -n 100 --no-pager

# За последний час
journalctl -u your-service-name --since "1 hour ago"
```

### Docker

```bash
# Просмотр логов контейнера
docker logs container-name

# Последние 100 строк
docker logs --tail 100 container-name

# Живой просмотр (follow)
docker logs -f container-name

# С временными метками
docker logs -t container-name
```

### Node.js / Next.js (прямые логи)

```bash
# Если логи пишутся в файл
tail -f /var/log/your-app/error.log
tail -f /var/log/your-app/combined.log

# Последние 100 строк
tail -n 100 /var/log/your-app/error.log

# Живой просмотр с фильтрацией
tail -f /var/log/your-app/combined.log | grep ERROR
```

## Логи создания проектов

При создании проекта логируются следующие события:

### 1. Начало процесса
```
Creating new project - started
adminId: user_xxx
component: projects-api
```

### 2. Проверка лимитов
```
Project limit check result
adminId: user_xxx
allowed: true
used: 2
limit: 5
planId: plan_xxx
```

### 3. Создание проекта
```
Creating project with data
adminId: user_xxx
projectName: "Мой новый проект"
hasDomain: true
```

### 4. Успешное создание
```
Project created successfully
adminId: user_xxx
projectId: proj_xxx
projectName: "Мой новый проект"
```

### 5. Ошибка (если возникла)
```
Failed to create project
error: "Detailed error message"
stack: "Error stack trace"
component: projects-api
action: POST
```

## Поиск ошибок создания проектов

### PM2
```bash
pm2 logs --lines 200 | grep "Failed to create project"
pm2 logs --lines 200 | grep "Creating new project"
```

### Systemd
```bash
journalctl -u your-service-name -n 500 | grep "Failed to create project"
journalctl -u your-service-name --since "1 hour ago" | grep "project"
```

### Docker
```bash
docker logs container-name 2>&1 | grep "Failed to create project"
docker logs --tail 500 container-name 2>&1 | grep "Creating new project"
```

## Уровни логирования

Приложение использует следующие уровни:

- **info**: Нормальная работа (создание проекта, проверка лимитов)
- **warn**: Предупреждения (лимит достигнут, некорректные данные)
- **error**: Ошибки (неудачное создание, ошибки БД)
- **debug**: Детальная отладка (только в development)

## Анализ проблем

### Ошибка 500 при создании проекта

1. Проверьте логи за последние 5 минут:
   ```bash
   pm2 logs --lines 100 | grep "Creating new project"
   ```

2. Ищите записи с `Failed to create project`:
   ```bash
   pm2 logs --lines 200 | grep -A 5 "Failed to create project"
   ```

3. Проверьте проблемы с БД:
   ```bash
   pm2 logs --lines 200 | grep "Prisma\|Database\|Connection"
   ```

### Проблемы с лимитами

```bash
pm2 logs --lines 100 | grep "Project limit"
```

### Проблемы с валидацией

```bash
pm2 logs --lines 100 | grep "Validation error"
```

## Development режим

В development режиме API возвращает детали ошибок в ответе:

```json
{
  "error": "Ошибка создания проекта",
  "details": "Detailed error message here"
}
```

В production режиме детали скрыты для безопасности.

## Ротация логов

### PM2
```bash
# Настройка ротации логов PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Systemd
Логи автоматически ротируются `journald`.

### Logrotate (для файловых логов)
```bash
# /etc/logrotate.d/your-app
/var/log/your-app/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload your-service-name > /dev/null 2>&1 || true
    endscript
}
```

---

**Дата создания**: 2025-01-30  
**Последнее обновление**: 2025-01-30

