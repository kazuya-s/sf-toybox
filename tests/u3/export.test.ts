import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  copyRows,
  csvFileName,
  formatCell,
  saveCsv,
  toCsv,
  toTsv,
  type ExportHeaders,
} from '../../src/changeset-viewer/export';
import { loadComponents } from './helpers/fixtures';
import { installOutputSpies, restoreOutputSpies, type OutputSpies } from './helpers/output-spies';

const HEADERS: ExportHeaders = ['種類', 'API 名', '親オブジェクト'];
const DATE = new Date(2026, 10, 3, 9, 30);

describe('Copy and CSV output (export)', () => {
  let spies: OutputSpies;

  beforeEach(() => {
    spies = installOutputSpies();
  });

  afterEach(() => {
    restoreOutputSpies();
  });

  it("formula neutralizing: values starting with =, +, -, @, tab or CR get a leading ' (headers too; BR3.5)", () => {
    expect(formatCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(formatCell('+1')).toBe("'+1");
    expect(formatCell('-1')).toBe("'-1");
    expect(formatCell('@cmd')).toBe("'@cmd");
    expect(formatCell('\tTest')).toBe('"\'\tTest"');
    expect(formatCell('\rTest')).toBe('"\'\rTest"');
    expect(formatCell('Test=1+1')).toBe('Test=1+1');
    const firstLine = toTsv([], ['=Type', 'API', 'Parent']).split('\r\n')[0];
    expect(firstLine).toBe("'=Type\tAPI\tParent");
  });

  it('values with commas, quotes, line breaks or tabs are quoted, with inner quotes doubled (BR3.4)', () => {
    expect(formatCell('Test,Comma')).toBe('"Test,Comma"');
    expect(formatCell('Test"Quoted"')).toBe('"Test""Quoted"""');
    expect(formatCell('Test\r\nLine')).toBe('"Test\r\nLine"');
    expect(formatCell('Test\nLine')).toBe('"Test\nLine"');
    expect(formatCell('Test\tTab')).toBe('"Test\tTab"');
    expect(formatCell('TestPlain')).toBe('TestPlain');
  });

  it('rows without a parent object get an empty cell (never "-"; BR3.3)', () => {
    const rows = loadComponents('components-no-parent').components;

    const lines = toCsv(rows, HEADERS).replace('﻿', '').split('\r\n');

    expect(lines[1]).toBe('Visualforce Page,TestPage,');
    expect(lines[2]).toBe('Custom Object,TestObject__c,');
    expect(lines.join('')).not.toContain('-');
  });

  it('copy is tab-separated and CSV comma-separated, both with a header row and CRLF (BR3.2, BR3.6)', () => {
    const rows = loadComponents('components-basic').components.slice(0, 1);

    expect(toTsv(rows, HEADERS)).toBe(
      '種類\tAPI 名\t親オブジェクト\r\nCustom Field\tTestField__c\tTestObject__c\r\n',
    );
    expect(toCsv(rows, HEADERS)).toBe(
      '﻿種類,API 名,親オブジェクト\r\nCustom Field,TestField__c,TestObject__c\r\n',
    );
  });

  it('CSV starts with a BOM and the saved file is a UTF-8 CSV (BR3.6)', async () => {
    const text = toCsv(loadComponents('components-basic').components, HEADERS);

    const result = saveCsv(text, 'TestChangeSet_20261103.csv');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(spies.downloads).toEqual(['TestChangeSet_20261103.csv']);
    expect(spies.blobs[0]?.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await spies.blobs[0]!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('file name: invalid characters, 100 characters, surrounding spaces and a trailing ".", empty, CON etc. (BR3.7)', () => {
    expect(csvFileName('TestChangeSet', DATE)).toBe('TestChangeSet_20261103.csv');
    expect(csvFileName('Test\\/:*?"<>|\u0001Set', DATE)).toBe('Test__________Set_20261103.csv');
    expect(csvFileName('T'.repeat(150), DATE)).toBe(`${'T'.repeat(100)}_20261103.csv`);
    expect(csvFileName('  TestSet.. ', DATE)).toBe('TestSet_20261103.csv');
    expect(csvFileName(' ... ', DATE)).toBe('changeset_20261103.csv');
    expect(csvFileName('', DATE)).toBe('changeset_20261103.csv');
    expect(csvFileName('con', DATE)).toBe('_con_20261103.csv');
    expect(csvFileName('LPT9', DATE)).toBe('_LPT9_20261103.csv');
    expect(csvFileName('COM10', DATE)).toBe('COM10_20261103.csv');
  });

  it('success when the clipboard write works; a failed write returns a failed Result (BR3.8)', async () => {
    await expect(copyRows('Test\r\n')).resolves.toEqual({ ok: true, value: undefined });
    expect(spies.writeText).toHaveBeenCalledWith('Test\r\n');

    spies.writeText.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const result = await copyRows('Test\r\n');

    expect(result).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
    expect(result.ok ? null : result.error.detail).toBe('NotAllowedError');
  });

  it('a failed save returns a failed Result (BR3.8)', () => {
    spies.createObjectURL.mockImplementationOnce(() => {
      throw new TypeError('blob failed');
    });

    const result = saveCsv('﻿Test\r\n', 'TestSet_20261103.csv');

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'storageFailed', detail: 'TypeError' },
    });
    expect(spies.downloads).toEqual([]);
  });
});
