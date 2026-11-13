/**
 * 候補の並べ替えと絞り込み（U4 functional-design/rules.md の BR1.4、BR2.1〜BR2.5、NFR7.4）。
 * 読み込んだ候補の中だけで計算し、U2 を呼び直さない。どれも入力を変えない純粋な関数。
 */
import type { AddCandidate } from '../changeset/index';
import type { CandidateFilter } from './types';

/** 名前の順（大文字と小文字を区別しない）。同じ名前なら componentKey の順にして、並びを決まったものにする */
export function compareByName(a: AddCandidate, b: AddCandidate): number {
  const byName = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return a.componentKey < b.componentKey ? -1 : a.componentKey > b.componentKey ? 1 : 0;
}

/** 候補を名前の順に並べた新しい配列を返す（BR1.4） */
export function sortCandidates(candidates: readonly AddCandidate[]): AddCandidate[] {
  return [...candidates].sort(compareByName);
}

/**
 * 親オブジェクトの選択肢（「すべて」は含めない）。候補にあるものを名前の順に重ねずに並べる。
 * 親オブジェクトを持つ候補がなければ空の配列で、そのとき選択欄は出さない（BR2.2）。
 */
export function parentOptions(candidates: readonly AddCandidate[]): string[] {
  const parents = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.parentObject) parents.add(candidate.parentObject);
  }
  return [...parents].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/** 検索の文字を比べやすい形にする（前後の空白を除き、小文字にする） */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesQuery(candidate: AddCandidate, normalized: string): boolean {
  if (normalized === '') return true;
  if (candidate.name.toLowerCase().includes(normalized)) return true;
  return candidate.parentObject?.toLowerCase().includes(normalized) ?? false;
}

/**
 * 名前か親オブジェクトに検索の文字が含まれ（BR2.1）、選んだ親オブジェクトに当たる（BR2.2）候補。
 * 並びは入力のまま。
 */
export function filterCandidates(
  candidates: readonly AddCandidate[],
  filter: CandidateFilter,
): AddCandidate[] {
  const normalized = normalizeQuery(filter.query);
  return candidates.filter(
    (candidate) =>
      (filter.parent === null || candidate.parentObject === filter.parent) &&
      matchesQuery(candidate, normalized),
  );
}

/** 選択の件数と、そのうち絞り込みで見えないものの件数（BR2.3） */
export function selectionCounts(
  selection: ReadonlySet<string>,
  visible: readonly AddCandidate[],
): { selected: number; hidden: number } {
  const visibleSelected = visible.filter((candidate) =>
    selection.has(candidate.componentKey),
  ).length;
  return { selected: selection.size, hidden: selection.size - visibleSelected };
}

/** 選択に入っている候補を、名前の順に返す（BR3.1、NFR3.3）。候補にない componentKey は含めない */
export function selectedInNameOrder(
  candidates: readonly AddCandidate[],
  selection: ReadonlySet<string>,
): AddCandidate[] {
  return sortCandidates(candidates.filter((candidate) => selection.has(candidate.componentKey)));
}
