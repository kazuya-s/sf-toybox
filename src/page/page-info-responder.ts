/**
 * Answers page queries from the popup (sftoybox/page-info of C3 in contract-summary.md)
 * (BR2.6, security-design.md §6, NFR3.5).
 * - Registered before the tool's ON/OFF is read
 * - Frames detected as other never answer (and nothing is registered)
 * - Answers only messages from this extension (sender.id === chrome.runtime.id) on the agreed channel
 * - Lower-priority frames delay their answer (detail -> add -> list)
 * - Never registers onMessageExternal
 */
import { recordError } from '../errors/error-log';
import { ok, type Result } from '../shared/result';
import type { PageInfo, PageKind } from './page-context';

export const PAGE_INFO_CHANNEL = 'sftoybox/page-info';

/** Delay before answering (ms). Smaller means higher priority */
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
 * Detects this frame and, unless it is other, registers the query responder.
 * Returns the detection result. On a detection error, logs it and returns null (never throws).
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
    // Answering after a delay, so keep the response channel open
    return true;
  });
  return pageInfo;
}
