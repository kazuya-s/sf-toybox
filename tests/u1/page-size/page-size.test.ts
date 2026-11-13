import { describe, expect, it } from 'vitest';
import {
  PRESET_SIZES,
  buildPageSizeUrl,
  parsePageSizeInput,
  selectedPreset,
} from '../../../src/page-size/page-size';
import { urls } from '../fixtures/pages';

describe('件数の切り替え（page-size）', () => {
  it('ボタンの値は 100・500・1000・2000（BR3.1）', () => {
    expect(PRESET_SIZES).toEqual([100, 500, 1000, 2000]);
  });

  it.each([
    ['500', '500'],
    ['3000', '3000'],
    ['  250  ', '250'],
  ])('受け付ける入力: %j → %s（BR3.2）', (input, expected) => {
    expect(parsePageSizeInput(input)).toBe(expected);
  });

  it.each(['', '   ', '0', '-5', '-1', '1.5', 'abc', '0500', '10"><script>', 'javascript:', '1e3'])(
    '受け付けない入力: %j（BR3.2、NFR3.4）',
    (input) => {
      expect(parsePageSizeInput(input)).toBeNull();
    },
  );

  it('rowsperpage を置き換えたとき、ほかのパラメータとその順序が残る（BR3.3、AC2.1.5）', () => {
    const href = 'https://example.my.salesforce.com/01p?setupid=ApexClasses&rowsperpage=100&lsi=0';

    const next = new URL(buildPageSizeUrl(href, 1000));

    expect(Array.from(next.searchParams.entries())).toEqual([
      ['setupid', 'ApexClasses'],
      ['rowsperpage', '1000'],
      ['lsi', '0'],
    ]);
    expect(next.origin + next.pathname).toBe('https://example.my.salesforce.com/01p');
  });

  it('rowsperpage がないときは最後に足す', () => {
    const next = new URL(buildPageSizeUrl(urls.listWithoutRowsPerPage, 500));

    expect(Array.from(next.searchParams.keys())).toEqual(['setupid', 'rowsperpage']);
    expect(next.searchParams.get('rowsperpage')).toBe('500');
  });

  it('選択中のボタン: 一致するとき、一致しないとき、ないとき（BR3.4、AC2.1.6）', () => {
    expect(selectedPreset(urls.listWithRowsPerPage)).toBe(500);
    expect(selectedPreset('https://example.my.salesforce.com/01p?rowsperpage=300')).toBeNull();
    expect(selectedPreset(urls.listWithoutRowsPerPage)).toBeNull();
  });

  it('上限を設けない（100000 や桁の多い値も丸めずに受け付ける。BR3.5）', () => {
    const huge = '123456789012345678901234567890';

    expect(parsePageSizeInput('100000')).toBe('100000');
    expect(
      new URL(buildPageSizeUrl(urls.listWithoutRowsPerPage, huge)).searchParams.get('rowsperpage'),
    ).toBe(huge);
  });

  it('正しくない値で URL を作ろうとすると例外にし、URL を作らない', () => {
    expect(() => buildPageSizeUrl(urls.listWithoutRowsPerPage, '10"><script>')).toThrow(RangeError);
    expect(() => buildPageSizeUrl(urls.listWithoutRowsPerPage, 0)).toThrow(RangeError);
  });
});
