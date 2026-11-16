/**
 * Add-assist state and the safeguards around adding (U4 security-design.md §4-§6, performance-design.md §5).
 *
 * - State is a single value (phase: idle / adding / result) plus the set of reasons that block adding (blockReasons)
 * - Whether the Add button is enabled is decided by canAdd alone (NFR3.6)
 * - U2's addComponent is called only inside runAdd in this file (NFR3.3; enforced by ESLint)
 * - Double adds are blocked by a synchronous flag (addRunning) kept outside React state (NFR3.4)
 * - runAdd, not the UI, registers and removes the beforeunload handler (NFR3.7)
 * - U2 calls are received as Result and also wrapped in try/catch; exceptions become unexpectedResponse (NFR5.1)
 * - Failures are logged with only the tool ID, kind and message key; names are never passed (NFR1.2, BR3.7)
 *
 * There is one add assistant per frame, so a new state is created with createAddAssistStore on every mount.
 */
import {
  checkAddPreconditions,
  getChangeSet,
  listAddCandidates,
  type AddCandidate,
} from '../changeset/index';
import { recordError, type ErrorLogKind } from '../errors/error-log';
import type { MessageKey } from '../i18n/message-keys';
import { addComponent } from '../salesforce/index';
import { fail, type AppErrorKind, type Result } from '../shared/result';
import { selectedInNameOrder, sortCandidates } from './filter';
import type { AddAssistState, AddResult, BlockReason, BlockSource, RetryTarget } from './types';

export const ADD_ASSIST_TOOL_ID = 'changeset-add-assist';

/** Fixed ID put in AppError.message when a U2 function throws */
export const UNEXPECTED_EXCEPTION_MESSAGE = 'changesetAddAssist.unexpectedException';

/** Failures that offer no retry (the user must log in again or reload the page; BR1.2) */
const NO_RETRY_KINDS: readonly AppErrorKind[] = [
  'sessionExpired',
  'changeSetLocked',
  'permissionDenied',
];

/** Whether the Add button can be pressed (the formula in security-design.md §4) */
export function canAdd(state: AddAssistState): boolean {
  return (
    state.phase === 'idle' &&
    state.blockReasons.length === 0 &&
    state.changeSetNameLoaded &&
    state.preconditionsPassed &&
    state.candidatesLoaded &&
    state.selection.size > 0
  );
}

/** Wraps a U2 call so even an unexpected exception becomes a Result failure (unexpectedResponse) (NFR5.1) */
async function callSafely<T>(call: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await call();
  } catch (error) {
    // The original exception goes to the console only. The caller logs to errorLog with the kind and message key
    console.error(`[sf-toybox:${ADD_ASSIST_TOOL_ID}]`, UNEXPECTED_EXCEPTION_MESSAGE, error);
    return fail('unexpectedResponse', UNEXPECTED_EXCEPTION_MESSAGE);
  }
}

/** Logs a failure to "Recent errors" with only the ID, kind and message key (NFR1.2) */
function report(kind: ErrorLogKind, messageKey: MessageKey): void {
  void recordError({ toolId: ADD_ASSIST_TOOL_ID, kind, messageKey });
}

function retryFor(kind: AppErrorKind, target: RetryTarget): RetryTarget | null {
  return NO_RETRY_KINDS.includes(kind) ? null : target;
}

function withoutSources(
  reasons: readonly BlockReason[],
  sources: readonly BlockSource[],
): BlockReason[] {
  return reasons.filter((reason) => !sources.includes(reason.source));
}

/** Replaces the reason that came from the same source */
function withReason(reasons: readonly BlockReason[], reason: BlockReason): BlockReason[] {
  return [...withoutSources(reasons, [reason.source]), reason];
}

/** Shows the browser's leave-page confirmation while adding (BR3.6) */
function confirmBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // Chrome shows the confirmation when returnValue is set (custom text cannot be shown)
  event.returnValue = '';
}

export type AddAssistStoreOptions = {
  changeSetId: string;
  /** Value of the type selected on the "Add" page; null if it cannot be read (BR1.3) */
  componentType: string | null;
  /** window used for beforeunload and reload. Replaced in tests */
  win?: Window;
};

export type AddAssistStore = {
  getState(): AddAssistState;
  subscribe(listener: () => void): () => void;
  /** Starts loading the name, the pre-add check and the candidates at the same time (NFR7.5). No-op after the first call */
  start(): Promise<void>;
  /** Retries the name and the pre-add check. On success, clears only that reason */
  retryPreconditions(): Promise<void>;
  /** Retries loading the candidates. On success, clears only that reason */
  retryCandidates(): Promise<void>;
  /** Toggles a candidate's selection. No-op while adding and while the result is shown (BR3.2, BR3.4) */
  toggleSelection(componentKey: string): void;
  /** Adds the selected items one by one in name order (BR3.1-BR3.3). Called only from the Add button */
  runAdd(): Promise<void>;
  /** Closes the result panel and reloads the page, only the first time (BR3.5, NFR3.8) */
  closeResult(): void;
  /** Sets the "abort" flag when a render error unmounts the UI (security-design.md §6) */
  abort(): void;
  isAbortRequested(): boolean;
};

function initialState(): AddAssistState {
  return {
    phase: 'idle',
    blockReasons: [],
    changeSetName: null,
    changeSetNameLoaded: false,
    preconditionsPassed: false,
    preconditionsLoading: true,
    candidatesStatus: 'loading',
    candidatesLoaded: false,
    candidates: [],
    selection: new Set(),
    progress: null,
    result: null,
  };
}

export function createAddAssistStore(options: AddAssistStoreOptions): AddAssistStore {
  const { changeSetId, componentType } = options;
  const win = options.win ?? window;
  let state = initialState();
  const listeners = new Set<() => void>();
  let started = false;
  /** In-progress flag for adding. Read and written synchronously to stop a second call in the same instant (NFR3.4) */
  let addRunning = false;
  let abortRequested = false;
  let closed = false;

  function update(change: (current: AddAssistState) => Partial<AddAssistState>): void {
    state = { ...state, ...change(state) };
    for (const listener of listeners) listener();
  }

  async function loadChangeSet(): Promise<void> {
    const loaded = await callSafely(() => getChangeSet({ changeSetId }));
    if (loaded.ok) {
      update((current) => ({
        changeSetName: loaded.value.name,
        changeSetNameLoaded: true,
        blockReasons: withoutSources(current.blockReasons, ['changeSet']),
      }));
      return;
    }
    const { kind } = loaded.error;
    update((current) => ({
      changeSetNameLoaded: false,
      blockReasons: withReason(current.blockReasons, {
        source: 'changeSet',
        kind,
        retry: retryFor(kind, 'preconditions'),
      }),
    }));
    report(kind, 'errorLog.addAssistChangeSetFailed');
  }

  async function loadPreconditionCheck(): Promise<void> {
    const checked = await callSafely(() => checkAddPreconditions({ changeSetId }));
    if (checked.ok) {
      update((current) => ({
        preconditionsPassed: true,
        blockReasons: withoutSources(current.blockReasons, ['preconditions']),
      }));
      return;
    }
    const { kind } = checked.error;
    update((current) => ({
      preconditionsPassed: false,
      blockReasons: withReason(current.blockReasons, {
        source: 'preconditions',
        kind,
        retry: retryFor(kind, 'preconditions'),
      }),
    }));
    report(kind, 'errorLog.addAssistPreconditionsFailed');
  }

  async function loadNameAndPreconditions(): Promise<void> {
    update(() => ({ preconditionsLoading: true }));
    await Promise.all([loadChangeSet(), loadPreconditionCheck()]);
    update(() => ({ preconditionsLoading: false }));
  }

  function applyCandidates(candidates: AddCandidate[], complete: boolean): void {
    const sorted = sortCandidates(candidates);
    const keys = new Set(sorted.map((candidate) => candidate.componentKey));
    update((current) => ({
      candidates: sorted,
      candidatesLoaded: true,
      candidatesStatus: complete ? 'loaded' : 'partial',
      // Items that disappeared from the reloaded candidates are also removed from the selection
      selection: new Set([...current.selection].filter((key) => keys.has(key))),
      blockReasons: withoutSources(current.blockReasons, ['candidates']),
    }));
    if (!complete) report('unexpected', 'errorLog.addAssistCandidatesPartial');
  }

  async function loadCandidates(): Promise<void> {
    if (componentType === null) {
      update((current) => ({
        candidatesStatus: 'typeUnreadable',
        blockReasons: withReason(current.blockReasons, {
          source: 'componentType',
          kind: 'unexpectedResponse',
          retry: null,
        }),
      }));
      report('unexpectedResponse', 'errorLog.addAssistTypeUnreadable');
      return;
    }
    update(() => ({ candidatesStatus: 'loading' }));
    const loaded = await callSafely(() => listAddCandidates({ changeSetId, componentType }));
    if (loaded.ok) {
      applyCandidates(loaded.value.candidates, loaded.value.complete);
      return;
    }
    const { kind } = loaded.error;
    update((current) => ({
      candidates: [],
      candidatesLoaded: false,
      candidatesStatus: 'error',
      blockReasons: withReason(current.blockReasons, {
        source: 'candidates',
        kind,
        retry: kind === 'sessionExpired' ? null : 'candidates',
      }),
    }));
    report(kind, 'errorLog.addAssistCandidatesFailed');
  }

  async function start(): Promise<void> {
    if (started) return;
    started = true;
    // Start all without waiting and apply results in the order they arrive (NFR7.5)
    await Promise.all([loadNameAndPreconditions(), loadCandidates()]);
  }

  async function retryPreconditions(): Promise<void> {
    if (state.phase !== 'idle' || state.preconditionsLoading) return;
    await loadNameAndPreconditions();
  }

  async function retryCandidates(): Promise<void> {
    if (state.phase !== 'idle' || state.candidatesStatus === 'loading') return;
    await loadCandidates();
  }

  function toggleSelection(componentKey: string): void {
    if (state.phase !== 'idle') return;
    update((current) => {
      const selection = new Set(current.selection);
      if (selection.has(componentKey)) selection.delete(componentKey);
      else selection.add(componentKey);
      return { selection };
    });
  }

  /** Adds one at a time in order, stopping at a failure or the abort flag (NFR3.5, security-design.md §6) */
  async function addInOrder(type: string, targets: AddCandidate[], result: AddResult) {
    for (const [index, candidate] of targets.entries()) {
      if (abortRequested) {
        result.aborted = true;
        result.untried.push(...targets.slice(index));
        return;
      }
      const added = await callSafely(() =>
        addComponent({ changeSetId, componentType: type, componentKey: candidate.componentKey }),
      );
      if (!added.ok) {
        result.failed.push({ candidate, error: added.error });
        result.untried.push(...targets.slice(index + 1));
        report(added.error.kind, 'errorLog.addAssistAddFailed');
        return;
      }
      result.succeeded.push(candidate);
      update(() => ({ progress: { done: index + 1, total: targets.length } }));
    }
  }

  async function runAdd(): Promise<void> {
    if (addRunning || componentType === null || !canAdd(state)) return;
    // Set the flag, then phase = adding, then call the first addComponent (NFR3.4).
    // Closing the result reloads the page, so the flag is never cleared
    addRunning = true;
    const targets = selectedInNameOrder(state.candidates, state.selection);
    const result: AddResult = { succeeded: [], failed: [], untried: [], aborted: false };
    update(() => ({ phase: 'adding', progress: { done: 0, total: targets.length } }));
    win.addEventListener('beforeunload', confirmBeforeUnload);
    try {
      await addInOrder(componentType, targets, result);
    } finally {
      win.removeEventListener('beforeunload', confirmBeforeUnload);
      if (result.aborted) report('unexpected', 'errorLog.addAssistAborted');
      update(() => ({ phase: 'result', result }));
    }
  }

  function closeResult(): void {
    if (closed || state.phase !== 'result') return;
    closed = true;
    win.location.reload();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    retryPreconditions,
    retryCandidates,
    toggleSelection,
    runAdd,
    closeResult,
    abort() {
      abortRequested = true;
    },
    isAbortRequested: () => abortRequested,
  };
}
