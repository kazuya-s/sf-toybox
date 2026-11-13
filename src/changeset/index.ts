/**
 * ChangeSet の入口（contract-summary.md C4 と C5 の ChangeSetApi）。
 * U3・U4 はこのファイルと src/salesforce/index.ts だけを読み込む。
 */
export {
  checkAddPreconditions,
  getChangeSet,
  listAddCandidates,
  listComponents,
} from './changeset';
export { findCandidateTable, readSelectedComponentType } from './page-type';
export type {
  AddCandidate,
  AddCandidates,
  AddRequest,
  ChangeSetComponent,
  ChangeSetComponents,
  ChangeSetStatus,
  ListComponentsRequest,
  LoadProgress,
  OutboundChangeSet,
} from './types';
