/**
 * 候補の並べ替えと絞り込み（src/changeset-add-assist/filter.ts、BR1.4、BR2.1〜BR2.4、NFR7.4）。
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

describe('候補の絞り込み（filter）', () => {
  it('名前の部分一致で、大文字と小文字を区別せず、前後の空白を除く（BR2.1）。候補は名前の順', () => {
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

  it('検索の文字は親オブジェクトにも当たる（BR2.1）', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));

    expect(names(filterCandidates(candidates, { query: 'invoice', parent: null }))).toEqual([
      'TestAmount__c',
      'TestNote__c',
    ]);
  });

  it('親オブジェクトの選択肢は候補にあるものを名前の順に重ねず並べ、親を持つ候補がなければ空（BR2.2）', () => {
    expect(parentOptions(candidatesFixture('basic'))).toEqual(['TestInvoice__c', 'TestOrder__c']);
    expect(parentOptions(candidatesFixture('noParent'))).toEqual([]);
  });

  it('名前と親オブジェクトを同時に使える（BR2.2）', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));

    expect(names(filterCandidates(candidates, { query: 'test', parent: 'TestOrder__c' }))).toEqual([
      'TestPriority__c',
      'TestStatus__c',
    ]);
    expect(
      names(filterCandidates(candidates, { query: 'amount', parent: 'TestOrder__c' })),
    ).toEqual([]);
  });

  it('選択は絞り込みで外れず、見えない件数を数える。追加の順は名前の順（BR2.3、BR3.1）', () => {
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

  it('一致が 0 件なら空の一覧で、選択の件数はそのまま（BR2.4）', () => {
    const candidates = sortCandidates(candidatesFixture('basic'));
    const visible = filterCandidates(candidates, { query: 'no-such-component', parent: null });

    expect(visible).toEqual([]);
    expect(selectionCounts(new Set(['00N000000000001']), visible)).toEqual({
      selected: 1,
      hidden: 1,
    });
  });

  it('読み直さない: 2000 件の候補の中で、検索と親オブジェクトの絞り込みができる（NFR7.4）', () => {
    const candidates = sortCandidates(generatedCandidates());

    expect(candidates).toHaveLength(2000);
    expect(names(filterCandidates(candidates, { query: 'field001999', parent: null }))).toEqual([
      'TestField001999__c',
    ]);
    expect(filterCandidates(candidates, { query: '', parent: 'TestOrder__c' }).length).toBe(667);
    expect(parentOptions(candidates)).toEqual(['TestAccountLike__c', 'TestOrder__c']);
  });
});
