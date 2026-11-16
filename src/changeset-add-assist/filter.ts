/**
 * Sorting and filtering of candidates (U4 functional-design/rules.md BR1.4, BR2.1-BR2.5, NFR7.4).
 * Computed only over the loaded candidates; never calls U2 again. All are pure functions that do not mutate input.
 */
import type { AddCandidate } from '../changeset/index';
import type { CandidateFilter } from './types';

/** Name order (case-insensitive). Ties are ordered by componentKey so the order is deterministic */
export function compareByName(a: AddCandidate, b: AddCandidate): number {
  const byName = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return a.componentKey < b.componentKey ? -1 : a.componentKey > b.componentKey ? 1 : 0;
}

/** Returns a new array of candidates sorted by name (BR1.4) */
export function sortCandidates(candidates: readonly AddCandidate[]): AddCandidate[] {
  return [...candidates].sort(compareByName);
}

/**
 * Parent object options ("All" not included): the parents present in the candidates, deduplicated, in name order.
 * Empty when no candidate has a parent object; the select is then hidden (BR2.2).
 */
export function parentOptions(candidates: readonly AddCandidate[]): string[] {
  const parents = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.parentObject) parents.add(candidate.parentObject);
  }
  return [...parents].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/** Normalizes search text for comparison (trimmed, lower-cased) */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesQuery(candidate: AddCandidate, normalized: string): boolean {
  if (normalized === '') return true;
  if (candidate.name.toLowerCase().includes(normalized)) return true;
  return candidate.parentObject?.toLowerCase().includes(normalized) ?? false;
}

/**
 * Candidates whose name or parent object contains the search text (BR2.1) and that match the selected parent (BR2.2).
 * Keeps the input order.
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

/** Number of selected items and how many of them the filter hides (BR2.3) */
export function selectionCounts(
  selection: ReadonlySet<string>,
  visible: readonly AddCandidate[],
): { selected: number; hidden: number } {
  const visibleSelected = visible.filter((candidate) =>
    selection.has(candidate.componentKey),
  ).length;
  return { selected: selection.size, hidden: selection.size - visibleSelected };
}

/** Returns the selected candidates in name order (BR3.1, NFR3.3). componentKeys not among the candidates are skipped */
export function selectedInNameOrder(
  candidates: readonly AddCandidate[],
  selection: ReadonlySet<string>,
): AddCandidate[] {
  return sortCandidates(candidates.filter((candidate) => selection.has(candidate.componentKey)));
}
