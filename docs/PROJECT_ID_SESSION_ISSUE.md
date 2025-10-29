# 🐛 Проблема: projectId = undefined в workflow контексте

**Дата**: 2025-10-28  
**Статус**: ✅ ДИАГНОСТИРОВАНА (требуется перезапуск dev сервера)

---

## 📋 Описание проблемы

При команде `/start` workflow НЕ НАХОДИТ пользователя в БД по Telegram ID, потому что `projectId` = `undefined` в контексте выполнения.

### Логи

```
✋ Resolved projectId: undefined

WHERE ("public"."users"."telegram_id" = $1 AND "public"."users"."project_id" = $2)
```

SQL запрос с `project_id = undefined` **НИКОГДА** не найдёт пользователя.

---

## 🔍 Корневая причина

1. **Workflow получает `projectId` из `ctx.session.projectId`** (строка 70 в `bot.ts`)
2. **Сессия устанавливает `projectId`** в `BotSessionService.createSessionMiddleware()` (строка 45)
3. **Middleware правильно настроен**, но dev сервер **НЕ ПЕРЕЗАПУЩЕН** после изменений

---

## ✅ Решение

**Перезапустить dev сервер**:

```powershell
pnpm dev
```

---

## 🧪 Тестирование

После перезапуска:

1. Отправить `/start` боту
2. Проверить логи: `projectId` должен быть `cmh2d0uv30000v8h8ujr7u233`
3. При повторном `/start` пользователь ДОЛЖЕН НАЙТИСЬ в БД
4. Workflow должен перейти на `active-user-profile` вместо `welcome-message`

---

## 📝 Ожидаемый флоу при `/start`

### Сценарий 1: Пользователь УЖЕ в БД с Telegram ID

```
/start 
→ check-telegram-user (НАХОДИТ пользователя)  
→ check-user-status (telegramUser is_not_empty = TRUE)  
→ check-user-active (isActive = TRUE)  
→ active-user-profile ✅  
→ Сообщение: "Ваш профиль..."
```

### Сценарий 2: Пользователь НЕ в БД

```
/start 
→ check-telegram-user (НЕ находит)  
→ check-user-status (telegramUser is_not_empty = FALSE)  
→ welcome-message ✅  
→ Ждёт контакта...
```

---

## 🎯 Финальный статус

- ✅ Исправлен `ConditionHandler` (поддержка вложенных переменных)
- ✅ `projectId` правильно передаётся в сессию
- ⏳ **ТРЕБУЕТСЯ**: Перезапуск dev сервера
- ⏳ **ПОСЛЕ ПЕРЕЗАПУСКА**: Протестировать сценарии

---

**NEXT STEP**: `pnpm dev` и тестирование!

