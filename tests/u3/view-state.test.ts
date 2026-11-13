import { describe, expect, it } from 'vitest';
import { fail, ok } from '../../src/shared/result';
import {
  INITIAL_SORT,
  createCollator,
  displayState,
  filterRows,
  nextSort,
  sortRows,
  stateFromResult,
  typeOptions,
} from '../../src/changeset-viewer/view-state';
import { buildManyComponents, loadComponents } from './helpers/fixtures';

const collator = createCollator('ja');
const apiNames = (rows: { apiName: string }[]) => rows.map((row) => row.apiName);

describe('状態の決め方と絞り込み・並べ替え（view-state）', () => {
  it('結果から empty・default・partial・session-expired・error が決まる（BR1.4）', () => {
    const basic = loadComponents('components-basic');

    expect(stateFromResult(ok(basic))).toBe('default');
    expect(stateFromResult(ok({ ...basic, components: [] }))).toBe('empty');
    expect(stateFromResult(ok({ ...basic, complete: false, failedPages: 1 }))).toBe('partial');
    expect(stateFromResult(fail('sessionExpired', 'login'))).toBe('session-expired');
    expect(stateFromResult(fail('timeout', 'slow'))).toBe('error');
    expect(stateFromResult(fail('unexpectedResponse', 'x'))).toBe('error');
  });

  it('最初の並びは種類、API 名の順で、大文字と小文字を区別しない（BR2.1）', () => {
    const rows = sortRows(loadComponents('components-basic').components, INITIAL_SORT, collator);

    // 文字コードの順なら TestZebraService（Z）が Testhelper（h）より前になる
    expect(rows.map((row) => [row.componentType, row.apiName])).toEqual([
      ['Apex Class', 'Testhelper'],
      ['Apex Class', 'TestZebraService'],
      ['Custom Field', 'TestField__c'],
    ]);
  });

  it('同じ列を 2 回押すと降順、別の列は昇順。同じ値は種類、API 名で並ぶ（BR2.2）', () => {
    const rows = loadComponents('components-basic').components;
    const byName = nextSort(INITIAL_SORT, 'apiName');
    const byNameDesc = nextSort(byName, 'apiName');
    const byParent = nextSort(byNameDesc, 'parentObject');

    expect(byName).toEqual({ column: 'apiName', direction: 'ascending' });
    expect(byNameDesc).toEqual({ column: 'apiName', direction: 'descending' });
    expect(byParent).toEqual({ column: 'parentObject', direction: 'ascending' });
    expect(nextSort(INITIAL_SORT, 'componentType').direction).toBe('descending');
    expect(apiNames(sortRows(rows, byNameDesc, collator))).toEqual([
      'TestZebraService',
      'Testhelper',
      'TestField__c',
    ]);
    // 親オブジェクトがない 2 行（同じ値）は、種類・API 名の順
    expect(apiNames(sortRows(rows, byParent, collator))).toEqual([
      'Testhelper',
      'TestZebraService',
      'TestField__c',
    ]);
  });

  it('名前は前後の空白を除いた部分一致で、大文字と小文字を区別しない（BR2.3）', () => {
    const rows = loadComponents('components-basic').components;

    expect(apiNames(filterRows(rows, { name: '  HELPER ', type: null }))).toEqual(['Testhelper']);
    expect(filterRows(rows, { name: '   ', type: null })).toHaveLength(3);
  });

  it('種類の選択肢は一覧にある種類だけで、BR2.1 と同じ順（BR2.4）', () => {
    const rows = loadComponents('components-basic').components;

    expect(typeOptions(rows, collator)).toEqual(['Apex Class', 'Custom Field']);
    expect(typeOptions([], collator)).toEqual([]);
  });

  it('名前と種類を同時に使える（BR2.4）', () => {
    const rows = loadComponents('components-basic').components;

    expect(apiNames(filterRows(rows, { name: 'test', type: 'Apex Class' }))).toEqual([
      'Testhelper',
      'TestZebraService',
    ]);
    expect(apiNames(filterRows(rows, { name: 'field', type: 'Custom Field' }))).toEqual([
      'TestField__c',
    ]);
  });

  it('絞り込みで 0 件になると filtered-empty。empty やほかの状態は変えない（BR2.6）', () => {
    const rows = loadComponents('components-basic').components;
    const shown = filterRows(rows, { name: 'nothing-matches', type: null });

    expect(shown).toEqual([]);
    expect(displayState('default', shown.length)).toBe('filtered-empty');
    expect(displayState('partial', shown.length)).toBe('filtered-empty');
    expect(displayState('empty', 0)).toBe('empty');
    expect(displayState('default', 3)).toBe('default');
  });

  it('2000 件で絞り込みと並べ替えができる（NFR7.4）', () => {
    const rows = buildManyComponents().components;

    const sorted = sortRows(rows, { column: 'apiName', direction: 'ascending' }, collator);
    const filtered = filterRows(sorted, { name: 'component00', type: 'Apex Class' });

    expect(sorted).toHaveLength(2000);
    expect(sorted[0]?.apiName).toBe('TestComponent0001');
    expect(sorted[1999]?.apiName).toBe('TestComponent2000');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((row) => row.componentType === 'Apex Class')).toBe(true);
    expect(rows[0]?.apiName).toBe('TestComponent2000');
  });
});
