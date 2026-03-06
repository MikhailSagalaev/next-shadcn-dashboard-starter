# ⚡ Быстрое исправление - 2 команды

## На сервере выполнить:

```powershell
npx prisma generate && pm2 restart bonus-app
```

## Проверка:

Открыть: https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct

Нажать **"Тест подключения"** → должно быть ✅ **"Подключение успешно"**

---

## Что исправлено:

1. ✅ Test endpoint - async params (Next.js 15)
2. ✅ Webhook endpoint - убрана неправильная валидация подписи
3. ✅ Webhook endpoint - async params (Next.js 15)

## Почему нужен `npx prisma generate`:

После применения миграции БД нужно перегенерировать Prisma Client, чтобы TypeScript увидел новые модели:
- `MoySkladDirectIntegration`
- `MoySkladDirectSyncLog`

## Подробности:

- `MOYSKLAD_FINAL_FIX.md` - полное описание исправлений
- `MOYSKLAD_PRISMA_FIX.md` - детали проблемы с Prisma
- `MOYSKLAD_DIRECT_SUCCESS.md` - инструкция по использованию
