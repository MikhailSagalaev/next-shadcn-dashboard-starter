# ⚡ Быстрые команды

## 🚀 Запуск проекта

```powershell
# Основной способ (рекомендуется)
.\start.ps1

# Альтернатива через npm
npm run dev
```

## 🧹 Очистка и сброс

```powershell
# Очистка портов и кэша
.\start.ps1 clean

# Полная переустановка зависимостей
Remove-Item node_modules -Recurse -Force
yarn install

# Очистка БД кэша Prisma
npx prisma generate
```

## 🗄️ База данных

```powershell
# Применить миграции
npx prisma migrate dev

# Открыть Prisma Studio (GUI для БД)
npx prisma studio

# Проверить схему
npx prisma validate

# Сгенерировать Prisma Client
npx prisma generate
```

## 🔍 Проверки

```powershell
# TypeScript проверка
npx tsc --noEmit

# Проверка портов
netstat -ano | findstr ":3000"

# Проверка Node процессов
Get-Process node

# Просмотр логов
Get-Content .\dev.log -Wait -Tail 50
```

## 🛑 Остановка

```powershell
# Остановить все Node процессы
Get-Process node | Stop-Process -Force

# Освободить конкретный порт (например 3000)
netstat -ano | findstr ":3000" | ForEach-Object { $_ -match '\s+(\d+)$' | Out-Null; taskkill /F /PID $matches[1] }
```

## 🏗️ Сборка

```powershell
# Production сборка
.\start.ps1 build

# Или через npm
npm run build

# Запуск production версии
npm start
```

## 🧪 Тестирование

```powershell
# Запуск тестов
npm test

# Тесты с coverage
npm run test:coverage

# Отдельный тест
npm test -- workflow-runtime.service.test
```

## 📦 Зависимости

```powershell
# Установка зависимостей
yarn install

# Добавить пакет
yarn add <package>

# Добавить dev зависимость
yarn add -D <package>

# Обновить зависимости
yarn upgrade

# Проверить устаревшие пакеты
yarn outdated
```

## 🔧 Workflow

```powershell
# Открыть конструктор workflow
# URL: http://localhost:3000/dashboard/projects/[projectId]/workflow

# Посмотреть активные workflow
npx prisma studio
# Затем откройте таблицу "workflow"
```

## 🤖 Telegram Bot

```powershell
# Очистить webhook
node -e "require('./scripts/clear-bot-webhooks.ts')"

# Проверить статус бота
node -e "require('./scripts/debug-bot-status.ts')"

# Тест подключения
node -e "require('./scripts/test-bot-connection.ts')"
```

## 📝 Логи

```powershell
# Смотреть логи в реальном времени
Get-Content .\dev.log -Wait

# Последние 50 строк
Get-Content .\dev.log -Tail 50

# Поиск ошибок в логах
Select-String -Path .\dev.log -Pattern "error|Error|ERROR"

# Очистить логи
Clear-Content .\dev.log
```

## 🎨 UI/Styling

```powershell
# Обновить Tailwind
npx tailwindcss -i ./src/app/globals.css -o ./dist/output.css

# Проверить неиспользуемые CSS
npx purgecss --config ./purgecss.config.js
```

## 🔐 Безопасность

```powershell
# Проверка уязвимостей
npm audit

# Автоматическое исправление
npm audit fix

# Проверка лицензий
npx license-checker
```

## 📊 Анализ

```powershell
# Размер бандла
npm run analyze

# Производительность сборки
npm run build -- --profile

# Tree shaking анализ
npx webpack-bundle-analyzer
```

## 🌐 Полезные URLs (после запуска)

```
Приложение:     http://localhost:3000
Админка:        http://localhost:3000/dashboard
Workflow:       http://localhost:3000/dashboard/projects/[id]/workflow
Настройки бота: http://localhost:3000/dashboard/projects/[id]/bot
API Docs:       http://localhost:3000/api-docs (если настроен)
Prisma Studio:  http://localhost:5555 (после npx prisma studio)
```

## 🎯 Шпаргалка PowerShell

```powershell
# Найти файл
Get-ChildItem -Recurse -Filter "*.tsx" | Where-Object {$_.Name -like "*bot*"}

# Поиск в файлах
Select-String -Path .\src\**\*.ts -Pattern "WorkflowRuntime"

# Копирование с перезаписью
Copy-Item .\env.example.txt .\env.local -Force

# Создать файл
New-Item -ItemType File -Path .\test.txt -Force

# Удалить папку рекурсивно
Remove-Item .\node_modules -Recurse -Force

# Запуск в фоне
Start-Process powershell -ArgumentList "-File .\start.ps1 dev"
```

---

**💡 Совет:** Добавьте этот файл в закладки для быстрого доступа!

