/**
 * ツールバーの画面からページ側への問い合わせ（rules.md BR1.2〜BR1.4、performance-design.md §2）。
 * - タブは chrome.tabs.query の結果の id だけを使う（URL は読まない。tabs の権限を求めない。BR4.2）
 * - sftoybox/page-info は 3 秒、sftoybox/changeset/components は 5 分で打ち切る
 * - 進み具合は、この拡張機能・今のタブ・頼んだ changeSetId のものだけを使う（NFR7.2）
 * - 受け取った値は、決めた形かどうかを確かめてから使う（拡張機能の外との境目のため）
 */
import type { ChangeSetComponents, LoadProgress } from '../changeset';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../page/channels';
import { PAGE_INFO_CHANNEL } from '../page/page-info-responder';
import { APP_ERROR_KINDS, fail, type Result } from '../shared/result';
import type { ComponentsResult } from './types';

/** 画面の判定の答えを待つ時間（BR1.2） */
export const PAGE_INFO_TIMEOUT_MS = 3_000;
/** 一覧の返事を待つ時間（BR1.4） */
export const COMPONENTS_TIMEOUT_MS = 5 * 60_000;

export type PageCheck = { kind: 'detail'; changeSetId: string } | { kind: 'wrong-page' };

type SendOutcome =
  { kind: 'response'; response: unknown } | { kind: 'failed' } | { kind: 'timeout' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** アクティブなタブの ID。タブがなければ null */
export function getActiveTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const id = tabs?.[0]?.id;
        resolve(typeof id === 'number' ? id : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** タブにメッセージを送り、答え・すぐの失敗・時間切れのどれかを返す */
function sendToTab(tabId: number, message: unknown, timeoutMs: number): Promise<SendOutcome> {
  return new Promise((resolve) => {
    let isSettled = false;
    const settle = (outcome: SendOutcome) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const timer = setTimeout(() => settle({ kind: 'timeout' }), timeoutMs);
    try {
      chrome.tabs.sendMessage(tabId, message, (response: unknown) => {
        // 受け取るフレームがない・答えずに閉じた などは lastError で知らされる
        if (chrome.runtime.lastError) settle({ kind: 'failed' });
        else settle({ kind: 'response', response });
      });
    } catch {
      settle({ kind: 'failed' });
    }
  });
}

/** 画面の判定を問い合わせる。詳細画面でなければ wrong-page（BR1.2） */
export async function askPageInfo(tabId: number): Promise<PageCheck> {
  const outcome = await sendToTab(tabId, { channel: PAGE_INFO_CHANNEL }, PAGE_INFO_TIMEOUT_MS);
  if (outcome.kind !== 'response' || !isRecord(outcome.response)) return { kind: 'wrong-page' };
  const { ok, value } = outcome.response;
  if (ok !== true || !isRecord(value)) return { kind: 'wrong-page' };
  const changeSetId = value.changeSetId;
  if (
    value.pageKind !== 'outboundChangeSetDetail' ||
    typeof changeSetId !== 'string' ||
    !changeSetId
  ) {
    return { kind: 'wrong-page' };
  }
  return { kind: 'detail', changeSetId };
}

function isLoadProgress(value: unknown): value is LoadProgress {
  return (
    isRecord(value) &&
    typeof value.loadedPages === 'number' &&
    (value.totalPages === null || typeof value.totalPages === 'number')
  );
}

function isComponent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.componentType === 'string' &&
    typeof value.apiName === 'string' &&
    (value.parentObject === null || typeof value.parentObject === 'string')
  );
}

function isComponents(value: unknown): value is ChangeSetComponents {
  return (
    isRecord(value) &&
    isRecord(value.changeSet) &&
    typeof value.changeSet.name === 'string' &&
    Array.isArray(value.components) &&
    value.components.every(isComponent) &&
    typeof value.complete === 'boolean' &&
    typeof value.failedPages === 'number'
  );
}

/** C4 の返事の形か */
function toComponentsResult(response: unknown): ComponentsResult {
  if (isRecord(response) && response.ok === true && isComponents(response.value)) {
    return { ok: true, value: response.value };
  }
  if (isRecord(response) && response.ok === false && isRecord(response.error)) {
    const kind = response.error.kind;
    const known = (APP_ERROR_KINDS as readonly unknown[]).includes(kind);
    if (known) return fail(kind as (typeof APP_ERROR_KINDS)[number], 'page side returned an error');
  }
  return fail('unexpectedResponse', 'page side returned an unexpected response');
}

/** 進み具合の聞き手を作る。この拡張機能・今のタブ・頼んだ changeSetId のものだけを使う */
function createProgressListener(
  tabId: number,
  changeSetId: string,
  onProgress: (progress: LoadProgress) => void,
) {
  return (message: unknown, sender: chrome.runtime.MessageSender): boolean => {
    if (sender.id !== chrome.runtime.id || sender.tab?.id !== tabId) return false;
    if (!isRecord(message) || message.channel !== CHANGESET_PROGRESS_CHANNEL) return false;
    if (message.changeSetId !== changeSetId || !isLoadProgress(message.progress)) return false;
    onProgress(message.progress);
    return false;
  };
}

/**
 * 一覧を頼む（BR1.3、BR1.4）。進み具合の聞き手を先に登録し、終わったら外す。
 * 送信がすぐに失敗したら notFound、5 分で返事がなければ timeout の失敗を返す。
 */
export async function requestComponents(
  tabId: number,
  changeSetId: string,
  onProgress: (progress: LoadProgress) => void,
): Promise<Result<ChangeSetComponents>> {
  const listener = createProgressListener(tabId, changeSetId, onProgress);
  chrome.runtime.onMessage.addListener(listener);
  try {
    const outcome = await sendToTab(
      tabId,
      { channel: CHANGESET_COMPONENTS_CHANNEL, changeSetId },
      COMPONENTS_TIMEOUT_MS,
    );
    if (outcome.kind === 'failed') {
      return fail('notFound', 'no receiver for the components request');
    }
    if (outcome.kind === 'timeout') {
      return fail('timeout', 'no response for the components request');
    }
    return toComponentsResult(outcome.response);
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
  }
}
