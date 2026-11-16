import { describe, expect, it } from 'vitest';
import {
  PRESET_SIZES,
  buildPageSizeUrl,
  parsePageSizeInput,
  selectedPreset,
} from '../../../src/page-size/page-size';
import { urls } from '../fixtures/pages';

describe('Page-size switching (page-size)', () => {
  it('button values are 100, 500, 1000, 2000 (BR3.1)', () => {
    expect(PRESET_SIZES).toEqual([100, 500, 1000, 2000]);
  });

  it.each([
    ['500', '500'],
    ['3000', '3000'],
    ['  250  ', '250'],
  ])('accepted input: %j -> %s (BR3.2)', (input, expected) => {
    expect(parsePageSizeInput(input)).toBe(expected);
  });

  it.each(['', '   ', '0', '-5', '-1', '1.5', 'abc', '0500', '10"><script>', 'javascript:', '1e3'])(
    'rejected input: %j (BR3.2, NFR3.4)',
    (input) => {
      expect(parsePageSizeInput(input)).toBeNull();
    },
  );

  it('replacing rowsperpage keeps other parameters and their order (BR3.3, AC2.1.5)', () => {
    const href = 'https://example.my.salesforce.com/01p?setupid=ApexClasses&rowsperpage=100&lsi=0';

    const next = new URL(buildPageSizeUrl(href, 1000));

    expect(Array.from(next.searchParams.entries())).toEqual([
      ['setupid', 'ApexClasses'],
      ['rowsperpage', '1000'],
      ['lsi', '0'],
    ]);
    expect(next.origin + next.pathname).toBe('https://example.my.salesforce.com/01p');
  });

  it('appends rowsperpage at the end when missing', () => {
    const next = new URL(buildPageSizeUrl(urls.listWithoutRowsPerPage, 500));

    expect(Array.from(next.searchParams.keys())).toEqual(['setupid', 'rowsperpage']);
    expect(next.searchParams.get('rowsperpage')).toBe('500');
  });

  it('selected button: when matching, not matching, and missing (BR3.4, AC2.1.6)', () => {
    expect(selectedPreset(urls.listWithRowsPerPage)).toBe(500);
    expect(selectedPreset('https://example.my.salesforce.com/01p?rowsperpage=300')).toBeNull();
    expect(selectedPreset(urls.listWithoutRowsPerPage)).toBeNull();
  });

  it('has no upper limit (accepts 100000 and long values without rounding; BR3.5)', () => {
    const huge = '123456789012345678901234567890';

    expect(parsePageSizeInput('100000')).toBe('100000');
    expect(
      new URL(buildPageSizeUrl(urls.listWithoutRowsPerPage, huge)).searchParams.get('rowsperpage'),
    ).toBe(huge);
  });

  it('building a URL with an invalid value throws and builds no URL', () => {
    expect(() => buildPageSizeUrl(urls.listWithoutRowsPerPage, '10"><script>')).toThrow(RangeError);
    expect(() => buildPageSizeUrl(urls.listWithoutRowsPerPage, 0)).toThrow(RangeError);
  });
});
