/**
 * 追加支援の状態の形（U4 security-design.md §4、functional-spec.md「状態の移り変わり」）。
 * U4 は自分のデータを保存しない。候補と結果は、そのフレームのメモリの中だけに持つ。
 */
import type { AddCandidate } from '../changeset/index';
import type { AppError, AppErrorKind } from '../shared/result';

/** 追加の段階。result は閉じると画面を読み込み直すので、idle には戻らない */
export type AddAssistPhase = 'idle' | 'adding' | 'result';

/** 「もう一度試す」の対象 */
export type RetryTarget = 'preconditions' | 'candidates';

/** 追加を止める理由がどこから来たか */
export type BlockSource = 'changeSet' | 'preconditions' | 'componentType' | 'candidates';

/** 追加を止める理由（BR1.2、NFR3.6）。retry が null なら、やり直しの手段は出さない */
export type BlockReason = {
  source: BlockSource;
  kind: AppErrorKind;
  retry: RetryTarget | null;
};

/** 候補の読み込みの様子（BR1.3、BR1.4） */
export type CandidatesStatus = 'loading' | 'loaded' | 'partial' | 'error' | 'typeUnreadable';

/** 追加できなかった 1 件と、その理由 */
export type FailedAdd = { candidate: AddCandidate; error: AppError };

/** 追加の結果（BR3.4）。aborted は、描画エラーで途中で止めたとき true */
export type AddResult = {
  succeeded: AddCandidate[];
  failed: FailedAdd[];
  untried: AddCandidate[];
  aborted: boolean;
};

/** 追加の進み具合（NFR7.3）。done は終わった件数 */
export type AddProgress = { done: number; total: number };

export type AddAssistState = {
  phase: AddAssistPhase;
  blockReasons: BlockReason[];
  /** 追加先の変更セットの名前。取れるまでは null */
  changeSetName: string | null;
  changeSetNameLoaded: boolean;
  preconditionsPassed: boolean;
  /** 名前と追加前の確認を読み込んでいるあいだ true */
  preconditionsLoading: boolean;
  candidatesStatus: CandidatesStatus;
  /** listAddCandidates が ok を返したら true（complete: false でも true。BR1.4） */
  candidatesLoaded: boolean;
  /** 名前の順に並べた候補 */
  candidates: AddCandidate[];
  /** 選んだ候補の componentKey。絞り込みでは外さない（BR2.3） */
  selection: ReadonlySet<string>;
  progress: AddProgress | null;
  result: AddResult | null;
};

/** 絞り込みの条件（BR2.1、BR2.2）。parent が null なら「すべて」 */
export type CandidateFilter = { query: string; parent: string | null };
