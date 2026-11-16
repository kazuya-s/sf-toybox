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

describe('Deciding state, filtering and sorting (view-state)', () => {
  it('the result decides empty, default, partial, session-expired or error (BR1.4)', () => {
    const basic = loadComponents('components-basic');

    expect(stateFromResult(ok(basic))).toBe('default');
    expect(stateFromResult(ok({ ...basic, components: [] }))).toBe('empty');
    expect(stateFromResult(ok({ ...basic, complete: false, failedPages: 1 }))).toBe('partial');
    expect(stateFromResult(fail('sessionExpired', 'login'))).toBe('session-expired');
    expect(stateFromResult(fail('timeout', 'slow'))).toBe('error');
    expect(stateFromResult(fail('unexpectedResponse', 'x'))).toBe('error');
  });

  it('initial order is type, then API name, case-insensitive (BR2.1)', () => {
    const rows = sortRows(loadComponents('components-basic').components, INITIAL_SORT, collator);

    // In code-point order TestZebraService (Z) would come before Testhelper (h)
    expect(rows.map((row) => [row.componentType, row.apiName])).toEqual([
      ['Apex Class', 'Testhelper'],
      ['Apex Class', 'TestZebraService'],
      ['Custom Field', 'TestField__c'],
    ]);
  });

  it('clicking the same column twice sorts descending, another column ascending; ties by type then API name (BR2.2)', () => {
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
    // Two rows without a parent object (equal values) are ordered by type, then API name
    expect(apiNames(sortRows(rows, byParent, collator))).toEqual([
      'Testhelper',
      'TestZebraService',
      'TestField__c',
    ]);
  });

  it('name filter is a trimmed, case-insensitive partial match (BR2.3)', () => {
    const rows = loadComponents('components-basic').components;

    expect(apiNames(filterRows(rows, { name: '  HELPER ', type: null }))).toEqual(['Testhelper']);
    expect(filterRows(rows, { name: '   ', type: null })).toHaveLength(3);
  });

  it('type options are only the types in the list, in the BR2.1 order (BR2.4)', () => {
    const rows = loadComponents('components-basic').components;

    expect(typeOptions(rows, collator)).toEqual(['Apex Class', 'Custom Field']);
    expect(typeOptions([], collator)).toEqual([]);
  });

  it('name and type filters work together (BR2.4)', () => {
    const rows = loadComponents('components-basic').components;

    expect(apiNames(filterRows(rows, { name: 'test', type: 'Apex Class' }))).toEqual([
      'Testhelper',
      'TestZebraService',
    ]);
    expect(apiNames(filterRows(rows, { name: 'field', type: 'Custom Field' }))).toEqual([
      'TestField__c',
    ]);
  });

  it('zero filtered rows is filtered-empty; empty and other states are unchanged (BR2.6)', () => {
    const rows = loadComponents('components-basic').components;
    const shown = filterRows(rows, { name: 'nothing-matches', type: null });

    expect(shown).toEqual([]);
    expect(displayState('default', shown.length)).toBe('filtered-empty');
    expect(displayState('partial', shown.length)).toBe('filtered-empty');
    expect(displayState('empty', 0)).toBe('empty');
    expect(displayState('default', 3)).toBe('default');
  });

  it('filters and sorts 2000 items (NFR7.4)', () => {
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
