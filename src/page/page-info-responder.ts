/**
 * ポップアップからの画面の問い合わせ（contract-summary.md C3 の sftoybox/page-info）への応答
 * （BR2.6、security-design.md §6、NFR3.5）。
 * - ツールの ON/OFF を読む前に登録する
 * - 判定が other のフレームは答えない（登録もしない）
 * - 自分の拡張機能（sender.id === chrome.runtime.id）から、決めた channel のメッセージにだけ答える
 * - 優先度の低いフレームは答えを遅らせる（詳細 → 追加 → 一覧の順）
 * - onMessageExternal は登録しない
 */
import { recordError } from '../errors/error-log';
import { ok, type Result } from '../shared/result';
import type { PageInfo, PageKind } from './page-context';

export const PAGE_INFO_CHANNEL = 'sftoybox/page-info';

/** 答えるまでの待ち時間（ミリ秒）。小さいほど優先 */
export const RESPONSE_DELAY_MS: Record<Exclude<PageKind, 'other'>, number> = {
  outboundChangeSetDetail: 0,
  outboundChangeSetAdd: 100,
  pageSizeList: 200,
};

export type PageInfoResponse = Result<PageInfo>;

function isPageInfoRequest(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { channel?: unknown }).channel === PAGE_INFO_CHANNEL
  );
}

function safeDetect(detectPage: () => PageInfo): PageInfo | null {
  try {
    return detectPage();
  } catch (error) {
    void recordError(
      { toolId: 'core', kind: 'unexpected', messageKey: 'errorLog.pageDetectFailed' },
      error,
    );
    return null;
  }
}

/**
 * このフレームを判定し、other でなければ問い合わせへの応答を登録する。
 * 判定の結果を返す。判定でエラーが出たときは記録して null を返す（例外は外に出さない）。
 */
export function registerPageInfoResponder(detectPage: () => PageInfo): PageInfo | null {
  const pageInfo = safeDetect(detectPage);
  if (!pageInfo || pageInfo.pageKind === 'other') return pageInfo;

  const delay = RESPONSE_DELAY_MS[pageInfo.pageKind];
  const response: PageInfoResponse = ok(pageInfo);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (!isPageInfoRequest(message)) return false;
    setTimeout(() => sendResponse(response), delay);
    // 遅らせて答えるので、応答の窓口を開けたままにする
    return true;
  });
  return pageInfo;
}
