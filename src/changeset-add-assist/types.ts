/**
 * Shape of the add-assist state (U4 security-design.md §4, functional-spec.md "State transitions").
 * U4 stores nothing. Candidates and results live only in that frame's memory.
 */
import type { AddCandidate } from '../changeset/index';
import type { AppError, AppErrorKind } from '../shared/result';

/** Add phase. Closing the result reloads the page, so it never returns to idle */
export type AddAssistPhase = 'idle' | 'adding' | 'result';

/** Target of "Try again" */
export type RetryTarget = 'preconditions' | 'candidates';

/** Where a blocking reason came from */
export type BlockSource = 'changeSet' | 'preconditions' | 'componentType' | 'candidates';

/** Reason that blocks adding (BR1.2, NFR3.6). When retry is null, no retry is offered */
export type BlockReason = {
  source: BlockSource;
  kind: AppErrorKind;
  retry: RetryTarget | null;
};

/** Candidate loading status (BR1.3, BR1.4) */
export type CandidatesStatus = 'loading' | 'loaded' | 'partial' | 'error' | 'typeUnreadable';

/** One item that could not be added, with its reason */
export type FailedAdd = { candidate: AddCandidate; error: AppError };

/** Add result (BR3.4). aborted is true when a render error stopped it midway */
export type AddResult = {
  succeeded: AddCandidate[];
  failed: FailedAdd[];
  untried: AddCandidate[];
  aborted: boolean;
};

/** Add progress (NFR7.3). done is the number of finished items */
export type AddProgress = { done: number; total: number };

export type AddAssistState = {
  phase: AddAssistPhase;
  blockReasons: BlockReason[];
  /** Name of the target change set; null until loaded */
  changeSetName: string | null;
  changeSetNameLoaded: boolean;
  preconditionsPassed: boolean;
  /** true while the name and the pre-add check are loading */
  preconditionsLoading: boolean;
  candidatesStatus: CandidatesStatus;
  /** true once listAddCandidates returns ok (also true when complete is false; BR1.4) */
  candidatesLoaded: boolean;
  /** Candidates sorted by name */
  candidates: AddCandidate[];
  /** componentKeys of the selected candidates. Filtering never removes them (BR2.3) */
  selection: ReadonlySet<string>;
  progress: AddProgress | null;
  result: AddResult | null;
};

/** Filter conditions (BR2.1, BR2.2). parent null means "All" */
export type CandidateFilter = { query: string; parent: string | null };
