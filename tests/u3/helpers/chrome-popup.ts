/**
 * chrome mock for U3 tests (unit-test-instructions.md "Mock and stub rules").
 * Adds the following to the U1 mock in tests/u1/helpers/chrome-mock.ts:
 * - chrome.tabs.query (the active tab) and chrome.tabs.sendMessage
 *   (per channel: answer, answer late, never answer, fail immediately, or deliver to page-side listeners)
 * - chrome.runtime.sendMessage (page -> popup progress; failures switchable)
 * - chrome.runtime.openOptionsPage
 * Registering and removing onMessage listeners reuses the U1 mock's list as is.
 */
import { beforeEach } from 'vitest';
import {
  TEST_EXTENSION_ID,
  chromeMock,
  dispatchRuntimeMessage,
} from '../../u1/helpers/chrome-mock';

export { TEST_EXTENSION_ID };

/** Active tab ID used in tests */
export const ACTIVE_TAB_ID = 7;

/** Behavior of chrome.tabs.sendMessage */
export type TabMessageBehavior =
  /** Deliver to page-side listeners (chrome.runtime.onMessage) and return their answer */
  | { kind: 'deliver' }
  /** Return a fixed answer (delayed by delayMs) */
  | { kind: 'respond'; response: unknown; delayMs?: number }
  /** Never answer (the callback is never called) */
  | { kind: 'silent' }
  /** Fail immediately (chrome.runtime.lastError) */
  | { kind: 'fail'; message?: string };

/** How chrome.runtime.sendMessage fails */
export type RuntimeSendFailure = 'none' | 'lastError' | 'throw';

export type SentTabMessage = { tabId: number; message: unknown };

type PopupMockState = {
  activeTabs: chrome.tabs.Tab[];
  queryInfos: chrome.tabs.QueryInfo[];
  behaviors: Map<string, TabMessageBehavior>;
  tabMessages: SentTabMessage[];
  runtimeMessages: unknown[];
  runtimeSendFailure: RuntimeSendFailure;
  openOptionsPageCalls: number;
};

function makeTab(id: number): chrome.tabs.Tab {
  return { id, active: true } as chrome.tabs.Tab;
}

function createState(): PopupMockState {
  return {
    activeTabs: [makeTab(ACTIVE_TAB_ID)],
    queryInfos: [],
    behaviors: new Map(),
    tabMessages: [],
    runtimeMessages: [],
    runtimeSendFailure: 'none',
    openOptionsPageCalls: 0,
  };
}

let state = createState();

function channelOf(message: unknown): string {
  if (typeof message !== 'object' || message === null) return '';
  const channel = (message as { channel?: unknown }).channel;
  return typeof channel === 'string' ? channel : '';
}

/** Like Chrome, exposes lastError only inside the callback */
function withLastError(message: string, callback: () => void): void {
  chromeMock.runtime.lastError = { message };
  try {
    callback();
  } finally {
    chromeMock.runtime.lastError = undefined;
  }
}

/** Delivers to page-side listeners. If none answers, reports it via lastError like Chrome */
function deliverToPage(message: unknown, callback: (response: unknown) => void) {
  const sender = { id: TEST_EXTENSION_ID } as chrome.runtime.MessageSender;
  void dispatchRuntimeMessage(message, sender).then((response) => {
    if (response === undefined) {
      withLastError('The message port closed before a response was received.', () =>
        callback(undefined),
      );
      return;
    }
    callback(response);
  });
}

const tabs = {
  query(queryInfo: chrome.tabs.QueryInfo, callback: (result: chrome.tabs.Tab[]) => void): void {
    state.queryInfos.push(queryInfo);
    const result = state.activeTabs;
    queueMicrotask(() => callback(result));
  },
  sendMessage(tabId: number, message: unknown, callback: (response: unknown) => void): void {
    state.tabMessages.push({ tabId, message });
    const behavior = state.behaviors.get(channelOf(message)) ?? { kind: 'deliver' };
    switch (behavior.kind) {
      case 'respond':
        setTimeout(() => callback(behavior.response), behavior.delayMs ?? 0);
        return;
      case 'silent':
        return;
      case 'fail':
        queueMicrotask(() =>
          withLastError(
            behavior.message ?? 'Could not establish connection. Receiving end does not exist.',
            () => callback(undefined),
          ),
        );
        return;
      case 'deliver':
        deliverToPage(message, callback);
        return;
    }
  },
};

function sendRuntimeMessage(message: unknown, callback?: () => void): void {
  state.runtimeMessages.push(message);
  if (state.runtimeSendFailure === 'throw') throw new Error('Extension context invalidated.');
  if (state.runtimeSendFailure === 'lastError') {
    queueMicrotask(() =>
      withLastError('Could not establish connection. Receiving end does not exist.', () =>
        callback?.(),
      ),
    );
    return;
  }
  // Delivered to the popup listeners as if sent from the page side (the active tab)
  const sender = {
    id: TEST_EXTENSION_ID,
    tab: makeTab(ACTIVE_TAB_ID),
  } as chrome.runtime.MessageSender;
  void dispatchRuntimeMessage(message, sender).then(() => callback?.());
}

function openOptionsPage(): Promise<void> {
  state.openOptionsPageCalls += 1;
  return Promise.resolve();
}

type ExtendedChrome = typeof chromeMock & {
  tabs: typeof tabs;
  runtime: typeof chromeMock.runtime & {
    sendMessage: typeof sendRuntimeMessage;
    openOptionsPage: typeof openOptionsPage;
  };
};

/** Adds tabs, runtime.sendMessage and openOptionsPage to the U1 mock and resets the state */
export function installPopupChromeMock(): void {
  state = createState();
  const extended = chromeMock as ExtendedChrome;
  extended.tabs = tabs;
  extended.runtime.sendMessage = sendRuntimeMessage;
  extended.runtime.openOptionsPage = openOptionsPage;
}

beforeEach(() => {
  installPopupChromeMock();
});

export function popupState(): PopupMockState {
  return state;
}

/** Sets the chrome.tabs.sendMessage behavior per channel */
export function setTabMessageBehavior(channel: string, behavior: TabMessageBehavior): void {
  state.behaviors.set(channel, behavior);
}

export function setRuntimeSendFailure(failure: RuntimeSendFailure): void {
  state.runtimeSendFailure = failure;
}

/** Tabs returned by tabs.query (empty means there is no tab) */
export function setActiveTabs(tabIds: number[]): void {
  state.activeTabs = tabIds.map(makeTab);
}

/** Delivers progress and the like to the popup listeners from a chosen sender */
export function emitToPopup(
  message: unknown,
  sender: { id?: string; tabId?: number } = {},
): Promise<unknown> {
  const tabId = sender.tabId ?? ACTIVE_TAB_ID;
  return dispatchRuntimeMessage(message, {
    id: sender.id ?? TEST_EXTENSION_ID,
    tab: makeTab(tabId),
  } as chrome.runtime.MessageSender);
}
