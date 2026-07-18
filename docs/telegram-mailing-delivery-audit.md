# Аудит Telegram-рассылок и диагностики доставки

> **Обновлено 2026-07-18:** P0-исправления внедрены. Mailing worker обрабатывает очередь с лимитом и retry transient-ошибок, получатели фильтруются по проекту, активности и Telegram-привязке, результаты и Telegram error details сохраняются. Permanent `403` (`bot was blocked by the user`, `user is deactivated`) отключает только устаревший `telegramId`, не деактивируя бонусный аккаунт. Ниже сохранены исходные выводы аудита; отдельные пункты описывают состояние до исправлений.

**Дата:** 2026-07-18
**Область:** кампании `Mailing`, массовые уведомления, scheduled workflow, BullMQ/Redis, Telegram Bot API, логи и аналитика.

## Итог

Текущая система умеет формировать аудиторию, отправлять текст/фото/inline-кнопки и сохранять результат по отдельным получателям. Однако production-надежность массовых рассылок низкая: основной BullMQ worker не инициализируется, плановые кампании не запускаются планировщиком, Telegram `429/5xx/network` не повторяются, а завершение кампании зависит от открытия страницы аналитики.

Главный вывод: пропуск доставки чаще вызван не устаревшим Telegram API, а разрывами в lifecycle очереди, retry и наблюдаемости.

## Контуры отправки

### 1. Кампании Mailing

1. UI `src/features/mailings/components/mailing-form-dialog.tsx` создаёт кампанию через `POST /api/projects/[id]/mailings`.
2. `MailingService.startMailing` создаёт снимок `MailingRecipient` из `SegmentMember`, переводит кампанию в `SENDING` и ставит одну BullMQ job на получателя.
3. Worker из `src/lib/queues/mailing.queue.ts` должен получить `telegramId` и вызвать `botManager.sendRichBroadcastMessage`.
4. Результат сохраняется в `MailingRecipient`, `MailingHistory`, `Mailing.sentCount` и `Mailing.failedCount`.
5. UI аналитики читает `/analytics`, `/history` и саму кампанию.

### 2. Scheduled workflow

`/api/cron/scheduled-triggers` запускает `ScheduledTriggerRunner`, который выбирает аудиторию через `AudienceResolver`, создаёт отдельный `WorkflowExecution` на пользователя и отправляет сообщение через прямой HTTP-вызов Telegram Bot API в `platform-messaging.ts`.

### 3. Прямые массовые уведомления

`POST /api/notifications`, bulk action пользователей и `ProjectNotificationService.sendBulk` вызывают `sendRichBroadcastMessage` напрямую. Этот путь обходит модели `MailingRecipient`/`MailingHistory` и сохраняет значительно меньше диагностических данных.

## Где хранятся результаты и ошибки

| Источник | Что хранится | Ограничение |
|---|---|---|
| `mailing_recipients` | Статус `PENDING/SENT/FAILED`, `sentAt`, текст `error` | Нет кода Telegram, `retry_after`, attempt/job ID |
| `mailing_history` | События `SENT/FAILED` и JSON metadata | UI показывает только 100 событий и обрезает детали |
| `mailings` | Агрегаты `sentCount/failedCount`, status | `COMPLETED` вычисляется только при GET аналитики |
| `workflow_executions` | Итоговый status/error scheduled workflow | Нет унифицированного Telegram error code |
| `workflow_logs` | Шаги выполнения workflow | Часть ранних логов идёт только в console |
| `system_logs` | Только `warn/error` из общего logger | Запись fire-and-forget; `info` не сохраняется |
| Runtime console | Все разрешённые уровни logger и прямые `console.*` | На VPS смотреть через `pm2 logs bonus-app`; отдельного log-файла в PM2 config нет |
| `notifications` | Сообщение и `sentAt` | Нет status/error/attempt/provider message ID |

## Критические находки

### P0 — рассылка может не начаться

1. **Mailing worker нигде не запускается.** `getMailingWorker()` найден только в собственном определении. `src/instrumentation.ts` инициализирует `DelayJobService`, но не mailing worker. API при этом успешно отвечает, что рассылка запущена, а jobs остаются в Redis.
2. **`scheduledAt` не обслуживается.** Поле переводит кампанию в `SCHEDULED`, но нет cron/worker, который выбирает `scheduledAt <= now` и вызывает `startMailing`.
3. **`REDIS_URL` игнорируется.** Когда конфигурация задана URL-строкой, Queue и Worker всё равно получают `{ host: 'localhost', port: 6379 }`. В production это может подключить процесс не к тому Redis.
4. **Telegram-сбои не активируют Bull retry.** Worker перехватывает ошибку отправки, пишет `FAILED` и завершает job успешно. `attempts: 3` срабатывает только при исключении, дошедшем до внешнего `catch`.

### P1 — надежность и lifecycle

5. **Нет обработки `retry_after`.** `429`, временные `5xx`, timeout и network errors становятся финальным `FAILED`.
6. **Параллелизм 20 не является rate limiter.** Пачка из 20 запросов отправляется одновременно без глобальной координации между кампаниями и другими контурами.
7. **Отмена не останавливает jobs.** `cancelMailing` меняет только status БД; worker не проверяет `CANCELLED`, jobs не удаляются.
8. **Нет идемпотентности старта.** Отсутствуют transaction/lock, стабильный `jobId` и unique `(mailingId, userId)`, поэтому конкурентный start может создать дубли.
9. **Кампания не завершает себя.** Worker не переводит её в `COMPLETED`; это делает GET аналитики при `pending === 0`, даже если все отправки завершились ошибкой. `completedAt` не устанавливается.
10. **Нет queue events/health.** Для mailing queue отсутствуют обработчики `failed`, `stalled`, `completed`, метрики waiting/active/delayed и dead-letter/retry UI.
11. **Scheduled workflow выполняет до 5000 пользователей последовательно в одном cron HTTP request.** Возможен timeout; аудитория после первых 5000 не пагинируется.
12. **Dedupe scheduled workflow не атомарен.** Раздельные `get` и `set` допускают двойной запуск, а crash после отправки до `markRun` приведёт к повтору.

### P1 — аудитория и мультитенантность

13. Mailing использует сохранённый снимок `SegmentMember`; динамический сегмент перед стартом не пересчитывается.
14. При старте не фильтруются `isActive` и наличие `telegramId`; пользователь без привязки попадает в индивидуальный `FAILED`.
15. Кампания без segment и без recipients переходит в `SENDING` с пустой аудиторией.
16. `segmentId`/`templateId` при создании не проверяются на принадлежность проекту. Analytics/history проверяют доступ к project из URL, но сервисные методы принимают только `mailingId`.
17. `POST /api/notifications` проверяет JWT, но в самом route не вызывает `verifyProjectAccess` для переданного `projectId`.
18. Explicit `userIds` в прямой рассылке не фильтруются по `projectId/isActive`; helper также суммирует Telegram и MAX, поэтому агрегат не равен числу пользователей.

## Почему конкретный пользователь может не получить сообщение

- У пользователя нет `telegramId`, он не запускал бота или привязка устарела.
- Пользователь заблокировал бота; Telegram вернул `403 Forbidden`.
- Chat удалён/мигрирован или ID некорректен; Telegram вернул `400 chat not found`.
- Пользователь отсутствует в сохранённом `SegmentMember` либо оказался после лимита 5000 scheduled audience.
- Mailing worker не запущен; job остаётся `waiting`.
- Приложение подключилось к localhost вместо Redis из `REDIS_URL`.
- Бот текущего проекта не создан в процессе worker, выключен либо имеет невалидный token.
- Telegram вернул `429`, `5xx` или network timeout, а повтор не выполняется.
- Некорректная HTML/Markdown-разметка, слишком длинный text/caption, недоступный image URL или невалидная кнопка.
- Плановая кампания имеет `SCHEDULED`, но scheduler для неё отсутствует.
- Cron scheduled workflow завершился по timeout или второй запуск был ошибочно пропущен/продублирован dedupe-механизмом.

## Соответствие актуальному Telegram

На дату аудита актуален [Telegram Bot API 10.2 от 14 июля 2026](https://core.telegram.org/bots/api-changelog). Релиз добавляет Rich Messages; отсутствие их поддержки не ломает обычные `sendMessage`, `sendPhoto` и inline keyboard.

Проект использует:

- `grammy` с диапазоном `^1.37.0`, lockfile фиксирует `1.38.2`;
- актуальная версия upstream — [grammY 1.45.1](https://github.com/grammyjs/grammy/blob/main/package.json), поддерживающая Bot API 10.2;
- `@grammyjs/runner` для polling;
- прямой Axios-вызов Bot API в workflow, из-за чего политика ошибок расходится с BotManager.

### Что уже современно

- grammY и типизированный TypeScript API;
- webhook в production и runner/polling в development;
- BullMQ с отдельной job на получателя;
- inline keyboard, HTML/Markdown, фото с caption;
- раздельная запись результата для `MailingRecipient`.

### Что не соответствует надежной современной практике

- Telegram рекомендует для bulk notifications ориентироваться примерно на 30 сообщений/с без paid broadcasts; для одного чата — не более одного сообщения/с, для одной группы — 20 сообщений/мин ([официальный FAQ](https://core.telegram.org/bots/faq)). Точные flood limits динамические, поэтому одного фиксированного concurrency недостаточно.
- Любой `429` надо выдержать по `ResponseParameters.retry_after`, затем повторить запрос. Официальная документация grammY рекомендует [`@grammyjs/auto-retry`](https://grammy.dev/plugins/auto-retry), который также повторяет `5xx` и сетевые ошибки.
- [Рекомендации grammY по broadcast](https://grammy.dev/advanced/flood) предлагают последовательную либо очень ограниченно параллельную отправку с обязательным уважением flood wait. Текущая пачка `Promise.allSettled` по 20 адресатам и отсутствие `retry_after` этому не соответствуют.
- Paid Broadcasts опционально поднимают предел до 1000 сообщений/с через `allow_paid_broadcast`; это не нужно для обычных объёмов и требует баланса Telegram Stars. Даже в этом режиме очередь и обработка `429` обязательны ([Bot API](https://core.telegram.org/bots/api)).
- Версию grammY следует обновить отдельно и закрепить точной версией, но это вторично относительно исправления worker/retry.

> Контент официальных источников пересказан для соблюдения лицензионных ограничений.

## Рекомендуемый план исправлений

### Фаза 0 — восстановить гарантированный запуск

1. Инициализировать `getMailingWorker()` в `src/instrumentation.ts` для Node runtime и корректно закрывать worker при shutdown.
2. Исправить разбор `REDIS_URL` и добавить startup health-check Queue/Worker/Redis.
3. Добавить scheduler для `Mailing.status=SCHEDULED` с атомарным захватом due-кампаний.
4. Не возвращать API «запущено», если очередь или worker недоступны; различать `QUEUED` и фактическую отправку.

### Фаза 1 — единая доставка и retry

1. Создать единый Telegram delivery adapter на grammY для Mailing, workflow и direct notifications.
2. Подключить `@grammyjs/auto-retry` с ограниченными `maxRetryAttempts/maxDelaySeconds`.
3. Хранить `errorCode`, `description`, `retryAfter`, `attempt`, `jobId`, `telegramMessageId` и `lastAttemptAt`.
4. Классифицировать ошибки: permanent (`400/403`) без retry; transient (`429/5xx/network`) с retry/backoff.
5. Ограничить concurrency на worker и координировать лимит минимум per bot token.

### Фаза 2 — идемпотентность и корректные статусы

1. Добавить unique `(mailingId, userId)` или отдельный recipient dedupe key.
2. Использовать стабильный BullMQ `jobId`, transaction/compare-and-set при старте.
3. Перед отправкой повторно проверять status кампании и recipient.
4. Завершать кампанию из worker/queue events: `COMPLETED` при окончании обработки, `FAILED` по явной политике; всегда писать `completedAt`.
5. Отмена должна удалять waiting/delayed jobs и запрещать отправку уже взятой job до вызова Telegram.

### Фаза 3 — наблюдаемость и безопасность

1. Добавить queue dashboard/health endpoint и метрики `waiting/active/delayed/failed/stalled`.
2. В аналитике показывать полный recipient error, Telegram code, attempts и кнопку безопасного retry failed recipients.
3. Сохранять все результаты прямых уведомлений в унифицированную модель delivery attempts.
4. Добавить `verifyProjectAccess` и проверку project ownership для segment/template/mailing/userIds.
5. Убрать мутацию статуса из GET analytics.

## Как диагностировать пропуск сейчас

1. Найти campaign и запись пользователя в `mailing_recipients`.
   - записи нет — проблема сегмента/аудитории;
   - `PENDING` — worker/Redis/job не обработаны;
   - `FAILED` — читать поле `error`;
   - `SENT` — Telegram принял API-запрос, но это не подтверждает прочтение.
2. Проверить `mailing_history` по `mailing_id + recipient_id`; для `FAILED` ошибка лежит в `metadata.error`.
3. Проверить `mailings.sent_count`, `failed_count`, status и сравнить их с фактическим числом recipients.
4. Проверить `system_logs` по `project_id`, уровню `error/warn`, сообщениям `Mailing failed`, `Telegram mailing error`, `Mailing queue not available`. Доступен API `/api/super-admin/errors` с фильтрами, а в super-admin — мониторинг ошибок.
5. Для scheduled workflow проверить `workflow_executions` по `project_id/user_id`, затем `workflow_logs` по `execution_id`.
6. На VPS выполнить `pm2 logs bonus-app --lines 300`; `ecosystem.config.cjs` не задаёт отдельные `out_file/error_file`, поэтому используются стандартные PM2 logs.
7. Проверить Redis и наличие jobs очереди `mailing`. В проекте пока нет встроенного endpoint/UI для этого.
8. Проверить, что bot instance активен именно в процессе, который обрабатывает job; статус `BotSettings.isActive` сам по себе этого не гарантирует.

## Ключевые файлы

- `src/lib/services/mailing.service.ts`
- `src/lib/queues/mailing.queue.ts`
- `src/lib/telegram/bot-manager.ts`
- `src/lib/telegram/notifications.ts`
- `src/lib/services/workflow/scheduled/scheduled-trigger-runner.ts`
- `src/lib/services/workflow/scheduled/audience-resolver.ts`
- `src/lib/services/workflow/platform-messaging.ts`
- `src/lib/logger.ts`
- `src/instrumentation.ts`
- `prisma/schema.prisma`
- `src/app/api/super-admin/errors/route.ts`

## Ограничения аудита

Аудит выполнен статически по репозиторию. Не проверялись конкретные production Redis, BullMQ jobs, PM2 output и записи БД, поэтому для установления причины по конкретному адресату нужен `mailingId`/`userId` и данные production-окружения. Секреты и `.env` не читались и не изменялись.
