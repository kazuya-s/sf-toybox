/**
 * 状態の決め方と、絞り込み・並べ替え（rules.md BR1.4、BR2.1〜BR2.6、performance-design.md §4）。
 * どれも純粋な関数で、ページ側に頼み直さずにツールバーの画面の中だけで計算する（NFR7.4）。
 */
import type {
  ChangeSetComponent,
  ComponentsResult,
  ResultState,
  RowFilter,
  SortColumn,
  SortState,
  ViewerState,
} from './types';

/** 最初の並び順: 種類の昇順（同じ種類の中は API 名。BR2.1） */
export const INITIAL_SORT: SortState = { column: 'componentType', direction: 'ascending' };

/** 絞り込みなし */
export const NO_FILTER: RowFilter = { name: '', type: null };

/** 返事から状態を決める（BR1.4） */
export function stateFromResult(result: ComponentsResult): ResultState {
  if (result.ok) {
    if (!result.value.complete) return 'partial';
    return result.value.components.length === 0 ? 'empty' : 'default';
  }
  return result.error.kind === 'sessionExpired' ? 'session-expired' : 'error';
}

/** 絞り込みのあとの行が 0 件なら filtered-empty にする（BR2.6） */
export function displayState(base: ViewerState, shownCount: number): ViewerState {
  if ((base === 'default' || base === 'partial') && shownCount === 0) return 'filtered-empty';
  return base;
}

/** 画面の言語に合わせ、大文字と小文字を区別しない比べ方を作る（1 つ作って使い回す） */
export function createCollator(locale: string): Intl.Collator {
  return new Intl.Collator(locale, { sensitivity: 'base', numeric: false });
}

/** 列見出しを押したあとの並べ替え（BR2.2） */
export function nextSort(current: SortState, column: SortColumn): SortState {
  if (current.column !== column) return { column, direction: 'ascending' };
  return { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

function valueOf(row: ChangeSetComponent, column: SortColumn): string {
  return row[column] ?? '';
}

/** 同じ値の行は、種類、API 名の順で並べる（BR2.2） */
function compareTieBreak(a: ChangeSetComponent, b: ChangeSetComponent, collator: Intl.Collator) {
  return (
    collator.compare(a.componentType, b.componentType) || collator.compare(a.apiName, b.apiName)
  );
}

/** 並べ替えた新しい配列を返す（元の配列は変えない） */
export function sortRows(
  rows: readonly ChangeSetComponent[],
  sort: SortState,
  collator: Intl.Collator,
): ChangeSetComponent[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      sign * collator.compare(valueOf(a, sort.column), valueOf(b, sort.column)) ||
      compareTieBreak(a, b, collator),
  );
}

/** 名前（API 名の一部、大文字と小文字を区別しない。BR2.3）と種類（BR2.4）で絞り込む */
export function filterRows(
  rows: readonly ChangeSetComponent[],
  filter: RowFilter,
): ChangeSetComponent[] {
  const needle = filter.name.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filter.type === null || row.componentType === filter.type) &&
      (needle === '' || row.apiName.toLowerCase().includes(needle)),
  );
}

/** 種類の選択肢: 一覧にある種類だけを、BR2.1 と同じ順で（BR2.4） */
export function typeOptions(
  rows: readonly ChangeSetComponent[],
  collator: Intl.Collator,
): string[] {
  return [...new Set(rows.map((row) => row.componentType))].sort((a, b) => collator.compare(a, b));
}

/** 絞り込んでいるか */
export function isFiltering(filter: RowFilter): boolean {
  return filter.name.trim() !== '' || filter.type !== null;
}
