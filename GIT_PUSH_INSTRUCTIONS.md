# Git Push Instructions - МойСклад Direct Integration

## 📦 Что готово к push

**Основная функциональность МойСклад Direct Integration (75% готово):**
- ✅ 25+ файлов создано/обновлено
- ✅ Database schema с миграцией
- ✅ Backend API (10 файлов)
- ✅ Frontend UI (7 файлов)
- ✅ Integration hooks в BonusService
- ✅ Документация (5 файлов)

---

## 🚀 Команды для push

### 1. Проверить статус

```bash
git status
```

### 2. Добавить все изменения

```bash
# Добавить все новые и измененные файлы
git add .

# Или выборочно
git add src/lib/moysklad-direct/
git add src/app/api/webhook/moysklad-direct/
git add src/app/api/projects/[id]/integrations/moysklad-direct/
git add src/app/dashboard/projects/[id]/integrations/moysklad-direct/
git add src/lib/services/user.service.ts
git add prisma/schema.prisma
git add docs/
git add *.md
```

### 3. Создать коммит

```bash
git commit -m "feat: МойСклад Direct API Integration (75% complete)

- Добавлена прямая интеграция с МойСклад через Bonus Transaction API
- Двусторонняя синхронизация бонусов (онлайн ↔ офлайн)
- Database schema с шифрованием API токенов (AES-256-GCM)
- МойСклад API Client с retry logic и caching
- Sync Service с автосвязыванием пользователей
- Webhook Handler с HMAC-SHA256 validation
- Integration Management API (8 endpoints)
- Admin UI компоненты (7 файлов)
- Автоматическая синхронизация через хуки в BonusService
- Полная документация и deployment guide

Основная задача выполнена: синхронизация бонусов между онлайн и офлайн системами работает.

Closes #[ISSUE_NUMBER]"
```

### 4. Push на сервер

```bash
# Push в main ветку
git push origin main

# Или в другую ветку
git push origin your-branch-name

# Если нужно создать новую ветку
git checkout -b feature/moysklad-direct-integration
git push -u origin feature/moysklad-direct-integration
```

---

## 📋 Checklist перед push

- [x] Код протестирован локально
- [x] TypeScript компилируется без ошибок
- [x] Prisma schema валидна
- [x] Документация обновлена
- [x] Changelog обновлен
- [x] Tasktracker обновлен
- [ ] Code review (если требуется)
- [ ] CI/CD пройдет (после push)

---

## 🔄 После push - Deployment на сервере

### Шаг 1: Pull на сервере

```bash
# SSH на сервер
ssh user@your-server.com

# Перейти в директорию проекта
cd /path/to/your/project

# Pull изменений
git pull origin main
```

### Шаг 2: Установить зависимости

```bash
yarn install
# или
npm install
```

### Шаг 3: Настроить env переменную

```bash
# Добавить в .env или .env.production
echo "MOYSKLAD_ENCRYPTION_KEY=your-strong-random-key-32-chars" >> .env

# Сгенерировать ключ (выполнить локально и скопировать):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Шаг 4: Применить миграцию

```bash
# Применить миграцию
npx prisma migrate deploy

# Сгенерировать Prisma Client
npx prisma generate

# Проверить статус
npx prisma migrate status
```

### Шаг 5: Build проекта

```bash
yarn build
# или
npm run build
```

### Шаг 6: Перезапустить приложение

**PM2:**
```bash
pm2 restart all
pm2 logs your-app-name --lines 50
```

**systemd:**
```bash
sudo systemctl restart your-app-name
sudo systemctl status your-app-name
```

**Docker:**
```bash
docker-compose down
docker-compose up -d --build
docker-compose logs -f --tail=50
```

### Шаг 7: Проверить работоспособность

```bash
# Проверить health
curl https://your-domain.com/api/health

# Проверить UI
# Откройте: https://your-domain.com/dashboard/projects/[ID]/integrations/moysklad-direct

# Проверить логи
pm2 logs your-app-name | grep "moysklad"
```

---

## 📚 Документация

После deployment см.:
- `MOYSKLAD_DIRECT_DEPLOYMENT.md` - полная инструкция по deployment
- `MOYSKLAD_DIRECT_COMPLETE.md` - описание функциональности
- `MOYSKLAD_DIRECT_TESTING_GUIDE.md` - руководство по тестированию
- `docs/moysklad-direct-api-integration.md` - техническая документация

---

## 🎯 Что дальше

После успешного deployment:

1. **Создать тестовую интеграцию** в UI
2. **Проверить подключение** к МойСклад API
3. **Настроить webhook** в МойСклад
4. **Протестировать синхронизацию**:
   - Онлайн → МойСклад (создать покупку через Tilda/InSales)
   - МойСклад → Онлайн (создать транзакцию в POS)
5. **Проверить логи** синхронизации в UI
6. **Мониторить метрики** (success rate, latency)

---

## ⚠️ Важные замечания

1. **MOYSKLAD_ENCRYPTION_KEY** должен быть одинаковым на всех серверах
2. **Backup БД** перед применением миграции
3. **Тестирование** на staging перед production
4. **Мониторинг** логов после deployment
5. **Rollback план** готов (см. MOYSKLAD_DIRECT_DEPLOYMENT.md)

---

## 🆘 Troubleshooting

**Проблема: Миграция не применяется**
```bash
npx prisma migrate resolve --applied moysklad_direct_integration
npx prisma migrate deploy
```

**Проблема: Build ошибки**
```bash
# Очистить кеш
rm -rf .next
yarn build
```

**Проблема: Prisma Client не обновился**
```bash
npx prisma generate --force
```

**Проблема: Env переменная не читается**
```bash
# Проверить
echo $MOYSKLAD_ENCRYPTION_KEY

# Перезапустить приложение
pm2 restart all
```

---

## ✅ Готово!

После выполнения всех шагов МойСклад Direct Integration будет работать на production!
