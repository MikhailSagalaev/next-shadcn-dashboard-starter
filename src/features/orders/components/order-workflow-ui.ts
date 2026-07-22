export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждён',
  PROCESSING: 'В обработке',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
  REFUNDED: 'Возврат'
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Не оплачен',
  PAID: 'Оплачен',
  PARTIALLY_REFUNDED: 'Частичный возврат',
  REFUNDED: 'Возвращён'
};

export const MARKING_STATE_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Не требуется',
  UNCONFIGURED: 'Нужно настроить каталог',
  PENDING: 'Ожидает сканирования',
  PARTIAL: 'Частично отсканирован',
  COMPLETE: 'Все коды отсканированы',
  FAILED: 'Ошибка маркировки'
};

export const FISCAL_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: 'Чек ещё не создавался',
  PREPAYMENT_REGISTERED: 'Предоплата зарегистрирована',
  SETTLEMENT_PENDING: 'Чек отправляется',
  SETTLED: 'Чек зарегистрирован',
  FAILED: 'Ошибка чека',
  PARTIALLY_REFUNDED: 'Частичный возврат',
  REFUNDED: 'Возврат зарегистрирован'
};

export const RECEIPT_STATUS_LABELS: Record<string, string> = {
  NEW: 'В очереди',
  PENDING: 'Обрабатывается',
  SUCCEEDED: 'Зарегистрирован',
  FAILED: 'Ошибка',
  CANCELED: 'Отклонён'
};

export function orderNeedsAttention(order: {
  markingState: string;
  fiscalState: string;
}) {
  return (
    ['UNCONFIGURED', 'FAILED'].includes(order.markingState) ||
    order.fiscalState === 'FAILED'
  );
}

export function friendlyFiscalError(error: string | null | undefined) {
  if (!error) return null;
  const normalized = error.toLowerCase();
  if (normalized.includes('vat is not configured'))
    return 'У товара не выбрана ставка НДС. Исправьте товар в каталоге и обновите реквизиты заказа.';
  if (normalized.includes('mark code missing'))
    return 'Не для каждой упаковки отсканирован Data Matrix.';
  if (normalized.includes('customer email'))
    return 'В заказе отсутствует email покупателя, обязательный для электронного чека.';
  if (normalized.includes('payment') && normalized.includes('missing'))
    return 'Не найден идентификатор подтверждённой оплаты ЮKassa.';
  if (normalized.includes('items exceed'))
    return 'Сумма товарных позиций превышает оплаченную сумму заказа.';
  if (normalized.includes('80 items'))
    return 'В одном чеке ЮKassa может быть не более 80 строк.';
  if (normalized.includes('http 401') || normalized.includes('unauthorized'))
    return 'ЮKassa отклонила ключ магазина. Проверьте shopId и секретный ключ.';
  return 'ЮKassa не зарегистрировала чек. Откройте технические подробности ниже или повторите после исправления данных.';
}
