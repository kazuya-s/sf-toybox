/**
 * C4・C5 の形（inception/contract-design/contract-summary.md、functional-design/entities.md）。
 * U3・U4 はこの形で受け取る。
 */
import type { LoadProgress } from '../salesforce/types';

export type ChangeSetStatus = 'open' | 'uploaded' | 'unknown';

export type OutboundChangeSet = {
  changeSetId: string;
  name: string;
  status: ChangeSetStatus;
};

export type ChangeSetComponent = {
  /** 種類（画面の表示名） */
  componentType: string;
  apiName: string;
  /** 画面で空のときは null（BR2.5） */
  parentObject: string | null;
};

export type ChangeSetComponents = {
  changeSet: OutboundChangeSet;
  components: ChangeSetComponent[];
  /** false のとき、一部のページを読み込めなかった（BR2.3） */
  complete: boolean;
  /** 読み込めなかったページ数。complete が true なら 0 */
  failedPages: number;
};

/** 追加画面の候補の 1 行（C5 の AddCandidate） */
export type AddCandidate = {
  /** addComponent に渡す値（その行のチェック欄の値） */
  componentKey: string;
  name: string;
  parentObject: string | null;
  /** 追加画面の種類の選択肢の表示名 */
  typeLabel: string;
};

export type AddCandidates = {
  candidates: AddCandidate[];
  complete: boolean;
  failedPages: number;
};

/** 1 件の追加の頼み（C5 の addComponent の入力） */
export type AddRequest = {
  changeSetId: string;
  /** 追加画面の種類の選択肢の値 */
  componentType: string;
  componentKey: string;
};

export type ListComponentsRequest = {
  changeSetId: string;
  /** 1 ページ読むごとに呼ばれる。中で起きた例外は読み込みを止めない */
  onProgress?: (progress: LoadProgress) => void;
};

export type { LoadProgress };
