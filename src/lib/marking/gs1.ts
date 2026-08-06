export interface ParsedMarkCode {
  raw: string;
  gtin: string;
  serial: string;
}

export function parseGs1DataMatrix(input: string): ParsedMarkCode {
  const raw = input.trim().replace(/^\][a-z0-9]{2}/i, '');
  if (!raw) throw new Error('Код маркировки пуст');
  if (/^\d{8,14}$/.test(raw)) {
    throw new Error(
      'Введён только GTIN товара. Нужен полный Data Matrix с GTIN (01) и серийным номером (21)'
    );
  }
  const normalized = raw.replace(/\(01\)/g, '01').replace(/\(21\)/g, '21');
  const start = normalized.indexOf('01');
  if (start < 0) throw new Error('В коде отсутствует идентификатор GTIN (01)');
  const gtin = normalized.slice(start + 2, start + 16);
  if (!/^\d{14}$/.test(gtin))
    throw new Error('Некорректный GTIN в Data Matrix');
  const serialMarker = normalized.indexOf('21', start + 16);
  if (serialMarker < 0)
    throw new Error('В коде отсутствует серийный номер (21)');
  const serialTail = normalized.slice(serialMarker + 2);

  let serial = '';
  if (/[\x1d\u001d]/.test(serialTail)) {
    serial = serialTail.split(/[\x1d\u001d]/)[0];
  } else if (/\((?:91|92)\)/.test(serialTail)) {
    serial = serialTail.split(/\((?:91|92)\)/)[0];
  } else if (
    serialTail.length >= 15 &&
    (serialTail.startsWith('91', 13) || serialTail.startsWith('92', 13))
  ) {
    serial = serialTail.slice(0, 13);
  } else {
    serial = serialTail;
  }

  if (!serial) throw new Error('Серийный номер Data Matrix пуст');
  return { raw, gtin, serial };
}

export function markCodeToGs1m(code: string): string {
  return Buffer.from(code, 'utf8').toString('base64');
}
