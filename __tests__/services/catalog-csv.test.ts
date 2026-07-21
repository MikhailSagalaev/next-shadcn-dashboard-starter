import { parseCatalogCsv } from '@/lib/catalog/catalog-csv';

describe('parseCatalogCsv', () => {
  it('parses Russian semicolon-separated catalog fields', () => {
    const [row] = parseCatalogCsv(
      'название;артикул;GTIN;цена;маркировка;НДС;остаток\nКрем;CR-1;04601234567890;1250,50;MARKED_REQUIRED;11;8'
    );
    expect(row).toMatchObject({
      name: 'Крем',
      sku: 'CR-1',
      gtin: '04601234567890',
      price: 1250.5,
      markingStatus: 'MARKED_REQUIRED',
      vatCode: 11,
      stockOnHand: 8
    });
  });

  it('handles quoted delimiters', () => {
    const [row] = parseCatalogCsv('name,price,sku\n"Крем, ночной",900,C-2');
    expect(row.name).toBe('Крем, ночной');
  });

  it('rejects invalid GTIN', () => {
    expect(() => parseCatalogCsv('name,price,gtin\nКрем,900,ABC')).toThrow(
      'GTIN должен содержать'
    );
  });
});
