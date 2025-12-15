# Анализ режимов работы проекта

## Текущие режимы

### WITH_BOT (с Telegram ботом)
- ✅ Пользователи создаются неактивными (`isActive = false`)
- ✅ Активация через Telegram бота для траты бонусов
- ✅ Рефералы работают через `utm_ref` + Telegram
- ✅ Реферальные коды генерируются автоматически
- ✅ Реферальные ссылки доступны в боте

### WITHOUT_BOT (без Telegram бота)
- ✅ Пользователи создаются активными (`isActive = true`)
- ✅ Могут тратить бонусы сразу
- ❌ **ПРОБЛЕМА**: Рефералы не работают без Telegram!
- ❌ **ПРОБЛЕМА**: Нет способа получить реферальную ссылку
- ❌ **ПРОБЛЕМА**: Нет интерфейса для управления рефералами

## Решение: Заглушки для режима WITHOUT_BOT ✅

### Реализованные изменения:

1. **UI заглушка в ReferralProgramView**
   - Показывает объяснение почему рефералы недоступны
   - Кнопка для включения Telegram бота
   - Альтернативные способы привлечения пользователей

2. **API защита**
   - GET/PUT `/api/projects/[id]/referral-program` возвращают 403
   - GET `/api/projects/[id]/referral-program/stats` возвращает 403
   - Код ошибки: `REFERRAL_DISABLED_WITHOUT_BOT`

3. **Условная навигация**
   - Ссылка на реферальную программу отключена в режиме WITHOUT_BOT
   - Показывается как неактивная с подсказкой

### Преимущества решения:
- ✅ Простота реализации
- ✅ Понятность для пользователей
- ✅ Мотивация к включению Telegram бота
- ✅ Отсутствие путаницы в интерфейсе

## Техническая реализация

### Изменения в UserService
```typescript
// В createUser для WITHOUT_BOT режима
if (project?.operationMode === 'WITHOUT_BOT') {
  // Автогенерация реферального кода
  const referralCode = ReferralService.generateReferralCode(user.id);
  await db.user.update({
    where: { id: user.id },
    data: { referralCode }
  });
  
  // Отправка welcome email с реферальной ссылкой
  await sendWelcomeEmailWithReferral(user, referralCode);
}
```

### Новые API endpoints
- `GET /api/public/referral/[projectId]/[userId]` - публичная страница
- `POST /api/public/referral/auth` - авторизация по OTP
- `GET /api/projects/[id]/referral-widget` - данные для виджета