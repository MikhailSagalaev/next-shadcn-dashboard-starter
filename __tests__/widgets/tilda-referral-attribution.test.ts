/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';

type AttributionApi = {
  _injectForms: (widget: unknown) => void;
  getCurrent: () => { ref: string | null; org: string | null };
};

describe('Tilda organization-only attribution', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'public', 'tilda-bonus-widget.js'),
    'utf8'
  );

  beforeEach(() => {
    localStorage.clear();
    document.cookie =
      'gupil_utm_ref=; path=/; max-age=0; gupil_utm_org=; path=/; max-age=0';
    document.body.innerHTML = '<form id="signup"></form>';
    window.history.replaceState({}, '', '/members/signup?utm_org=acme');
    delete (window as typeof window & { TildaBonusWidget?: unknown })
      .TildaBonusWidget;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists and injects utm_org without requiring utm_ref', () => {
    window.eval(source);
    const widget = (
      window as typeof window & {
        TildaBonusWidget: { referralAttribution: AttributionApi };
      }
    ).TildaBonusWidget;

    expect(widget.referralAttribution.getCurrent()).toEqual({
      ref: null,
      org: 'acme'
    });

    widget.referralAttribution._injectForms(widget);

    expect(
      document.querySelector<HTMLInputElement>('input[name="utm_org"]')?.value
    ).toBe('acme');
    expect(document.querySelector('input[name="utm_ref"]')).toBeNull();
  });
});
