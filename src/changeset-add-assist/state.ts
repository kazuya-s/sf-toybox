/**
 * 追加支援の状態と、追加の安全策（U4 security-design.md §4〜§6、performance-design.md §5）。
 *
 * - 状態は 1 つの値（phase: idle / adding / result）と、追加を止める理由の集まり（blockReasons）で持つ
 * - 追加ボタンを押せるかどうかは canAdd だけで決める（NFR3.6）
 * - U2 の addComponent を呼ぶのは、このファイルの runAdd の中だけ（NFR3.3。ESLint で確かめる）
 * - 二重の追加は、React の状態とは別の、同期で読み書きする印（addRunning）で止める（NFR3.4）
 * - beforeunload の登録と解除は、画面ではなく runAdd が受け持つ（NFR3.7）
 * - U2 の呼び出しは Result で受け、try/catch でも包む。例外は unexpectedResponse として扱う（NFR5.1）
 * - 失敗はツールの識別子・種類・文言の識別子だけを記録し、名前は渡さない（NFR1.2、BR3.7）
 *
 * 1 つのフレームに 1 つの追加支援を置くので、状態は置くたびに createAddAssistStore で作る。
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

/** U2 の関数が例外を投げたときに、AppError の message に入れる固定の識別子 */
export const UNEXPECTED_EXCEPTION_MESSAGE = 'changesetAddAssist.unexpectedException';

/** やり直しの手段を出さない失敗（ログインし直すか、画面を読み込み直す。BR1.2） */
const NO_RETRY_KINDS: readonly AppErrorKind[] = [
  'sessionExpired',
  'changeSetLocked',
  'permissionDenied',
];

/** 追加ボタンを押せるか（security-design.md §4 の式） */
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

/** U2 の呼び出しを包み、思わぬ例外も Result の失敗（unexpectedResponse）にする（NFR5.1） */
async function callSafely<T>(call: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await call();
  } catch (error) {
    // 元の例外はコンソールにだけ出す。記録（errorLog）は呼び出し側が種類と文言の識別子で行う
    console.error(`[sf-toybox:${ADD_ASSIST_TOOL_ID}]`, UNEXPECTED_EXCEPTION_MESSAGE, error);
    return fail('unexpectedResponse', UNEXPECTED_EXCEPTION_MESSAGE);
  }
}

/** 失敗を「最近のエラー」に記録する。渡すのは識別子・種類・文言の識別子だけ（NFR1.2） */
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

/** 同じところから来た理由を置き換える */
function withReason(reasons: readonly BlockReason[], reason: BlockReason): BlockReason[] {
  return [...withoutSources(reasons, [reason.source]), reason];
}

/** 追加中にページを離れようとしたら、ブラウザの確認を出す（BR3.6） */
function confirmBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // Chrome は returnValue に値があるときに確認を出す（独自の文言は出せない）
  event.returnValue = '';
}

export type AddAssistStoreOptions = {
  changeSetId: string;
  /** 「追加」画面で選ばれている種類の値。読めなければ null（BR1.3） */
  componentType: string | null;
  /** beforeunload と読み込み直しに使う window。テストで差し替える */
  win?: Window;
};

export type AddAssistStore = {
  getState(): AddAssistState;
  subscribe(listener: () => void): () => void;
  /** 名前・追加前の確認・候補の読み込みを、同時に始める（NFR7.5）。2 回目からは何もしない */
  start(): Promise<void>;
  /** 名前と追加前の確認をやり直す。成功したら、その理由だけを外す */
  retryPreconditions(): Promise<void>;
  /** 候補の読み込みをやり直す。成功したら、その理由だけを外す */
  retryCandidates(): Promise<void>;
  /** 候補の選択を付け外しする。追加中と結果のあいだは何もしない（BR3.2、BR3.4） */
  toggleSelection(componentKey: string): void;
  /** 選んだものを名前の順に 1 件ずつ追加する（BR3.1〜BR3.3）。追加ボタンからだけ呼ぶ */
  runAdd(): Promise<void>;
  /** 結果の欄を閉じ、最初の 1 回だけ画面を読み込み直す（BR3.5、NFR3.8） */
  closeResult(): void;
  /** 描画エラーで画面が外れたときの「中止」の印を立てる（security-design.md §6） */
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
  /** 追加の実行中の印。同期で読み書きし、同じ瞬間の 2 回目の呼び出しを止める（NFR3.4） */
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
      // 読み直して候補から消えたものは、選択からも外す
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
    // どれも待たずに始め、結果は届いた順に反映する（NFR7.5）
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

  /** 1 件ずつ順に追加し、失敗か中止の印でそこで止める（NFR3.5、security-design.md §6） */
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
    // 印を立ててから phase を adding にし、最初の addComponent を呼ぶ（NFR3.4）。
    // result は閉じると画面を読み込み直すので、印は下ろさない
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
