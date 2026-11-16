/**
 * Deciding the state, filtering and sorting (rules.md BR1.4, BR2.1-BR2.6, performance-design.md §4).
 * All pure functions, computed only inside the popup without re-requesting the page (NFR7.4).
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

/** Initial order: type ascending (API name within the same type; BR2.1) */
export const INITIAL_SORT: SortState = { column: 'componentType', direction: 'ascending' };

/** No filter */
export const NO_FILTER: RowFilter = { name: '', type: null };

/** Decides the state from the response (BR1.4) */
export function stateFromResult(result: ComponentsResult): ResultState {
  if (result.ok) {
    if (!result.value.complete) return 'partial';
    return result.value.components.length === 0 ? 'empty' : 'default';
  }
  return result.error.kind === 'sessionExpired' ? 'session-expired' : 'error';
}

/** Becomes filtered-empty when no rows remain after filtering (BR2.6) */
export function displayState(base: ViewerState, shownCount: number): ViewerState {
  if ((base === 'default' || base === 'partial') && shownCount === 0) return 'filtered-empty';
  return base;
}

/** Creates a case-insensitive comparer for the UI language (create once and reuse) */
export function createCollator(locale: string): Intl.Collator {
  return new Intl.Collator(locale, { sensitivity: 'base', numeric: false });
}

/** Sort after a column header is clicked (BR2.2) */
export function nextSort(current: SortState, column: SortColumn): SortState {
  if (current.column !== column) return { column, direction: 'ascending' };
  return { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

function valueOf(row: ChangeSetComponent, column: SortColumn): string {
  return row[column] ?? '';
}

/** Rows with equal values are ordered by type, then API name (BR2.2) */
function compareTieBreak(a: ChangeSetComponent, b: ChangeSetComponent, collator: Intl.Collator) {
  return (
    collator.compare(a.componentType, b.componentType) || collator.compare(a.apiName, b.apiName)
  );
}

/** Returns a new sorted array (the original is not changed) */
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

/** Filters by name (part of the API name, case-insensitive; BR2.3) and type (BR2.4) */
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

/** Type options: only types in the list, in the same order as BR2.1 (BR2.4) */
export function typeOptions(
  rows: readonly ChangeSetComponent[],
  collator: Intl.Collator,
): string[] {
  return [...new Set(rows.map((row) => row.componentType))].sort((a, b) => collator.compare(a, b));
}

/** Whether a filter is applied */
export function isFiltering(filter: RowFilter): boolean {
  return filter.name.trim() !== '' || filter.type !== null;
}
