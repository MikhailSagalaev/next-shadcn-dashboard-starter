import { getOrganizationLevelHue } from '@/lib/organization-level-colors';

describe('getOrganizationLevelHue', () => {
  it('starts the spectrum from a warm hue', () => {
    expect(getOrganizationLevelHue(1)).toBe(25);
  });

  it('gives neighbouring levels distinct hues', () => {
    const hues = Array.from({ length: 20 }, (_, index) =>
      getOrganizationLevelHue(index + 1)
    );

    expect(new Set(hues).size).toBe(hues.length);
  });

  it('keeps every generated hue inside the CSS hue circle', () => {
    for (let level = 1; level <= 1000; level += 1) {
      const hue = getOrganizationLevelHue(level);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('normalizes invalid levels safely', () => {
    expect(getOrganizationLevelHue(Number.NaN)).toBe(25);
    expect(getOrganizationLevelHue(0)).toBe(25);
    expect(getOrganizationLevelHue(-10)).toBe(25);
  });
});
