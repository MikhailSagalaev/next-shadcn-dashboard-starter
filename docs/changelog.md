## [2025-10-15] - Расширенная система переменных пользователя + исправления

### 🎯 Добавлено
- **50+ переменных пользователя** для использования в сообщениях workflow
- Новые predefined queries: `get_user_profile`, `get_referral_link`
- Сервис `UserVariablesService` для работы с переменными пользователя
- Автоматическая загрузка переменных пользователя в `MessageHandler`
- Полная документация по переменным: `docs/user-variables-guide.md`
- Примеры шаблонов сообщений: `docs/message-templates-examples.md`
- Полный справочник переменных: `docs/complete-variables-reference.md`
- Обновлённые сообщения в шаблоне "Система лояльности" с использованием новых переменных

### 🔄 Изменено
- `MessageHandler` теперь автоматически загружает переменные пользователя
- Шаблон "Система лояльности" использует персонализированные сообщения
- Расширены predefined database queries для получения полной информации о пользователе

### 📊 Доступные переменные пользователя
- **Личная информация**: `{user.firstName}`, `{user.fullName}`, `{user.email}`, `{user.phone}`
- **Финансы**: `{user.balanceFormatted}`, `{user.totalEarnedFormatted}`, `{user.totalSpentFormatted}`
- **Рефералы**: `{user.referralCode}`, `{user.referralLink}`, `{user.referrerName}`
- **Статистика**: `{user.transactionCount}`, `{user.bonusCount}`, `{user.currentLevel}`
- **История**: `{user.transactionHistory}`, `{user.activeBonuses}`
- **Даты**: `{user.registeredAt}`, `{user.updatedAt}`
- **Условные**: `{user.hasReferralCode}`, `{user.isNewUser}`, `{user.hasTransactions}`

---

## [2025-10-15] - Упрощение обработки контакта + автоматическое выравнивание нод

### 🎯 Добавлено
- Кнопка автоматического выравнивания нод в конструкторе workflow (использует dagre layout)
- Контакт теперь обрабатывается как обычное сообщение через `context.telegram.contact`
- API endpoint `/api/admin/clear-workflow-cache` для очистки кэша workflow
- Документация `docs/workflow-debugging.md` - полное руководство по отладке сценариев

### 🔄 Изменено
- Упрощена архитектура - убрана сложная логика ожидания (waiting state)
- Контакт больше не требует отдельной ноды - обрабатывается как обычное событие
- Обновлён шаблон "Система лояльности" - теперь без отдельной ноды ожидания
- В шаблоне переменная `user` разделена на `user` и `userByContact` для избежания перезаписи

### 🗑️ Удалено
- Нода `flow.wait_contact` и весь связанный код
- Интерфейсы `WaitResult`, `WaitingState` из типов workflow
- Логика `findWaitingExecution`, `resumeContext`, `markWaiting` из ExecutionContextManager
- Обработчик `WaitContactFlowHandler`
- UI компонент `WaitContactNode`

### 🐛 Исправлено
- Устранена проблема с дублированием сообщений при отправке контакта
- Workflow теперь выполняется линейно без разрывов контекста
- Убрана ненужная сложность с состояниями waiting/running
- Исправлена ошибка "Unique constraint failed" при создании пользователя (переменные перезаписывались)
- Исправлена ошибка React Flow "zustand provider" в конструкторе
- **КРИТИЧНО**: Исправлена логика обработки условий - теперь проверяется `sourceHandle` вместо `type`

---

## [2025-10-15] - Реализация flow.wait_contact вместо trigger.contact

(предыдущая версия - удалена в пользу упрощённого подхода)

---

## [2025-10-14] - Масштабное обновление: 9 новых нод + критические фиксы

(предыдущие записи сохранены)
