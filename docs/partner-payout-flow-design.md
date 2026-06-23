# Partner Payout / Cashout Flow — Design (план 006)

> **Status**: design spike (документ-проектирование). НИКАКОЙ production-код не
> меняется этим документом. Deliverable = только этот файл.
> **Planned at**: 2026-06-23, на ветке `main` поверх фиксов 001–003
> (idempotent webhook bonus, atomic referral payout, refund reversal).
> **Source plan**: `plans/006-partner-payout-flow-spike.md`.
> **Status update (2026-06-23)**: все 5 открытых вопросов §9 закрыты владельцем —
> дизайн готов к превращению в исполняемый план 007 (реализация v1).

---

## 1. Goal & scope

### Проблема

Сегодня комиссия b2b-партнёра (тренер / менеджер / директор) начисляется как
**бонусы магазина** — та же сущность `Bonus`, которую обычный клиент тратит на
скидку при покупке. Партнёр же зарабатывает это как **доход** и ожидает вывести
**деньги**, а не купить товар со скидкой. В системе нет реестра выводов, нет
статусов выплаты, нет одобрения и нет выгрузки для бухгалтерии.

Это подтверждается кодом:

- Комиссия начисляется через `BonusService.awardBonus({ type: 'REFERRAL', ... })`
  — `src/lib/services/referral.service.ts:492-495`.
- «💵 Мои выплаты» в боте — это **read-only список последних `EARN`-транзакций**
  с `isReferralBonus: true`, а не вывод денег:
  `src/lib/services/workflow/handlers/action-handlers.ts:2184-2292`
  (`PartnerPayoutsHandler`) и зеркальный API
  `src/app/api/projects/[id]/users/[userId]/payouts/route.ts`.
- В `prisma/schema.prisma` нет модели `Payout`/`Withdrawal` и нет члена
  `TransactionType` для вывода (enum: `EARN | SPEND | EXPIRE | REFUND | RETURN`,
  `prisma/schema.prisma:728-734`).

То есть «выплаты» сейчас = «история начислений». Исходящего движения денег нет.

### Цель v1

Дать партнёру способ **конвертировать заработанную комиссию в реальные деньги**
через заявку на вывод, с ручным одобрением и ручной выплатой администратором, и с
выгрузкой для бухгалтерии. При этом:

- комиссия по-прежнему живёт как бонусы (решение продукта, см. §2);
- конвертация бонусы → деньги 1:1 происходит в момент выплаты;
- двойной вывод и вывод «больше заработанного» технически невозможны.

### Out of scope для v1 (явно)

- Любое **автоматическое движение денег** (банковский/платёжный API,
  ЮKassa-выплаты, СБП). v1 — ручная выплата + выгрузка.
- Приём заявки через **Tilda-форму** (см. §2, решение 1).
- Генерация **чеков НПД** / интеграция с «Мой налог» / агентские договоры в коде
  (только сбор данных и выгрузка — открытый вопрос, §9).
- Частичные выплаты по нескольким методам, мультивалютность, авто-расчёт
  комиссий платёжной системы.
- Re-award комиссии при отмене отмены заказа (уже отложено планом 003).
- Изменение модели начисления комиссии на «деньги» вместо бонусов (решение 3).

---

## 2. Зафиксированные решения продукта (constraints — не пересматриваем)

Эти три решения приняты владельцем продукта. Дизайн строится **вокруг** них.

1. **Канал заявки — только Telegram-бот.** Партнёр уже аутентифицирован в боте
   через `telegramId` (`User.telegramId`, `prisma/schema.prisma:370`). Tilda-форма
   в v1 **не используется**: публично отправляемая форма не доказывает владение
   аккаунтом, а идентичность — ключевая угроза безопасности при выводе денег. В
   боте уже есть раздел «💵 Мои выплаты»
   (`src/lib/workflow-templates/b2b-partner-cabinet.json`, callback
   `partner_payouts`).

2. **Исполнение выплаты в v1 — ручное.** Заявка → одобрение администратором →
   деньги выплачиваются руками + экспорт/дамп для бухгалтерии. Никакого
   автоматического движения денег (никакого банковского/платёжного API) в v1.

3. **Природа комиссии — остаётся бонусами.** Вывод конвертирует бонусы → деньги
   1:1 в момент выплаты. Мы **не** переводим комиссию в денежно-номинированную
   сущность. `Payout` — это надстройка-реестр над существующим бонусным
   ledger'ом, а не замена ему.

---

## 3. Текущая денежная модель (как есть)

Чтобы payout не дублировал и не ломал существующий учёт, фиксируем, как деньги
движутся сегодня.

### Ledger: `Bonus` + `Transaction`

- **`Bonus`** (`prisma/schema.prisma:428-444`) — «кошелёк»: каждая запись = партия
  начисленных бонусов с `amount`, `type` (`BonusType`), `isUsed`, `expiresAt`,
  уникальным `externalId`.
- **`Transaction`** (`prisma/schema.prisma:446-470`) — журнал движений: `type`
  (`EARN | SPEND | EXPIRE | REFUND | RETURN`), `amount`, `isReferralBonus`,
  `referralUserId`, `referralLevel`, уникальный `externalId` (идемпотентность из
  плана 001), `metadata` (Json).

### Начисление комиссии

`ReferralService.processReferralBonus` (`src/lib/services/referral.service.ts:341`)
проходит по цепочке партнёров и для каждого вызывает
`BonusService.awardBonus({ type: 'REFERRAL', isReferralBonus: true, referralUserId,
referralLevel, ... })` (`:492-495`). Это создаёт `Bonus` + `EARN`-транзакцию с
`isReferralBonus: true`.

### Баланс

`UserService.getUserBalance` (`src/lib/services/user.service.ts:510-571`):
`currentBalance` = сумма **активных** `Bonus` (`isUsed: false`, не истёкших).
Важно: баланс считается из `Bonus`, а `totalEarned/totalSpent` — из агрегатов
`Transaction`. Эти два представления должны оставаться согласованными.

### Списание

`UserService.spendBonuses` (`src/lib/services/user.service.ts:1164+`): внутри
`db.$transaction` берёт активные `Bonus` в порядке `expiresAt asc`, проверяет
`totalAvailable >= amount` (иначе бросает), помечает `Bonus.isUsed` и пишет
`SPEND`-транзакции. **Это и есть паттерн, который payout должен переиспользовать
для дебета** — атомарная проверка-и-списание внутри `db.$transaction`.

### Где «заработано» и «потрачено в магазине» сейчас слиты

Партнёрская комиссия (`type: REFERRAL`, `isReferralBonus: true`) лежит в том же
бонусном кошельке, что и покупательские бонусы (`type: PURCHASE`). Один и тот же
`currentBalance` партнёр может и потратить на скидку, и (по этому дизайну) вывести
деньгами. Это создаёт риск двойного расходования: списание в магазине и заявка на
вывод конкурируют за один баланс. Дизайн §5–§6 решает это через **дебет на момент
REQUESTED (hold/reserve)**, а не на момент PAID.

> Замечание: «withdrawable» в v1 определяется как **текущий бонусный баланс**
> (`getUserBalance().currentBalance`), а не как «сумма REFERRAL-начислений». Это
> сознательное упрощение v1 — см. открытый вопрос §9.4 про clawback и hold-period.

---

## 4. Почему НЕ через order-webhook

Вывод денег **не должен** проходить через пайплайн заказов. Обоснование:

- Текущий webhook `src/app/api/webhook/[webhookSecret]/route.ts` принимает заказ,
  нормализует его `TildaParserService.normalizeOrder` (`:94`) и обрабатывает
  `OrderProcessingService.processOrder` (`:97`). Этот путь — про **входящую
  покупку**: он создаёт `Order`, начисляет покупательские бонусы и **порождает**
  комиссию (`processReferralBonus`). Семантика — «деньги/бонусы внутрь».
- Payout — это **исходящее** движение: «бонусы наружу, деньги партнёру». Прогонять
  его через `OrderProcessingService` означало бы создавать фиктивные заказы,
  переиспользовать идемпотентность `tilda_order_*` (плана 001) не по назначению и
  риск случайно начислить ещё комиссию на «заказ-вывод».
- Канал тоже другой: заявка приходит из **Telegram-бота** (аутентифицированный
  `telegramId`), а не из Tilda-вебхука (анонимный POST). Переиспользовать
  публичный `[webhookSecret]`-эндпойнт для вывода денег небезопасно (см. решение
  1 — идентичность).

**Вывод**: payout живёт как **отдельный сервис `PayoutService` + отдельные
bot-handler'ы + админ-эндпойнты**, со своим пространством идемпотентности
(`payout_*`), не пересекающимся с `tilda_order_*` / `referral_*`.

---

## 5. Модель данных

### 5.1 Предлагаемая модель `Payout` (Prisma sketch — НЕ применять)

Стиль скопирован с существующих request-сущностей в этой схеме —
`PartnerJoinRequest` (`prisma/schema.prisma:190-209`) и её enum
`PartnerJoinRequestStatus` (`:182-187`), у которых уже есть поля
`status / reviewedBy / reviewedAt / rejectReason`.

```prisma
/// Заявка партнёра на вывод заработанной комиссии в деньги (план 006/007).
/// Надстройка-реестр над бонусным ledger'ом; комиссия остаётся бонусами,
/// конвертация 1:1 в деньги фиксируется в момент PAID.
model Payout {
  id             String        @id @default(cuid())
  projectId      String        @map("project_id")
  userId         String        @map("user_id")          // партнёр-получатель

  amount         Decimal       @db.Decimal(10, 2)        // сумма вывода (бонусы → деньги 1:1)
  currency       String        @default("RUB")

  status         PayoutStatus  @default(REQUESTED)

  // Канал и идентичность заявителя (решение 1: только бот).
  requestSource  String        @default("telegram_bot") @map("request_source")
  requestTelegramId BigInt?    @map("request_telegram_id")

  // Реквизиты выплаты, как их указал/подтвердил партнёр (свободная форма в v1).
  payoutMethod   String?       @map("payout_method")     // напр. "card", "sbp", "manual"
  payoutDetails  Json?         @map("payout_details")    // маскировать в логах

  // Аудит переходов состояния.
  requestedAt    DateTime      @default(now()) @map("requested_at")
  reviewedBy     String?       @map("reviewed_by")       // admin id, кто одобрил/отклонил
  reviewedAt     DateTime?     @map("reviewed_at")
  rejectReason   String?       @map("reject_reason")
  paidAt         DateTime?     @map("paid_at")
  paidBy         String?       @map("paid_by")           // admin id, кто отметил PAID
  failReason     String?       @map("fail_reason")
  cancelledAt    DateTime?     @map("cancelled_at")

  // Учёт/бухгалтерия.
  externalRef    String?       @map("external_ref")      // № платёжки/выгрузки бухгалтера

  // Идемпотентность (дисциплина externalId из плана 001).
  // Детерминированный ключ заявки: payout_req_<projectId>_<telegramId>_<bucket>.
  externalId     String?       @unique @map("external_id")

  // Связь с ledger: какие SPEND-транзакции зарезервировали/списали бонусы.
  // Пишутся в metadata.spendBatchId или отдельной join-таблицей (см. §5.3).
  ledgerBatchId  String?       @map("ledger_batch_id")

  metadata       Json?         @default("{}")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  project        Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@index([projectId, userId, status])
  @@map("payouts")
}

enum PayoutStatus {
  REQUESTED  @map("requested")   // подана из бота, бонусы зарезервированы (hold)
  APPROVED   @map("approved")    // админ одобрил, ждёт ручной выплаты
  PAID       @map("paid")        // деньги выплачены, бонусы списаны окончательно
  REJECTED   @map("rejected")    // админ отклонил, резерв возвращён
  CANCELLED  @map("cancelled")   // партнёр отозвал до одобрения, резерв возвращён
  FAILED     @map("failed")      // выплата сорвалась после APPROVED, резерв возвращён
}
```

> `User` и `Project` получают обратную связь `payouts Payout[]` — это
> единственные правки существующих моделей (помимо новой модели и enum). Новый
> `TransactionType` **не обязателен**: резерв/списание выражаются существующим
> `SPEND` с маркером в `metadata` (см. §5.2). Если потребуется отдельная
> отчётность по выводам — можно добавить `TransactionType.PAYOUT`, но это можно
> отложить.

### 5.2 Как payout двигает бонусы (переиспользуем ledger)

Решение: **резервируем (debit) бонусы на REQUESTED, а не на PAID.** Обоснование —
§6 (предотвращение double-spend). Механика:

- На **REQUESTED**: внутри `db.$transaction` вызываем логику, эквивалентную
  `UserService.spendBonuses(userId, amount, 'Резерв под вывод #<payoutId>',
  { source: 'payout', payoutId, spendBatchId })`. Это:
  - атомарно проверяет `totalAvailable >= amount` (та же проверка, что в
    `spendBonuses`, `user.service.ts:1224`) — нельзя зарезервировать больше, чем
    есть;
  - помечает `Bonus.isUsed` и пишет `SPEND`-транзакции с
    `metadata.payoutId = <id>`, `metadata.payoutState = 'reserved'`;
  - сохраняет `spendBatchId` в `Payout.ledgerBatchId` для обратной связи.
- На **PAID**: резерв становится окончательным — апдейтим `metadata.payoutState`
  на `'paid'`, проставляем `paidAt/paidBy`. Бонусы уже списаны, второй дебет не
  нужен.
- На **REJECTED / CANCELLED / FAILED**: **возврат резерва** — пишем компенсирующие
  `EARN`-транзакции по `ledgerBatchId` (или переоткрываем `Bonus.isUsed = false`,
  если не истекли), идемпотентно по `externalId = payout_refund_<payoutId>`. Это
  тот же приём компенсирующей транзакции, что использует план 003
  (`reversal_*`-транзакции).

### 5.3 Связь payout ↔ ledger-транзакции

Минимально для v1: хранить `Payout.ledgerBatchId` и тегировать SPEND/refund
транзакции через `Transaction.metadata.payoutId`. `spendBonuses` уже кладёт
`spendBatchId` в metadata (`user.service.ts:1186-1190`), так что связь
восстанавливается запросом `where metadata->>'payoutId' = <id>`. Отдельная
join-таблица — возможное улучшение v2, не требуется для v1.

---

## 6. Машина состояний

```
                    (партнёр в боте подаёт заявку)
                          │  debit: РЕЗЕРВ бонусов (spendBonuses)
                          ▼
  ┌─────────────┐   approve   ┌──────────┐    mark paid    ┌──────┐
  │  REQUESTED  │────────────▶│ APPROVED │────────────────▶│ PAID │ (terminal)
  └─────────────┘   (admin)   └──────────┘    (admin)      └──────┘
        │  │                        │
        │  │ reject (admin)         │ fail (admin: выплата сорвалась)
        │  │ → REJECTED             │ → FAILED
        │  │   refund резерва       │   refund резерва
        │  ▼                        ▼
        │ cancel (партнёр, до approve)   FAILED (terminal)
        │ → CANCELLED                    REJECTED (terminal)
        ▼   refund резерва               CANCELLED (terminal)
```

| Переход | Кто триггерит | Где (код) | Движение денег/бонусов |
|---|---|---|---|
| `∅ → REQUESTED` | Партнёр в боте | bot callback `payout_request` → `PayoutService.requestPayout` | **Дебет: резерв бонусов** (`spendBonuses`-эквивалент) внутри `db.$transaction`. Если баланса не хватает — заявка не создаётся (throw/мягкий отказ в боте). |
| `REQUESTED → APPROVED` | Админ | админ-эндпойнт `approvePayout` | Нет движения. Резерв уже держится. Проставляется `reviewedBy/reviewedAt`. |
| `APPROVED → PAID` | Админ (после ручной выплаты) | админ-эндпойнт `markPaid` | Резерв → окончательное списание (`metadata.payoutState = 'paid'`, `paidAt/paidBy`, `externalRef`). Бонусы уже списаны на REQUESTED — повторного дебета нет. |
| `REQUESTED → REJECTED` | Админ | `rejectPayout(reason)` | **Возврат резерва** (refund-транзакция, идемпотентно). `rejectReason`. |
| `REQUESTED → CANCELLED` | Партнёр (в боте, до одобрения) | bot callback `payout_cancel:<id>` | **Возврат резерва**. После APPROVED — отмена недоступна партнёру. |
| `APPROVED → FAILED` | Админ (выплата физически не прошла) | `failPayout(reason)` | **Возврат резерва**. `failReason`. Партнёр может подать новую заявку. |

**Терминальные состояния**: `PAID`, `REJECTED`, `CANCELLED`, `FAILED`. Из них
переходов нет (новая попытка = новая заявка). Все не-PAID терминалы **возвращают
резерв** ровно один раз (идемпотентность по `payout_refund_<payoutId>`).

**Запрещённые переходы** (защита в `PayoutService`): нельзя `PAID → *`, нельзя
`REJECTED/CANCELLED/FAILED → *`, нельзя `REQUESTED → PAID` минуя `APPROVED`
(деньги выдаёт человек только после одобрения), нельзя дважды refund'ить.

### Почему резерв на REQUEST, а не дебет на PAID

Комиссия лежит в общем бонусном кошельке, который партнёр может **одновременно**
тратить на скидку в магазине (`spendBonuses` через order-пайплайн). Если списывать
только на PAID:

- между REQUESTED и PAID партнёр может потратить те же бонусы в магазине →
  на PAID баланса не хватит, получаем отрицательный баланс или провал выплаты;
- две параллельные заявки на вывод могли бы обе пройти валидацию «баланс >= amount»
  и вместе превысить заработанное.

Резерв на REQUESTED закрывает оба окна: бонусы списываются атомарно сразу,
конкурирующее списание (магазин или вторая заявка) увидит уже уменьшенный
`totalAvailable` и не пройдёт проверку `user.service.ts:1224`. Это прямой аналог
«hold/authorization» в платёжных системах.

---

## 7. Инварианты и идемпотентность

1. **`amount <= withdrawable balance`.** Проверяется атомарно при резерве —
   переиспользуется проверка `totalAvailable >= amount` из `spendBonuses`
   (`src/lib/services/user.service.ts:1224`). В v1 `withdrawable` =
   `getUserBalance().currentBalance` (см. упрощение §3 и открытый вопрос §9.4).
2. **Никаких отрицательных балансов.** Резерв = тот же механизм, что списание в
   магазине; он не может увести баланс ниже нуля, потому что проверка-и-списание
   в одной `db.$transaction`. Refund при reject/cancel/fail возвращает ровно
   зарезервированную сумму, не больше.
3. **Идемпотентность заявки.** Двойной тап «Подать заявку» в боте не должен
   создавать две выплаты. Детерминированный `Payout.externalId`
   (`payout_req_<projectId>_<telegramId>_<bucket>`, где bucket — напр. округлённая
   минута или явный «черновик»-id) + `@unique` индекс отклоняет дубль (тот же
   приём `@unique externalId` + P2002-catch, что в `awardBonus`,
   `user.service.ts:899-930`). Альтернатива: запрет более одной активной
   (`REQUESTED|APPROVED`) заявки на партнёра — частичный unique-индекс/проверка.
4. **Конкурентная безопасность.** Две одновременные заявки не могут вывести больше
   заработанного: каждая делает резерв в своей `db.$transaction`; вторая увидит
   уменьшенный пул активных `Bonus` и упрётся в проверку баланса. Окончательный
   арбитр — атомарный `spendBonuses`-резерв, а не предварительная read-only
   проверка баланса.
5. **Идемпотентность переходов.** Каждый переход проверяет текущий `status` перед
   записью (нельзя одобрить уже PAID; нельзя refund'ить дважды — guard по наличию
   `payout_refund_<id>`-транзакции). Аналог дисциплины плана 001/003.
6. **Согласованность с возвратами (план 003).** Refund заказа клавбэчит
   **невыведенную** комиссию через `reverseReferralBonus`
   (`src/lib/services/referral.service.ts:647`), помечая исходные `Bonus.isUsed`.
   Если эти бонусы уже зарезервированы под активный Payout — план 003 уже
   обрабатывает «уже потрачено»: реверсит только остаток и логирует shortfall
   (баланс не уходит в минус). Уже **выведенная** (PAID) комиссия требует ручной
   политики возврата — см. §9.4. Это поведение надо явно покрыть тестом.

---

## 8. Прогон потока (happy + unhappy)

### Happy path

1. Партнёр в боте: меню кабинета → «💵 Мои выплаты» → новая кнопка
   «➕ Вывести деньги». (Меню — `b2b-partner-cabinet.json`, callback
   `partner_payouts`.)
2. Бот спрашивает сумму и реквизиты (короткий conversation-flow). Валидация:
   `amount > 0`, `amount <= currentBalance`, `>= минимальный порог` (§9.2).
3. `PayoutService.requestPayout` создаёт `Payout(status=REQUESTED)` и **резервирует
   бонусы** в одной `db.$transaction`. Идемпотентно по `externalId`.
4. Бот подтверждает партнёру; уведомление администратору
   (паттерн `partner-notification.service.ts`).
5. Админ видит заявку в админ-поверхности (§9.x / §10), проверяет и нажимает
   «Одобрить» → `REQUESTED → APPROVED`.
6. Админ выплачивает деньги **вручную** (карта/СБП/нал) вне системы, затем
   нажимает «Отметить выплаченным», вписывает `externalRef` → `APPROVED → PAID`.
   Резерв становится окончательным списанием.
7. Бот уведомляет партнёра «Выплата произведена». Бухгалтерия берёт выгрузку (§10).

### Unhappy paths

- **Недостаточный баланс / ниже порога**: заявка не создаётся; бот объясняет,
  сколько доступно. Никаких записей в ledger.
- **Двойной тап**: вторая попытка ловится `@unique externalId` (P2002) → одна
  заявка; бот показывает существующую.
- **Отклонение админом** (`REQUESTED → REJECTED`): резерв возвращён, партнёр
  уведомлён с причиной (`rejectReason`).
- **Отзыв партнёром** (`REQUESTED → CANCELLED`) до одобрения: резерв возвращён.
  После APPROVED кнопка отмены у партнёра скрыта.
- **Выплата сорвалась** (`APPROVED → FAILED`, напр. неверные реквизиты): админ
  ставит FAILED с `failReason`, резерв возвращён, партнёр может подать заново.
- **Возврат заказа в это же время** (план 003): clawback реверсит невыведенную
  комиссию; пересечение с активным резервом обрабатывается «already spent»-веткой
  плана 003 (реверс остатка + лог shortfall).

---

## 9. Решения владельца (зафиксированы 2026-06-23)

> Кросс-ссылка на юридический FAQ: `docs/b2b-referral-hierarchy-guide.md:440,452`
> (глубина > 3 уровней → зона MLM-регулирования; одна организация на проект).

Все пять вопросов закрыты владельцем. Дизайн строится на этих ответах.

1. **РФ налоги/самозанятость — ТОЛЬКО ВЫГРУЗКА.** Платформа НЕ генерирует чеки
   «Мой налог» и НЕ ведёт агентские договоры. Бухгалтеры клиента в штате — они
   разбираются с налогами/чеками сами по выгрузке (§10). В коде v1: сбор
   `payoutDetails` + поля партнёра + CSV-экспорт. Никакой юр-интеграции.
2. **Минимальный порог — НАСТРАИВАЕТСЯ В ПРОЕКТЕ.** Подтверждено технически:
   порог живёт как новое поле на `ReferralProgram` (per-project b2b-настройки,
   `prisma/schema.prisma:229`, уже хранит `minPurchaseAmount/bonusPercent/
   cookieLifetime`). Добавляем `payoutMinAmount Decimal @default(0)`. `0` =
   порога нет. Жёсткой периодичности в v1 нет.
3. **Валюта/удержания/частичный вывод — RUB, БЕЗ УДЕРЖАНИЙ, ЧАСТИЧНЫЙ РАЗРЕШЁН.**
   Конвертация 1:1, комиссия платёжной системы не моделируется (выплата ручная,
   вне системы). Партнёр указывает любую сумму ≤ доступного баланса (но ≥ порога).
4. **Withdrawable + clawback — HOLD-PERIOD, остальное вручную и фактически
   игнорируем.** `withdrawable = currentBalance`, опциональный «период выдержки»
   `payoutHoldDays` (комиссия выводима через N дней — защита от ранних возвратов).
   Уже **выведенную** (PAID) комиссию при позднем возврате заказа возвращаем
   **вручную** — план 003 клавбэчит только невыведенное. Владелец отметил: возвраты
   у партнёрских заказов **редки**, поэтому пересечение «активный резерв ↔ clawback»
   в v1 **не переусложняем** — оставляем поведение плана 003 как есть (реверс
   остатка + лог shortfall, §7.6) и не строим спец-логику. `payoutHoldDays` по
   умолчанию `0` (выдержки нет), включается проектом при желании.
5. **Одобряет — АДМИН ПРОЕКТА.** Использует существующую `getCurrentAdmin` +
   `verifyProjectAccess` (`.../payouts/route.ts:31-42`). Делегирование директору
   организации — v2.

---

## 10. Точки интеграции в ЭТОМ коде (с реальными путями)

Все пути ниже открыты и проверены в ходе спайка.

### Telegram-бот (канал заявки — решение 1)

- **Меню/кнопки**: `src/lib/workflow-templates/b2b-partner-cabinet.json` —
  callback `partner_payouts` уже есть для всех ролей (директор/менеджер/тренер).
  Добавить кнопку «➕ Вывести деньги» рядом.
- **Текущий рендер «Мои выплаты»**:
  `src/lib/services/workflow/handlers/action-handlers.ts:2184-2292`
  (`PartnerPayoutsHandler`). v1 расширяет этот раздел кнопкой запроса; сам список
  истории не ломаем.
- **Диспетчер callback'ов партнёра**:
  `src/lib/services/partner-cabinet.service.ts:70`
  (`tryHandleTelegramCallback`) — уже обрабатывает `partner_join_approve:` и т.п.
  Сюда добавляются `payout_request`, `payout_cancel:<id>`. Вызывается из
  `src/lib/telegram/bot.ts:180`.
- **Conversation для ввода суммы/реквизитов**: использовать существующий механизм
  сессий бота (`src/lib/services/bot-session.service.ts`,
  `bot-flow-executor/conversations-integration.ts`).
- **Уведомления партнёру/админу**:
  `src/lib/services/partner-notification.service.ts` и/или
  `src/lib/telegram/notifications.ts`.

### Сервисы

- **Новый `PayoutService`** (`src/lib/services/payout.service.ts`, создать):
  `requestPayout / approvePayout / rejectPayout / markPaid / failPayout /
  cancelPayout`, статические методы в стиле репозитория (как `PartnerTeamService`,
  `ReferralService`).
- **Ledger-резерв/возврат**: переиспользовать `UserService.spendBonuses`
  (`src/lib/services/user.service.ts:1164`) для дебета и паттерн компенсирующей
  транзакции из плана 003 (`ReferralService.reverseReferralBonus`,
  `referral.service.ts:647`) для refund'а.
- **Баланс**: `UserService.getUserBalance` (`user.service.ts:510`) для проверки
  withdrawable.
- **Согласование с возвратами**: `ReferralService.reverseReferralBonus`
  (`referral.service.ts:647`) — точка, где clawback пересекается с резервом
  (инвариант §7.6).

### Prisma

- `prisma/schema.prisma`: добавить `model Payout` + `enum PayoutStatus` (§5.1),
  обратные связи `payouts Payout[]` в `model User` (`:362`) и `model Project`.
  Никаких изменений `Bonus`/`Transaction` не обязательно (резерв/refund — через
  существующий `SPEND`/`EARN` + `metadata.payoutId`). Опционально позже —
  `TransactionType.PAYOUT`.
- **`model ReferralProgram` (`:229`) — настройки b2b-вывода (решения §9.2/§9.4):**
  добавить `payoutMinAmount Decimal @default(0) @db.Decimal(10,2)` (минимальный
  порог; `0` = без порога) и `payoutHoldDays Int @default(0)` (период выдержки;
  `0` = выводимо сразу). Это естественный дом — модель уже per-project и хранит
  однотипные крутилки (`minPurchaseAmount`, `bonusPercent`, `cookieLifetime`).

> ⚠️ **Честная оговорка для исполнителя (план 007):** возврат резерва на
> REJECTED/CANCELLED/FAILED — это **тот же приём** компенсирующей транзакции, что в
> плане 003, но **не та же функция**. `reverseReferralBonus` (`:647`) откатывает по
> `orderId`, а нам нужно «вернуть бонусы по конкретному `payoutId`/`ledgerBatchId`».
> Это **новая маленькая процедура** `PayoutService.refundReserve(payoutId)` (re-EARN
> зарезервированной суммы, идемпотентно по `payout_refund_<id>`), а не вызов
> существующей. Не обманываться формулировкой «переиспользуем».

### Админ-поверхность (дом для одобрения)

- Раздел партнёров/рефералки уже живёт под
  `src/app/dashboard/projects/[id]/referral/` — логичный дом для вкладки
  «Выплаты / Payouts».
- API-стиль и авторизация: копировать с
  `src/app/api/projects/[id]/users/[userId]/payouts/route.ts` (`getCurrentAdmin`
  + `ProjectService.verifyProjectAccess`, строки 31-42). Новые эндпойнты:
  `GET /api/projects/[id]/payouts` (очередь),
  `POST /api/projects/[id]/payouts/[payoutId]/approve|reject|paid|fail`.

### Выгрузка для бухгалтерии

- **Формат v1**: CSV (или JSON-дамп, ср. `bonus_system.dump` в корне репо).
  Колонки: `payoutId, requestedAt, paidAt, projectId, partnerName, partnerPhone,
  telegramId, amount, currency, payoutMethod, payoutDetails(masked), status,
  externalRef, reviewedBy, paidBy`.
- Эндпойнт `GET /api/projects/[id]/payouts/export?status=PAID&from=&to=` →
  `text/csv`. Денежные данные маскировать в логах; выгрузка — только под
  `verifyProjectAccess`.

---

## 11. Минимальный v1-срез (и что отложено)

### v1 (минимально работоспособное)

1. Prisma: `model Payout` + `enum PayoutStatus` + поля `ReferralProgram.
   payoutMinAmount/payoutHoldDays` (+ migration).
2. `PayoutService` со всеми шестью переходами и резервом/refund'ом на базе
   `spendBonuses` + компенсирующих транзакций.
3. Бот: кнопка «➕ Вывести деньги» + conversation (сумма+реквизиты) +
   `payout_request` / `payout_cancel` в `tryHandleTelegramCallback`.
4. Уведомления партнёру и админу.
5. Админ: список заявок + кнопки Approve / Reject / Mark paid / Fail в разделе
   `referral/`.
6. CSV-выгрузка PAID-выплат.
7. Тесты (по образцу `__tests__/services/order-refund-reversal.test.ts`):
   резерв на REQUEST не уводит баланс в минус; двойной тап = одна заявка; refund
   при reject/cancel/fail возвращает ровно резерв и идемпотентен; запрещённые
   переходы блокируются; пересечение с clawback (план 003).

### Отложено в v2

- Автоматические платёжные рельсы (ЮKassa-выплаты, СБП, банковский API).
- Приём заявки через Tilda-форму (отклонено в v1 — решение 1).
- Генерация чеков НПД / агентские договоры / интеграция «Мой налог».
- Делегирование одобрения директору организации.
- Точный расчёт withdrawable «earned − reversed − withdrawn» с hold-period как
  данными, а не настройкой.
- `TransactionType.PAYOUT` и отдельная отчётность по выводам.
- Авто-возврат уже PAID-комиссии при позднем возврате заказа (остаётся ручным).

---

## 12. Implementation checklist (для будущего executor'а — план 007; КОДА сейчас НЕ писать)

1. Прочитать этот документ + `plans/003-refund-reversal.md` (clawback) и
   `plans/001-webhook-idempotency.md` (дисциплина `externalId`).
2. Согласовать с владельцем открытые вопросы §9 (минимальный порог, hold-period,
   кто одобряет) — без них нельзя фиксировать дефолты.
3. Добавить `model Payout` + `enum PayoutStatus` в `prisma/schema.prisma`;
   `npx prisma migrate dev --name partner_payouts`; `npx prisma generate`.
4. Реализовать `src/lib/services/payout.service.ts` с резервом на REQUESTED
   (через `spendBonuses`) и компенсирующим refund'ом на REJECTED/CANCELLED/FAILED
   (идемпотентно по `payout_refund_<id>`). Все переходы — с guard'ом по `status`.
5. Покрыть `PayoutService` юнит-тестами (см. список §11.7) ДО подключения UI.
6. Бот: расширить `b2b-partner-cabinet.json` (кнопка), conversation для
   суммы/реквизитов, обработчики `payout_request` / `payout_cancel` в
   `partner-cabinet.service.ts:tryHandleTelegramCallback`.
7. Уведомления (партнёр + админ) через `partner-notification.service.ts` /
   `telegram/notifications.ts`.
8. Админ-API `POST .../payouts/[id]/{approve|reject|paid|fail}` + список +
   CSV-экспорт, авторизация копируется с
   `.../users/[userId]/payouts/route.ts`.
9. Админ-UI вкладка «Выплаты» в `src/app/dashboard/projects/[id]/referral/`.
10. E2E проверка happy + всех unhappy путей; проверить инвариант пересечения с
    clawback (план 003). Обновить `docs/b2b-referral-hierarchy-guide.md` (FAQ про
    «Мои выплаты» теперь означает реальный вывод).
11. Обновить статус 006 → DONE и завести 007 в `plans/README.md`.

---

## Приложение: список файлов, на которые опирается дизайн (открыты в спайке)

| Путь | Что подтверждает |
|---|---|
| `plans/006-partner-payout-flow-spike.md` | задание спайка, done-criteria |
| `prisma/schema.prisma:362-470` | `User`, `Bonus`, `Transaction` (ledger) |
| `prisma/schema.prisma:728-734` | `TransactionType` (нет PAYOUT) |
| `prisma/schema.prisma:182-209` | `PartnerJoinRequest` — образец request+status |
| `src/lib/services/referral.service.ts:341,492,647` | начисление и реверс комиссии |
| `src/lib/services/user.service.ts:510,871,1164` | баланс, awardBonus, spendBonuses |
| `src/lib/services/workflow/handlers/action-handlers.ts:2184` | текущий «Мои выплаты» (read-only) |
| `src/app/api/projects/[id]/users/[userId]/payouts/route.ts` | read-only payouts API + auth-паттерн |
| `src/lib/services/partner-cabinet.service.ts:70` | диспетчер bot-callback'ов партнёра |
| `src/lib/telegram/bot.ts:180` | вызов `tryHandleTelegramCallback` |
| `src/lib/workflow-templates/b2b-partner-cabinet.json` | меню бота с `partner_payouts` |
| `src/app/api/webhook/[webhookSecret]/route.ts:94-97` | order-пайплайн (почему НЕ через него) |
| `docs/b2b-referral-hierarchy-guide.md:440,452` | юридический FAQ (MLM/НПД/организация) |
| `src/lib/services/partner-team.service.ts:265-300` | как агрегируется commissionEarned |
