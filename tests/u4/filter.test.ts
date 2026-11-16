/**
 * Sorting and filtering candidates (src/changeset-add-assist/filter.ts, BR1.4, BR2.1-BR2.4, NFR7.4).
 */
import { describe, expect, it } from 'vitest';
import {
  filterCandidates,
  parentOptions,
  selectedInNameOrder,
  selectionCounts,
  sortCandidates,
} from '../../src/changeset-add-assist/filter';
import { candidatesFixture, generatedCandidates } from './helpers/fixtures';

const names = (list: { name: string }[]) => list.map((candidate) => candidate.name);

describe('Candidate filtering (filter)', () => {
  it('partial name match, case-insensitive and trimmed (BR2.1); candidates are in name order', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));

    expect(names(candidates)).toEqual([
      'TestAmount__c',
      'TestCode__c',
      'TestNote__c',
      'TestPriority__c',
      'TestStatus__c',
    ]);
    expect(names(filterCandidates(candidates, { query: '  sTaTuS ', parent: null }))).toEqual([
      'TestStatus__c',
    ]);
    expect(filterCandidates(candidates, { query: '   ', parent: null })).toHaveLength(5);
  });

  it('the search text also matches parent objects (BR2.1)', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));

    expect(names(filterCandidates(candidates, { query: 'invoice', parent: null }))).toEqual([
      'TestAmount__c',
      'TestNote__c',
    ]);
  });

  it('parent options are the candidates parents, deduplicated in name order; empty when none has a parent (BR2.2)', () => {
    expect(parentOptions(candidatesFixture('basic'))).toEqual(['TestInvoice__c', 'TestOrder__c']);
    expect(parentOptions(candidatesFixture('noParent'))).toEqual([]);
  });

  it('name and parent filters work together (BR2.2)', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));

    expect(names(filterCandidates(candidates, { query: 'test', parent: 'TestOrder__c' }))).toEqual([
      'TestPriority__c',
      'TestStatus__c',
    ]);
    expect(
      names(filterCandidates(candidates, { query: 'amount', parent: 'TestOrder__c' })),
    ).toEqual([]);
  });

  it('filtering never drops selections and counts hidden ones; add order is name order (BR2.3, BR3.1)', () => {
    const candidates = candidatesFixture('basic');
    const selection = new Set(['00N000000000003', '00N000000000001', '00N000000000002']);
    const visible = filterCandidates(sortCandidates(candidates), { query: 'status', parent: null });

    expect(selectionCounts(selection, visible)).toEqual({ selected: 3, hidden: 2 });
    expect(selection.size).toBe(3);
    expect(names(selectedInNameOrder(candidates, selection))).toEqual([
      'TestAmount__c',
      'TestCode__c',
      'TestStatus__c',
    ]);
  });

  it('zero matches gives an empty list and keeps the selection count (BR2.4)', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));
    const visible = filterCandidates(candidates, { query: 'no-such-component', parent: null });

    expect(visible).toEqual([]);
    expect(selectionCounts(new Set(['00N000000000001']), visible)).toEqual({
      selected: 1,
      hidden: 1,
    });
  });

  it('no re-request: search and parent filtering work over 2000 candidates (NFR7.4)', () => {
    const candidates = sortCandidates(generatedCandidates());

    expect(candidates).toHaveLength(2000);
    expect(names(filterCandidates(candidates, { query: 'field001999', parent: null }))).toEqual([
      'TestField001999__c',
    ]);
    expect(filterCandidates(candidates, { query: '', parent: 'TestOrder__c' }).length).toBe(667);
    expect(parentOptions(candidates)).toEqual(['TestAccountLike__c', 'TestOrder__c']);
  });
});
