# Настройка Grafana + Loki для мониторинга

Это руководство описывает процесс настройки self-hosted решения для мониторинга ошибок и логов с использованием Grafana и Loki.

## Предварительные требования

- Docker и Docker Compose установлены
- Порты 3000 (Grafana) и 3100 (Loki) свободны
- Достаточно места на диске для хранения логов (рекомендуется минимум 10GB)

## Быстрый старт

### 1. Запуск сервисов мониторинга

```bash
# Запуск Grafana + Loki + Promtail
docker-compose -f docker-compose.monitoring.yml up -d

# Проверка статуса
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Доступ к Grafana

1. Откройте браузер и перейдите на `http://localhost:3000`
2. Войдите с учетными данными:
   - **Username**: `admin`
   - **Password**: `admin` (или значение из `GRAFANA_ADMIN_PASSWORD`)
3. При первом входе вас попросят изменить пароль

### 3. Проверка работы Loki

1. В Grafana перейдите в **Configuration > Data Sources**
2. Убедитесь, что datasource **Loki** настроен и доступен
3. Нажмите **Save & Test** для проверки подключения

## Конфигурация

### Переменные окружения

Добавьте в ваш `.env` файл:

```env
GRAFANA_URL=http://localhost:3000
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your_grafana_api_key_here
GRAFANA_ADMIN_PASSWORD=admin
LOKI_URL=http://localhost:3100
```

### Настройка Grafana API Key

1. Войдите в Grafana
2. Перейдите в **Configuration > API Keys**
3. Создайте новый API Key с правами **Admin**
4. Скопируйте ключ и добавьте в `.env` как `GRAFANA_API_KEY`

## Дашборды

### Автоматический импорт

При первом запуске Grafana автоматически импортирует дашборд "SaaS Bonus System - App Monitoring" из файла `monitoring/grafana/dashboards/app-monitoring.json`.

### Просмотр дашбордов

1. Перейдите в **Dashboards**
2. Откройте "SaaS Bonus System - App Monitoring"

## Сбор логов

### Источники логов

Promtail собирает логи из следующих источников:

1. **Логи приложения** (`./logs/*.log`)
   - Логи из winston logger
   - Формат: JSON с полями `timestamp`, `level`, `message`

2. **Системные логи** (опционально)
   - Системные логи хоста
   - Docker container logs

### Настройка записи логов в файл

Убедитесь, что ваш `logger.ts` записывает логи в файлы:

```typescript
// В logger.ts уже настроена запись в SystemLog
// Дополнительно можно настроить запись в файлы для Promtail
```

## Мониторинг производительности

### Проверка статуса сервисов

```bash
# Статус всех сервисов
docker-compose -f docker-compose.monitoring.yml ps

# Логи Loki
docker-compose -f docker-compose.monitoring.yml logs loki

# Логи Promtail
docker-compose -f docker-compose.monitoring.yml logs promtail

# Логи Grafana
docker-compose -f docker-compose.monitoring.yml logs grafana
```

### Ротация логов

Логи в Loki автоматически удаляются через 30 дней (настраивается в `loki-config.yml`).

### Резервное копирование

Для резервного копирования данных Grafana:

```bash
# Бэкап данных Grafana
docker run --rm -v saas-bonus-monitoring_grafana_data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz -C /data .

# Бэкап данных Loki
docker run --rm -v saas-bonus-monitoring_loki_data:/data -v $(pwd):/backup alpine tar czf /backup/loki-backup.tar.gz -C /data .
```

## Интеграция с приложением

### Логирование ошибок с клиента

Ошибки с клиента автоматически отправляются в SystemLog через API endpoint `/api/logs` и могут быть просмотрены в Grafana через Promtail (если логи записываются в файлы).

### Логирование на сервере

Серверный логгер автоматически записывает ошибки и предупреждения в SystemLog, который может быть синхронизирован с Loki через отдельный экспортер или прямые запросы к API.

## Troubleshooting

### Grafana не запускается

1. Проверьте, свободен ли порт 3000:
   ```bash
   netstat -an | findstr :3000
   ```

2. Проверьте логи:
   ```bash
   docker-compose -f docker-compose.monitoring.yml logs grafana
   ```

### Loki не получает логи

1. Проверьте, что Promtail запущен:
   ```bash
   docker-compose -f docker-compose.monitoring.yml ps promtail
   ```

2. Проверьте логи Promtail:
   ```bash
   docker-compose -f docker-compose.monitoring.yml logs promtail
   ```

3. Убедитесь, что директория `./logs` существует и содержит файлы логов

### Дашборд не отображает данные

1. Проверьте, что Loki datasource настроен правильно
2. Убедитесь, что логи попадают в Loki (проверьте через Explore в Grafana)
3. Проверьте временной диапазон в дашборде

## Production Deployment

### Изменение паролей

**Важно**: Обязательно измените пароли по умолчанию для production!

```env
GRAFANA_ADMIN_PASSWORD=your_secure_password_here
```

### Ограничение доступа

1. Настройте reverse proxy (nginx) для Grafana
2. Включите SSL/TLS
3. Настройте аутентификацию через OAuth или LDAP

### Масштабирование

Для production с высокой нагрузкой:

1. Используйте внешнюю базу данных для Grafana (PostgreSQL)
2. Настройте Loki в режиме кластера
3. Используйте объектное хранилище (S3) для логов Loki

## Дополнительные ресурсы

- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Promtail Documentation](https://grafana.com/docs/loki/latest/clients/promtail/)
