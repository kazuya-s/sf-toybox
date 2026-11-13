/**
 * U3 の画面の型（functional-spec.md「状態の移り変わり」、frontend-components.md）。
 * U3 は自分のデータを持たず、表示には C4 の ChangeSetComponents を使う。
 */
import type { ChangeSetComponent, ChangeSetComponents } from '../changeset';
import type { Result } from '../shared/result';

/** 画面の状態（9 種類） */
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

/** 一覧の結果から決まる状態（BR1.4） */
export type ResultState = Extract<
  ViewerState,
  'default' | 'empty' | 'partial' | 'session-expired' | 'error'
>;

/** 並べ替えの列 */
export type SortColumn = 'componentType' | 'apiName' | 'parentObject';

/** 並べ替えの向き（aria-sort の値と同じ） */
export type SortDirection = 'ascending' | 'descending';

export type SortState = { column: SortColumn; direction: SortDirection };

/** 絞り込みの条件。type が null なら「すべて」 */
export type RowFilter = { name: string; type: string | null };

/** C4 の返事 */
export type ComponentsResult = Result<ChangeSetComponents>;

export type { ChangeSetComponent, ChangeSetComponents };
