/**
 * U3 のテスト用の chrome の模擬（unit-test-instructions.md「模擬と差し替えの決まり」）。
 * U1 の tests/u1/helpers/chrome-mock.ts の模擬に、次を足す。
 * - chrome.tabs.query（アクティブなタブ）と chrome.tabs.sendMessage
 *   （答える・遅れて答える・答えない・すぐに失敗する・ページ側の聞き手へ届ける を窓口ごとに切り替える）
 * - chrome.runtime.sendMessage（ページ側 → ツールバーの画面の進み具合。失敗の切り替え）
 * - chrome.runtime.openOptionsPage
 * onMessage の聞き手の登録と外しは、U1 の模擬の一覧をそのまま使う。
 */
import { beforeEach } from 'vitest';
import {
  TEST_EXTENSION_ID,
  chromeMock,
  dispatchRuntimeMessage,
} from '../../u1/helpers/chrome-mock';

export { TEST_EXTENSION_ID };

/** テストで使うアクティブなタブの ID */
export const ACTIVE_TAB_ID = 7;

/** chrome.tabs.sendMessage のふるまい */
export type TabMessageBehavior =
  /** ページ側の聞き手（chrome.runtime.onMessage）へ届け、その答えを返す */
  | { kind: 'deliver' }
  /** 決めた答えを返す（delayMs だけ遅らせる） */
  | { kind: 'respond'; response: unknown; delayMs?: number }
  /** 答えない（コールバックを呼ばない） */
  | { kind: 'silent' }
  /** すぐに失敗する（chrome.runtime.lastError） */
  | { kind: 'fail'; message?: string };

/** chrome.runtime.sendMessage の失敗のしかた */
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

/** Chrome と同じく、コールバックの中だけ lastError を見せる */
function withLastError(message: string, callback: () => void): void {
  chromeMock.runtime.lastError = { message };
  try {
    callback();
  } finally {
    chromeMock.runtime.lastError = undefined;
  }
}

/** ページ側の聞き手へ届ける。どの聞き手も答えなければ、Chrome と同じく lastError で知らせる */
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
  // ページ側（アクティブなタブ）から送られたものとして、ツールバーの画面の聞き手へ届ける
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

/** U1 の模擬に tabs・runtime.sendMessage・openOptionsPage を足し、状態を初めに戻す */
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

/** 窓口ごとに chrome.tabs.sendMessage のふるまいを決める */
export function setTabMessageBehavior(channel: string, behavior: TabMessageBehavior): void {
  state.behaviors.set(channel, behavior);
}

export function setRuntimeSendFailure(failure: RuntimeSendFailure): void {
  state.runtimeSendFailure = failure;
}

/** tabs.query が返すタブ（空にするとタブがない状態） */
export function setActiveTabs(tabIds: number[]): void {
  state.activeTabs = tabIds.map(makeTab);
}

/** ツールバーの画面の聞き手へ、決めた送り元から進み具合などを届ける */
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
