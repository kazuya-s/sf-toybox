/**
 * Requests from the toolbar popup to the page (rules.md BR1.2-BR1.4, performance-design.md §2).
 * - Uses only the id from chrome.tabs.query (never reads the URL; no tabs permission needed; BR4.2)
 * - Times out sftoybox/page-info after 3 seconds and sftoybox/changeset/components after 5 minutes
 * - Uses progress only from this extension, the current tab and the requested changeSetId (NFR7.2)
 * - Validates received values against the expected shape before use (they cross a boundary)
 */
import type { ChangeSetComponents, LoadProgress } from '../changeset';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../page/channels';
import { PAGE_INFO_CHANNEL } from '../page/page-info-responder';
import { APP_ERROR_KINDS, fail, type Result } from '../shared/result';
import type { ComponentsResult } from './types';

/** How long to wait for the page detection answer (BR1.2) */
export const PAGE_INFO_TIMEOUT_MS = 3_000;
/** How long to wait for the component list response (BR1.4) */
export const COMPONENTS_TIMEOUT_MS = 5 * 60_000;

export type PageCheck = { kind: 'detail'; changeSetId: string } | { kind: 'wrong-page' };

type SendOutcome =
  { kind: 'response'; response: unknown } | { kind: 'failed' } | { kind: 'timeout' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** ID of the active tab; null if there is none */
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

/** Sends a message to a tab and returns the answer, an immediate failure or a timeout */
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
        // No receiving frame, closed without answering, etc. are reported via lastError
        if (chrome.runtime.lastError) settle({ kind: 'failed' });
        else settle({ kind: 'response', response });
      });
    } catch {
      settle({ kind: 'failed' });
    }
  });
}

/** Asks for the page detection. Anything but the detail page is wrong-page (BR1.2) */
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

/** Whether this is a C4 response */
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

/** Creates the progress listener. Uses only this extension, the current tab and the requested changeSetId */
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
 * Requests the component list (BR1.3, BR1.4). Registers the progress listener first and removes it at the end.
 * Returns notFound if sending fails immediately, or timeout if no response arrives within 5 minutes.
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
