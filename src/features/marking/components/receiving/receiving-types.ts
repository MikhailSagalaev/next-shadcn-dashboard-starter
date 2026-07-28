export interface ReceivingRecord {
  id: string;
  number?: string | null;
  documentNumber?: string | null;
  supplierName?: string | null;
  supplierInn?: string | null;
  status: string;
  expectedUnits?: number | null;
  scannedUnits?: number | null;
  acceptedUnits?: number | null;
  availableUnits?: number | null;
  quarantinedUnits?: number | null;
  discrepancyCount?: number | null;
  createdAt: string;
  acceptedAt?: string | null;
  notes?: string | null;
  units?: ReceivingUnit[];
  items?: ReceivingItem[];
  discrepancies?: Array<{
    id: string;
    type?: string | null;
    message?: string | null;
    resolution?: string | null;
    resolutionComment?: string | null;
    resolvedAt?: string | null;
    markedUnit?: {
      id: string;
      gtin: string;
      serial?: string | null;
      status: string;
      productId?: string | null;
      goodsReceiptItemId?: string | null;
      product?: {
        id: string;
        name: string;
        sku?: string | null;
        gtin?: string | null;
      } | null;
    } | null;
  }>;
  complianceDocuments?: Array<{
    id: string;
    kind: string;
    status: string;
    provider: string;
    documentNumber?: string | null;
    externalId?: string | null;
    lastError?: string | null;
  }>;
}

export interface ReceivingItem {
  id: string;
  name: string;
  gtin: string;
  expectedQuantity: number;
  acceptedQuantity: number;
  units?: ReceivingUnit[];
}

export interface ReceivingUnit {
  id: string;
  code?: string | null;
  maskedCode?: string | null;
  gtin?: string | null;
  serial?: string | null;
  status?: string | null;
  itemId?: string | null;
  productName?: string | null;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    gtin?: string | null;
  } | null;
  discrepancy?: string | null;
  createdAt?: string;
}

const RECEIVING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  CREATED: 'Черновик',
  IN_PROGRESS: 'Идёт приёмка',
  SCANNING: 'Идёт приёмка',
  READY: 'Готова к завершению',
  READY_TO_SIGN: 'Ожидает подписи УПД',
  ACCEPTANCE_PENDING: 'Подтверждается',
  REVIEW: 'Нужна сверка',
  DISCREPANCY: 'Есть расхождения',
  ACCEPTED: 'Принята',
  COMPLETED: 'Принята',
  REJECTED: 'Отклонена',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменена',
  CANCELED: 'Отменена'
};

export function receivingStatusLabel(status?: string | null) {
  if (!status) return 'Черновик';
  return RECEIVING_STATUS_LABELS[status] ?? 'Неизвестный статус';
}

export function receivingStatusTone(status?: string | null) {
  if (status === 'ACCEPTED' || status === 'COMPLETED') return 'success';
  if (
    status === 'DISCREPANCY' ||
    status === 'REVIEW' ||
    status === 'ACCEPTANCE_PENDING'
  )
    return 'warning';
  if (
    status === 'CANCELLED' ||
    status === 'CANCELED' ||
    status === 'REJECTED' ||
    status === 'FAILED'
  )
    return 'danger';
  return 'neutral';
}

export function unitStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    AVAILABLE: 'Доступна',
    EXPECTED: 'Ожидается',
    SCANNED: 'Отсканирована',
    RECEIVED: 'Принята',
    QUARANTINED: 'Карантин',
    QUARANTINE: 'Карантин',
    RESERVED: 'В резерве',
    SOLD: 'Продана',
    RETURNED: 'Возвращена',
    WRITTEN_OFF: 'Списана',
    DISCREPANCY: 'Расхождение'
  };
  return status ? (labels[status] ?? 'Неизвестно') : 'Проверяется';
}

export function formatReceivingDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function receiptTitle(receipt: ReceivingRecord) {
  return (
    receipt.number || receipt.documentNumber || `№ ${receipt.id.slice(-8)}`
  );
}
