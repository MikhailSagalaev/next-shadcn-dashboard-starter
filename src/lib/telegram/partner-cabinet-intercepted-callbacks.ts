/**
 * @file: src/lib/telegram/partner-cabinet-intercepted-callbacks.ts
 * @description: Единственный источник правды для списка callback_data,
 *   которые src/lib/telegram/bot.ts перехватывает и уводит в
 *   PartnerCabinetService ДО workflow-движка. Используется и диспетчером
 *   бота, и визуальным конструктором (чтобы показать «мёртвые» ноды).
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

/**
 * Точная копия условия из bot.ts — если меняете список там, меняйте и
 * здесь (или, ещё лучше, замените блок в bot.ts на вызов этой функции —
 * см. Step 2).
 */
export function isTelegramCallbackIntercepted(data: string): boolean {
  return (
    data.startsWith('partner_join_') ||
    data.startsWith('partner_team_remove:') ||
    data.startsWith('partner_team_remove_confirm:') ||
    data === 'partner_team_remove_cancel' ||
    data === 'partner_requests' ||
    data === 'payout_request' ||
    data.startsWith('payout_cancel:') ||
    data.startsWith('payout_method:') ||
    data === 'payout_method_cancel'
  );
}

/**
 * Для ноды конструктора: pattern хранится "голым" (см.
 * callback-trigger-match.ts::matchesCallbackPattern — паттерн матчит и
 * себя самого, и `pattern:любой_параметр`). Проверяем обе представительные
 * формы, потому что реальные нажатия часто шлют именно `pattern:0`.
 */
export function isTriggerNodePatternIntercepted(pattern: string): boolean {
  return (
    isTelegramCallbackIntercepted(pattern) ||
    isTelegramCallbackIntercepted(`${pattern}:0`)
  );
}
