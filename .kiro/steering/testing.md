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

## Production smoke-check после явного deploy
1. Проверить, что на сервере запущена ровно одна production-сборка; сохранить её PID и отдельный лог.
2. Дождаться завершения build-процесса с exit code `0`; наличие строк `Compiled` недостаточно.
3. Проверить непустой `/opt/next-shadcn-dashboard-starter/.next/BUILD_ID` и отсутствие ошибок в конце build-лога.
4. Выполнить `pm2 restart bonus-app --update-env`, затем проверить `pm2 status bonus-app`: статус `online`, нет restart loop.
5. Выполнить `curl -fsS http://127.0.0.1:3000/api/health`; приложение и БД должны вернуть healthy-статус.
6. Проверить `pm2 logs bonus-app --lines 100 --nostream`: нет startup exception, Prisma mismatch, Redis/BullMQ loop или ошибок инициализации Telegram/MAX.
7. Если релиз содержит Prisma migration: до запуска приложения выполнить `npx prisma migrate deploy` и `npx prisma generate`, затем проверить их exit code.

Production smoke-check выполняется агентом автономно в рамках подтверждённого deploy. Значения `.env`, passphrase и private key в логи/документацию не копируются.

## Windows специфика
- `Set-Content` вместо `echo` для создания файлов
- `netstat -an | findstr :PORT` для проверки портов
- Проверка запущенных процессов через `Get-Process`
- UTF-8 encoding для всех файлов
