---
inclusion: always
---

# Тестирование

## Обязательные проверки
1. TypeScript компиляция без ошибок
2. Prisma schema валидация
3. API endpoints через curl/Postman
4. Telegram bot в test режиме
5. Webhook integration тесты

## Команды для проверки
```powershell
# TypeScript
npx tsc --noEmit

# Prisma
npx prisma validate
npx prisma generate

# Next.js build
yarn build

# Tests (если есть)
yarn test
```

## Windows специфика
- `Set-Content` вместо `echo` для создания файлов
- `netstat -an | findstr :PORT` для проверки портов
- Проверка запущенных процессов через `Get-Process`
- UTF-8 encoding для всех файлов
