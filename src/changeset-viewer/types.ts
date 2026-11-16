/**
 * Types for the U3 screen (functional-spec.md "State transitions", frontend-components.md).
 * U3 has no data of its own; it displays C4's ChangeSetComponents.
 */
import type { ChangeSetComponent, ChangeSetComponents } from '../changeset';
import type { Result } from '../shared/result';

/** Screen state (9 kinds) */
export type ViewerState =
  | 'disabled'
  | 'wrong-page'
  | 'loading'
  | 'default'
  | 'empty'
  | 'partial'
  | 'session-expired'
  | 'error'
  | 'filtered-empty';

/** State derived from the list result (BR1.4) */
export type ResultState = Extract<
  ViewerState,
  'default' | 'empty' | 'partial' | 'session-expired' | 'error'
>;

/** Sort column */
export type SortColumn = 'componentType' | 'apiName' | 'parentObject';

/** Sort direction (same values as aria-sort) */
export type SortDirection = 'ascending' | 'descending';

export type SortState = { column: SortColumn; direction: SortDirection };

/** Filter conditions. type null means "All" */
export type RowFilter = { name: string; type: string | null };

/** C4 response */
export type ComponentsResult = Result<ChangeSetComponents>;

export type { ChangeSetComponent, ChangeSetComponents };
