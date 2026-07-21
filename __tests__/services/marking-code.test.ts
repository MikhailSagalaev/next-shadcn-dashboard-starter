import {
  decryptMarkCode,
  encryptMarkCode,
  hashMarkCode
} from '@/lib/marking/code-crypto';
import { markCodeToGs1m, parseGs1DataMatrix } from '@/lib/marking/gs1';

describe('marking code utilities', () => {
  beforeAll(() => {
    process.env.MARKING_ENCRYPTION_KEY = 'ab'.repeat(32);
  });

  it('parses GTIN and serial from scanner input', () => {
    const code = ']d2010460123456789021SERIAL123\u001d91ABCD\u001d92SIGN';
    expect(parseGs1DataMatrix(code)).toMatchObject({
      gtin: '04601234567890',
      serial: 'SERIAL123'
    });
  });

  it('encrypts codes with authenticated encryption', () => {
    const code = '010460123456789021SERIAL';
    const encrypted = encryptMarkCode(code);
    expect(encrypted).not.toContain(code);
    expect(decryptMarkCode(encrypted)).toBe(code);
    expect(hashMarkCode(code)).toHaveLength(64);
  });

  it('encodes gs_1m as base64', () => {
    expect(Buffer.from(markCodeToGs1m('abc'), 'base64').toString('utf8')).toBe(
      'abc'
    );
  });
});
