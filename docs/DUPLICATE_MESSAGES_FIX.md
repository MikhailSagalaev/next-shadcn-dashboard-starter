# 🐛 Исправление дубликата сообщений (Workflow + Fallback)

**Дата:** 2025-10-14  
**Приоритет:** 🔴 P0 (КРИТИЧНЫЙ)  
**Статус:** ✅ ИСПРАВЛЕНО

---

## 📋 Описание проблемы

Бот отправлял **ДВА сообщения** на каждый `/start`:
1. ✅ Сообщение из workflow (корректное)
2. ❌ Fallback сообщение "⚠️ Для этого бота не настроен активный сценарий"

### Пример бага:
```
gupilbot, [14.10.2025 17:57]
🎁 Добро пожаловать в программу лояльности!
💰 Получите приветственные бонусы прямо сейчас!
📱 Для регистрации, пожалуйста, поделитесь вашим номером телефона...

gupilbot, [14.10.2025 17:57]
👋 Добро пожаловать!
⚠️ Для этого бота не настроен активный сценарий (workflow).
```

---

## 🔍 Корневая причина

### Ошибочная логика в `src/lib/telegram/bot.ts`:

```typescript
// ❌ БЫЛО (НЕПРАВИЛЬНО):
const processed = await WorkflowRuntimeService.executeWorkflow(...);

if (processed) {
  // Workflow успешно выполнился
  return; // Останавливаем middleware
} else {
  // Workflow вернул false (ошибка или не найден)
  await next(); // ❌ ВЫЗЫВАЕМ FALLBACK HANDLERS!
}
```

### Проблема:
1. `executeWorkflow()` возвращал `false` при **любой ошибке** в workflow
2. Даже если workflow **уже отправил сообщение**, но потом упал с ошибкой → `processed = false`
3. Код вызывал `await next()` → запускались fallback handlers
4. Пользователь получал **и workflow сообщение, и fallback**

---

## ✅ Решение

### 1. Добавлен метод `hasActiveWorkflow()`
Быстрая проверка наличия активного workflow **БЕЗ** его выполнения:

```typescript
// src/lib/services/workflow-runtime.service.ts
static async hasActiveWorkflow(projectId: string): Promise<boolean> {
  // Проверяем кэш
  if (this.activeVersionsCache.has(projectId)) {
    return true;
  }

  // Быстрая проверка в БД (только count)
  const count = await db.workflowVersion.count({
    where: {
      workflow: { projectId, isActive: true },
      isActive: true
    }
  });

  return count > 0;
}
```

### 2. Переписана логика middleware

```typescript
// ✅ СТАЛО (ПРАВИЛЬНО):
bot.use(async (ctx, next) => {
  try {
    const projectId = ctx.session?.projectId;
    if (!projectId) {
      await next();
      return;
    }

    // 1️⃣ Проверяем наличие workflow ДО выполнения
    const hasActiveWorkflow = await WorkflowRuntimeService.hasActiveWorkflow(projectId);
    
    if (!hasActiveWorkflow) {
      // Workflow не существует → используем fallback
      await next();
      return;
    }

    // 2️⃣ Выполняем workflow
    await WorkflowRuntimeService.executeWorkflow(projectId, trigger, ctx);

    // 3️⃣ КРИТИЧНО: ВСЕГДА останавливаем middleware
    // Даже если workflow вернул false (ошибка), НЕ вызываем fallback
    return; // ← БЕЗ await next()!
    
  } catch (error) {
    logger.error('Критическая ошибка при обработке workflow', { error });
    // При ошибке тоже НЕ вызываем fallback
    return;
  }
});
```

---

## 🎯 Ключевые изменения

### До фикса:
- ❌ `if (processed) { return } else { await next() }`
- ❌ Fallback вызывался при **любой ошибке** в workflow
- ❌ Дублирование сообщений

### После фикса:
- ✅ Проверка `hasActiveWorkflow()` **перед** выполнением
- ✅ Middleware **ВСЕГДА** останавливается после попытки workflow
- ✅ Fallback вызывается **только если workflow не существует**
- ✅ Нет дублирования сообщений

---

## 📊 Сравнение поведения

| Ситуация | До фикса | После фикса |
|----------|----------|-------------|
| **Workflow успешно выполнился** | ✅ Только workflow сообщение | ✅ Только workflow сообщение |
| **Workflow упал с ошибкой** | ❌ Workflow + Fallback | ✅ Только workflow сообщение (или ошибка) |
| **Workflow не найден** | ✅ Fallback | ✅ Fallback |
| **Критическая ошибка (try-catch)** | ❌ Fallback | ✅ Без сообщений (логируется) |

---

## 🧪 Тестирование

### Сценарий 1: Успешный workflow
```bash
# Вход: /start
# Ожидание: Одно сообщение из workflow
# Результат: ✅ PASS
```

### Сценарий 2: Workflow с ошибкой (condition fail)
```bash
# Вход: /start
# Ожидание: Сообщение из workflow (до ошибки), без fallback
# Результат: ✅ PASS
```

### Сценарий 3: Workflow не активирован
```bash
# Вход: /start
# Ожидание: Fallback сообщение
# Результат: ✅ PASS
```

---

## 📝 Файлы изменены

1. **`src/lib/telegram/bot.ts`**
   - Полностью переписана логика middleware
   - Убран ошибочный `if-else` с `await next()`
   - Добавлена проверка `hasActiveWorkflow()`

2. **`src/lib/services/workflow-runtime.service.ts`**
   - Добавлен метод `hasActiveWorkflow(projectId)`
   - Удален дубликат метода (был в конце файла)

3. **`docs/changelog.md`**
   - Добавлена запись о фиксе

---

## 🚀 Рекомендации

### Для разработчиков:
1. **НЕ вызывайте `await next()` после попытки выполнения workflow**
2. Используйте `hasActiveWorkflow()` для проверки наличия workflow
3. Логируйте ошибки, но не пробрасывайте их в fallback

### Для пользователей:
1. Проверьте, что workflow активирован в админ-панели
2. Если бот не отвечает, проверьте логи на наличие ошибок в workflow
3. Fallback сообщение теперь появляется **только** если workflow не настроен

---

## ✅ Чеклист фикса

- [x] Добавлен `hasActiveWorkflow()` метод
- [x] Переписана логика middleware
- [x] Убрана ошибочная логика с `await next()`
- [x] Протестировано на успешном workflow
- [x] Протестировано на workflow с ошибкой
- [x] Протестировано без активного workflow
- [x] Обновлен changelog
- [x] Все TypeScript lint ошибки исправлены

---

**Автор:** AI Assistant + User  
**Проект:** SaaS Bonus System  
**Версия:** 2025-10-14

