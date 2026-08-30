# B2B QR and first-purchase discount research run

`CONTEXT_GATE: PASSED`

- Дата старта: 2026-08-29
- Владелец задачи: владелец Gupil
- Путь валидации: не запускается, пока не определены бизнес-метрика и правила спорных случаев

---

## Исходный запрос (как гипотеза)

> QR организации должен приводить нового клиента в нужную B2B-организацию и давать настроенную однократную скидку на первую покупку.

- Скрытое допущение: `utm_org` гарантированно проходит через Tilda, регистрация и заказ используют один источник процента, а скидку невозможно применить повторно или подменить на клиенте.
- Почему выбран этот инструмент: QR уже реализован и показан в карточке организации; вопрос — в корректности полного контура, а не генерации картинки.

---

## C1 — Бизнес-результат и цели

### Результат

| Поле | Значение |
|---|---|
| Бизнес-результат | Корректная атрибуция клиентов бизнеса и управляемая приветственная скидка без потери маржи |
| Метрика | Количество партнёрских UI/action leaks у `CLIENT`; доля регистраций по QR с верной `organizationId` и membership |
| Baseline | 1 подтверждённый инцидент: конечному покупателю показаны организация и партнёрский доход; org-only QR теряется в production widget по статическому трассированию |
| Target | 0 партнёрских элементов и действий у `CLIENT`; 100% сохранение `utm_org` в контролируемой матрице регистрации |
| Срок | До следующего выпуска B2B/QR-изменений |
| Экономический эффект | Исключить ошибочные ожидания выплат, неверную атрибуцию и повторную выдачу скидки; сумма не оценена |
| Что мешает сейчас | Разрывы org-only атрибуции, несколько источников процента, клиентское применение скидки без серверной сверки суммы |
| Данные, подтверждающие ограничение | Репозиторий, тесты и локальные проверки 2026-08-29 |
| Критические неизвестные | Нет для подтверждённых исправлений; Tilda sandbox и live-воронка остаются релизным, а не implementation-гейтом |

### Вопросы

- Как исключить партнёрские возможности у конечного покупателя и сохранить их у подтверждённых партнёров?
- Как обеспечить org-only атрибуцию нового клиента без перепривязки существующего?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F1.1 | QR кодирует URL регистрации с `utm_org`, но не процент и не персональный токен | repository | `src/lib/utils/referral-link.ts`, QR route | 2026-08-29 | high | yes |
| F1.2 | Live baseline и экономический target отсутствуют | observation | исходный запрос | 2026-08-29 | high | yes |
| F1.3 | Зафиксирован incident: конечному покупателю показаны организация и партнёрский доход | document | screenshot and Maria report 2026-08-29 | 2026-08-29 | high | yes |

### Интерпретация

- Цель — не «сгенерировать QR», а обеспечить сквозную атрибуцию и контролируемое применение скидки.

### Связи с другими контекстами

- C1 зависит от Tilda-пути C4 и правил multi-org C2/C3.

### Ограничения

- Без live-воронки нельзя оценить масштаб потерь.

### Противоречия

- UI обещает автоматическое попадание в организацию, а org-only метка не сохраняется собственным attribution-кодом.

### Возможности

- Ввести измеряемую воронку и trace-id кампании QR.

### Пробелы

- Live baseline всей QR-воронки, средний чек и допустимая стоимость скидки остаются количественными пробелами, но не меняют подтверждённое правило доступа.

---

## C2 — Пользователь

### Вопросы

- Новый или уже существующий клиент сканирует QR? Может ли он состоять в нескольких организациях?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F2.1 | Ссылка QR не содержит `utm_ref`; она рассчитана на org-only регистрацию | repository | `organization-qr-card.tsx`, `referral-link.ts` | 2026-08-29 | high | yes |
| F2.2 | Existing-user signup связывает атрибуцию только при наличии `utmSource`/`utm_ref` | repository | `order-processing.service.ts:125-148`, `user.service.ts:416-425` | 2026-08-29 | high | yes |
| F2.3 | Владелец подтвердил: existing CLIENT не перепривязывается, не получает повторную скидку; stacking и повтор после refund запрещены | interview | owner confirmation in task 2026-08-29 | 2026-08-29 | high | yes |

### Интерпретация

- Сценарий повторного клиента по org-only QR сейчас не имеет рабочего механизма привязки.

### Связи с другими контекстами

- Конфликтует с multi-org моделью C4 и обещанием UI C1.

### Ограничения

- Автоматическая смена организации существующего клиента запрещена подтверждённым правилом.

### Противоречия

- QR объявлен неперсональным, но часть повторной атрибуции требует персонального реферера.

### Возможности

- Явно разделить правила «новый клиент», «существующий без организации», «существующий в другой организации».

### Пробелы

- Live-наблюдение поведения existing CLIENT в Tilda остаётся релизной проверкой.

---

## C3 — Компания

### Вопросы

- Кто выставляет процент, кто отвечает за распечатанные QR и кто несёт стоимость ошибочной скидки?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F3.1 | Организация создаётся без поля скидки в create UI; процент меняется позже в карточке организации | repository | `partner-organizations-panel.tsx`, `organization-detail-view.tsx` | 2026-08-29 | high | no |
| F3.2 | Изменение slug меняет URL, а напечатанный QR не имеет стабильного redirect-id | repository | QR route and organization update route | 2026-08-29 | high | yes |

### Интерпретация

- Нужен владелец процесса выпуска/отзыва QR и изменения процента.

### Связи с другими контекстами

- Операционный риск C3 усиливает техническую мутабельность C4.

### Ограничения

- Нет журнала выпуска QR и срока кампании.

### Противоречия

- Slug редактируем, но QR предполагается печатать на физических носителях.

### Возможности

- Стабильный campaign/QR id, статусы active/revoked и аудит изменений.

### Пробелы

- Количественный лимит процента по марже остаётся неизвестным; роль конечного покупателя определена как `CLIENT` без партнёрского доступа.

---

## C4 — Продукт и операции

### Вопросы

- Где authoritative источник процента и кто серверно подтверждает фактическую сумму скидки?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F4.1 | Production Tilda attribution сохраняет данные только если есть `utm_ref`; org-only QR не сохраняется и не инжектируется кодом Gupil | repository | `public/tilda-bonus-widget.js:158-252` | 2026-08-29 | high | yes |
| F4.2 | Project settings преобразуют сохранённые `0%` в `10%` через логический fallback | repository | `project-settings-view.tsx:171-172` | 2026-08-29 | high | yes |
| F4.3 | Referral settings отправляют тип/процент, но API Zod schema их не содержит и молча отбрасывает | repository | `referral-settings-form.tsx:154-169`, referral-program route schema | 2026-08-29 | high | yes |
| F4.4 | Виджет применяет процент в браузере через общий код `GUPIL`; accounting проверяет код и eligibility, но не сверяет gross/net discount amount | repository | `tilda-bonus-widget.js:5197-5221`, `order-accounting.service.ts` | 2026-08-29 | high | yes |
| F4.5 | Однократность на accounting защищена row lock и `firstPurchaseDiscountRedeemedAt`; refund не открывает скидку повторно | repository | order accounting and refund tests | 2026-08-29 | high | yes |
| F4.6 | 20 B2B/referral suites and 108 tests passed; full suite failed 5/65 suites | experiment | local Jest runs | 2026-08-29 | high | no |
| F4.7 | TypeScript check fails; Next build passes only because type errors are ignored | experiment | `next.config.ts`, local commands | 2026-08-29 | high | no |
| F4.8 | Bot home uses any organization membership to show organization, partner income and team access | repository | `action-handlers.ts:1993-2107`, `user-variables.service.ts:544-576` | 2026-08-29 | high | yes |

### Интерпретация

- Генерация SVG/PNG корректна как картинка; некорректен или недоказан сквозной бизнес-поток после сканирования.

### Связи с другими контекстами

- C4 объясняет расхождение обещания C1 и пользовательского пути C2.

### Ограничения (включая стек и архитектуру)

- Legacy `User.organizationId` сосуществует с multi-org membership; скидка читает legacy relation.
- Нет browser E2E для реального production-виджета.

### Противоречия

- Сервер решает eligibility, но размер скидки применяется клиентом.
- Два экрана и две модели данных выглядят как источники одного приветственного вознаграждения.

### Возможности

- Один серверный DiscountQuote/Redemption contract и одна authoritative настройка.

### Пробелы

- Реальная Tilda checkout семантика и применённые production migrations.

---

## C5 — Рынок

### Вопросы

- Является ли скидка инструментом привлечения бизнеса, клиента или обоих?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F5.1 | Репозиторий не содержит CAC/LTV, маржу или сравнение B2B кампаний | repository | repository audit | 2026-08-29 | high | yes |

### Интерпретация

- Нельзя обосновать дефолт 10% или диапазон 0–100% экономикой.

### Связи с другими контекстами

- Блокирует target C1 и правила одобрения C3.

### Ограничения

- Нет рыночных и unit-economic данных.

### Противоречия

- Технически разрешено 100%, но бизнес-ограничение не зафиксировано.

### Возможности

- Ввести проектный maxDiscountPercent и approval threshold.

### Пробелы

- Маржа и допустимая стоимость привлечения.

---

## C6 — История решений

### Вопросы

- Что именно исправлял последний QR-коммит и проверялся ли он на Tilda?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F6.1 | Commit `2612496` добавил `/members/signup` к ссылке и unit-тест URL, но не менял attribution widget | repository | git commit `2612496` | 2026-08-25 | high | yes |
| F6.2 | Browser/widget tests уже содержат заметку о неподготовленной среде и падают в полном прогоне | experiment | widget integration tests, Jest run | 2026-08-29 | high | yes |

### Интерпретация

- Последняя правка закрыла маршрут, но не доказала передачу org-only метки и скидку.

### Связи с другими контекстами

- Объясняет текущий разрыв C4 и отсутствие уверенности C1.

### Ограничения

- Нет зафиксированного physical-device/Tilda UAT.

### Противоречия

- Unit-тест проверяет строку URL, а пользовательский результат зависит от нескольких систем.

### Возможности

- Перевести regression test на production bundle и webhook fixture.

### Пробелы

- История production инцидентов по QR/скидке.

---

## C7 — Новые модели

### Вопросы

- Нужен ли общий QR организации или управляемые кампании?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F7.1 | Текущая модель кодирует mutable slug и не создаёт сущность QR/campaign | repository | schema and QR route | 2026-08-29 | high | no |

### Интерпретация

- Campaign entity лучше поддерживает печать, отзыв, аналитику и разные предложения.

### Связи с другими контекстами

- Закрывает операционный риск C3 и измеримость C1.

### Ограничения

- Это гипотеза, пока не доказана потребность в нескольких кампаниях.

### Противоречия

- Нельзя измерить эффективность конкретного физического носителя по одному slug.

### Возможности

- Стабильный QR campaign id с серверным redirect и optional offer snapshot.

### Пробелы

- Сколько QR/кампаний нужно одному бизнесу.

---

## C8 — Внешняя среда и будущее

### Вопросы

- Какие гарантии даёт Tilda для UTM, промокода и итоговой суммы оплаты?

### Факты

| fact_id | fact | source_type | source_ref | source_date | confidence | critical |
|---|---|---|---|---|---|---|
| F8.1 | Система зависит от Tilda browser API и webhook payload; точные гарантии не зафиксированы в проектном контракте | repository | production widget and Tilda parser | 2026-08-29 | high | yes |
| F8.2 | Next 16 уже требует Promise params; часть routes не совместима по типам | experiment | TypeScript output | 2026-08-29 | high | no |

### Интерпретация

- Внешнюю платформу нельзя считать trusted pricing authority без sandbox-проверки и серверной сверки.

### Связи с другими контекстами

- Усиливает риск клиентской скидки C4 и требует UAT C6.

### Ограничения

- В текущем аудите нет доступа к активной Tilda странице и live DB.

### Противоречия

- Build зелёный при красном typecheck маскирует platform drift.

### Возможности

- Contract tests на сохранённых webhook fixtures и мониторинг расхождения сумм.

### Пробелы

- Tilda sandbox, production page URL, webhook examples до/после скидки.

---

## Синтез

### S1

- facts: F1.1, F2.1, F4.1, F6.1
- contexts: C1, C2, C4, C6
- interpretation: QR строка корректна, но org-only атрибуция не доказана и собственным кодом теряется.
- contradiction: UI обещает автоматическую привязку без персонального реферера, а persistence зависит от персонального `utm_ref`.
- opportunity: поддержать org-only как самостоятельный attribution subject и покрыть E2E.
- mechanism: `utm_org` сохраняется/инжектируется независимо и сервер идемпотентно назначает membership.
- hypothesis: H1

### S2

- facts: F3.1, F4.2, F4.3, F4.4, F5.1
- contexts: C3, C4, C5
- interpretation: процент не имеет единого источника и бизнес-лимита; применение частично доверено браузеру.
- contradiction: eligibility серверная, pricing клиентский.
- opportunity: единый server-side quote/redemption contract.
- mechanism: подписанная котировка связывает user, organization, percent, basket and expiry.
- hypothesis: H2

### S3

- facts: F1.3, F2.3, F4.8
- contexts: C1, C2, C4
- interpretation: membership означает принадлежность клиента организации, но не участие в партнёрской программе.
- contradiction: bot home использует `memberships.length > 0` и для подписи организации, и для партнёрского дохода/команды.
- opportunity: вычислять доступ из партнёрской роли или partner membership (`level != null || canManage`), не из факта клиентского membership.
- mechanism: единая чистая функция access model используется переменными workflow, bot home и защитой callback actions.
- hypothesis: H3

---

## Гипотезы

### H1

- level: process
- action: прогнать org-only QR через реальную signup страницу с фиксацией hidden fields, balance request, webhook и membership
- mechanism: обнаружить точное место потери метки до реализации
- metric: successful organization attribution rate
- baseline: 0 из 10 сценариев подтверждены сквозным тестом
- target: 10/10 сценариев матрицы UAT
- deadline: один рабочий день после предоставления sandbox
- source_contexts: C1, C2, C4, C6
- cheap_test: Tilda sandbox + 10 уникальных контактов, без production скидок/списаний
- success_criterion: верная organization/membership/order snapshot во всех ожидаемых сценариях
- falsification_criterion: хотя бы один silent success с неверной организацией
- confidence: high

### H2

- level: process
- action: попытаться изменить browser `discountpercent`, повторить `GUPIL` и совместить его с бонусами в sandbox
- mechanism: проверить, может ли клиент влиять на оплачиваемую сумму вне server eligibility
- metric: accepted orders with unauthorized discount
- baseline: server eligibility принимает marker `GUPIL` без доказанной сверки gross/net
- target: 0
- deadline: один рабочий день после предоставления sandbox
- source_contexts: C3, C4, C5
- cheap_test: три tamper-сценария без production оплаты
- success_criterion: Tilda/server отклоняет или нормализует все подмены
- falsification_criterion: проходит хотя бы один заказ с несогласованным percent/gross/net
- confidence: med

### H3

- level: process
- action: отделить клиентское membership от партнёрского доступа во всех bot/workflow entry points
- mechanism: одна access model скрывает текст и кнопки и запрещает прямой callback для `CLIENT`
- metric: partner UI/action leaks to CLIENT
- baseline: 1 подтверждённый инцидент
- target: 0 во всей regression-матрице
- deadline: до следующего выпуска
- source_contexts: C1, C2, C4
- cheap_test: screenshot + current-code trace + unit matrix CLIENT/TRAINER/MANAGER/DIRECTOR
- success_criterion: CLIENT видит только покупки, бонусы, уровень и помощь; партнёрские роли сохраняют разрешённые функции
- falsification_criterion: любой партнёрский текст, кнопка или успешный прямой callback у CLIENT
- confidence: high

---

## Пробелы в данных

- Live baseline QR-воронки, Tilda sandbox/page URL, применённые production migrations, маржа и допустимый процент. Правила подтверждены владельцем: existing CLIENT не перепривязывается и не получает повторную скидку; скидка не складывается; возврат не восстанавливает право; организация — единственный источник процента.

## Запросы владельцу / документы

- См. `plans/017-b2b-qr-data-request.md`.

---

## Насыщение

- repeated_sources: yes
- repetition_evidence: UI, API, service, tests and git history повторяют один и тот же контракт URL, но не доказывают browser-to-webhook результат.
- key_constraints_verified: yes
- contradictions_identified: yes
- missing_quantitative_data: live funnel, margin, sandbox outcomes; они явно вынесены за пределы подтверждённых исправлений
- stop_reason: screenshot, owner confirmation, UI, API, services and history сходятся; дополнительное чтение кода не изменяет модель доступа.

---

## После CONTEXT_GATE: PASSED

### Переформулированная задача

- Сделать org-only QR надёжным для новых клиентов, оставить существующего клиента без автоматического перепривязывания и повторной скидки, а партнёрские возможности выдавать только подтверждённому партнёру, не любому клиенту организации.

### Карта системы

- QR URL → Tilda attribution → signup/balance → User + Membership → eligibility → browser discount → paid webhook → accounting redemption.

### Implementation brief

- Проверенная гипотеза: H3 и статически подтверждённая часть H1.
- Что строим / меняем: единая access model; bot/workflow guards; org-only attribution persistence; понятная настройка процента; API validation and regression tests.
- Что не строим: автоматическое перепривязывание existing CLIENT, повторную скидку, stacking, восстановление после refund, server pricing quote до Tilda sandbox.
- Критерии успеха: 0 partner UI/actions у CLIENT; 100% unit matrix; `0%` не превращается в `10%`; `utm_org` живёт без `utm_ref`.
- Критерии остановки: regression партнёрских ролей, существующих клиентов, бонусов или order accounting.
- План реализации: сначала pure access/attribution tests, затем минимальные consumers, потом targeted B2B suite и build/type evidence отдельно.
