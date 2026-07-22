import { ProductMarkingStatus } from '@prisma/client';

export interface CatalogImportRow {
  name: string;
  sku?: string;
  externalId?: string;
  gtin?: string;
  price: number;
  markingStatus?: ProductMarkingStatus;
  vatCode?: number;
  paymentSubject?: string;
  measure?: string;
  stockOnHand?: number;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      result.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  result.push(value.trim());
  return result;
}

const aliases: Record<string, keyof CatalogImportRow> = {
  name: 'name',
  название: 'name',
  sku: 'sku',
  артикул: 'sku',
  externalid: 'externalId',
  external_id: 'externalId',
  gtin: 'gtin',
  price: 'price',
  цена: 'price',
  markingstatus: 'markingStatus',
  marking_status: 'markingStatus',
  маркировка: 'markingStatus',
  vatcode: 'vatCode',
  vat_code: 'vatCode',
  ндс: 'vatCode',
  paymentsubject: 'paymentSubject',
  payment_subject: 'paymentSubject',
  measure: 'measure',
  единица: 'measure',
  stockonhand: 'stockOnHand',
  stock_on_hand: 'stockOnHand',
  остаток: 'stockOnHand'
};

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function parseCatalogCsv(csv: string): CatalogImportRow[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2)
    throw new Error('CSV должен содержать заголовок и товары');

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map(
    (header) => aliases[header.toLowerCase().trim()]
  );
  if (!headers.includes('name') || !headers.includes('price')) {
    throw new Error('Обязательные колонки CSV: name/название и price/цена');
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line, delimiter);
    const raw: Partial<Record<keyof CatalogImportRow, string>> = {};
    headers.forEach((header, index) => {
      if (header) raw[header] = values[index] ?? '';
    });
    const name = optional(raw.name);
    const price = Number(String(raw.price ?? '').replace(',', '.'));
    if (!name) throw new Error(`Строка ${rowIndex + 2}: отсутствует название`);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Строка ${rowIndex + 2}: неверная цена`);
    }
    const markingStatus = optional(raw.markingStatus);
    if (
      markingStatus &&
      !Object.values(ProductMarkingStatus).includes(
        markingStatus as ProductMarkingStatus
      )
    ) {
      throw new Error(`Строка ${rowIndex + 2}: неверный статус маркировки`);
    }
    const gtin = optional(raw.gtin);
    if (gtin && !/^\d{8,14}$/.test(gtin)) {
      throw new Error(
        `Строка ${rowIndex + 2}: GTIN должен содержать 8–14 цифр`
      );
    }
    const vatCode = optional(raw.vatCode);
    const stockOnHand = optional(raw.stockOnHand);
    return {
      name,
      price,
      sku: optional(raw.sku),
      externalId: optional(raw.externalId),
      gtin: gtin?.padStart(14, '0'),
      markingStatus: markingStatus as ProductMarkingStatus | undefined,
      vatCode: vatCode ? Number(vatCode) : undefined,
      paymentSubject: optional(raw.paymentSubject),
      measure: optional(raw.measure),
      stockOnHand: stockOnHand ? Number(stockOnHand) : undefined
    };
  });
}
