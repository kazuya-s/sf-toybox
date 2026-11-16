/**
 * Hand-written chrome mock for tests (unit-test-instructions.md "Mocks and stubs").
 * Replaces storage.local (switchable success/failure), storage.sync (records calls),
 * runtime (id, onMessage, getURL) and i18n (getMessage reading _locales, getUILanguage).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TEST_EXTENSION_ID = 'sftoybox-test-extension-id';

/** How a call fails: lastError is a failure Chrome reports in the callback, throw is the call itself throwing */
export type StorageFailureMode = 'none' | 'lastError' | 'throw';

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

type ChromeMockState = {
  local: Record<string, unknown>;
  getFailure: StorageFailureMode;
  setFailure: StorageFailureMode;
  localGetCalls: number;
  localSetCalls: unknown[];
  syncCalls: string[];
  uiLanguage: string;
  messageListeners: MessageListener[];
  externalListeners: unknown[];
};

function createState(): ChromeMockState {
  return {
    local: {},
    getFailure: 'none',
    setFailure: 'none',
    localGetCalls: 0,
    localSetCalls: [],
    syncCalls: [],
    uiLanguage: 'ja',
    messageListeners: [],
    externalListeners: [],
  };
}

let state = createState();

type LocaleMessages = Record<string, { message: string }>;
const localeCache = new Map<string, LocaleMessages>();

export function readLocaleMessages(locale: 'ja' | 'en'): LocaleMessages {
  const cached = localeCache.get(locale);
  if (cached) return cached;
  const path = resolve(process.cwd(), 'public/_locales', locale, 'messages.json');
  const messages = JSON.parse(readFileSync(path, 'utf8')) as LocaleMessages;
  localeCache.set(locale, messages);
  return messages;
}

function currentLocale(): 'ja' | 'en' {
  return state.uiLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function withLastError(message: string, callback: () => void): void {
  runtime.lastError = { message };
  try {
    callback();
  } finally {
    runtime.lastError = undefined;
  }
}

function pickItems(keys: unknown): Record<string, unknown> {
  if (keys === null || keys === undefined) return clone(state.local);
  const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
  const items: Record<string, unknown> = {};
  for (const key of list as string[]) {
    if (key in state.local) items[key] = clone(state.local[key]);
  }
  return items;
}

const local = {
  get(keys: unknown, callback: (items: Record<string, unknown>) => void): void {
    state.localGetCalls += 1;
    if (state.getFailure === 'throw') throw new Error('Extension context invalidated.');
    queueMicrotask(() => {
      if (state.getFailure === 'lastError') {
        withLastError('storage get failed', () => callback({}));
        return;
      }
      callback(pickItems(keys));
    });
  },
  set(items: Record<string, unknown>, callback: () => void): void {
    state.localSetCalls.push(clone(items));
    if (state.setFailure === 'throw') throw new Error('Extension context invalidated.');
    queueMicrotask(() => {
      if (state.setFailure === 'lastError') {
        withLastError('QUOTA_BYTES quota exceeded', callback);
        return;
      }
      Object.assign(state.local, clone(items));
      callback();
    });
  },
};

function recordSync(name: string) {
  return (...args: unknown[]) => {
    state.syncCalls.push(name);
    const callback = args.find((arg) => typeof arg === 'function') as (() => void) | undefined;
    callback?.();
    return Promise.resolve({});
  };
}

const sync = {
  get: recordSync('get'),
  set: recordSync('set'),
  remove: recordSync('remove'),
  clear: recordSync('clear'),
};

const runtime: {
  id: string;
  lastError: { message: string } | undefined;
  getURL: (path: string) => string;
  onMessage: {
    addListener: (listener: MessageListener) => void;
    removeListener: (listener: MessageListener) => void;
    hasListener: (listener: MessageListener) => boolean;
  };
  onMessageExternal: { addListener: (listener: unknown) => void };
} = {
  id: TEST_EXTENSION_ID,
  lastError: undefined,
  getURL: (path: string) => `chrome-extension://${TEST_EXTENSION_ID}/${path.replace(/^\//, '')}`,
  onMessage: {
    addListener: (listener) => {
      state.messageListeners.push(listener);
    },
    removeListener: (listener) => {
      state.messageListeners = state.messageListeners.filter((item) => item !== listener);
    },
    hasListener: (listener) => state.messageListeners.includes(listener),
  },
  onMessageExternal: {
    addListener: (listener) => {
      state.externalListeners.push(listener);
    },
  },
};

const i18n = {
  getMessage(name: string): string {
    const own = readLocaleMessages(currentLocale())[name];
    if (own) return own.message;
    // Like Chrome: fall back to the default locale (en) when missing, then to an empty string
    return readLocaleMessages('en')[name]?.message ?? '';
  },
  getUILanguage(): string {
    return state.uiLanguage;
  },
};

export const chromeMock = { runtime, storage: { local, sync }, i18n };

export function installChromeMock(): void {
  (globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
}

/** Resets everything for each test */
export function resetChromeMock(): void {
  state = createState();
  runtime.lastError = undefined;
}

export function mockState(): ChromeMockState {
  return state;
}

export function setStorageFailure(options: {
  get?: StorageFailureMode;
  set?: StorageFailureMode;
}): void {
  if (options.get) state.getFailure = options.get;
  if (options.set) state.setFailure = options.set;
}

export function setUiLanguage(language: string): void {
  state.uiLanguage = language;
}

/**
 * Delivers a message to the registered onMessage listeners.
 * Resolves with a listener's answer, or undefined if no listener answers.
 */
export function dispatchRuntimeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender = { id: TEST_EXTENSION_ID },
): Promise<unknown> {
  return new Promise((resolvePromise) => {
    let answered = false;
    let keepsChannelOpen = false;
    const sendResponse = (response?: unknown) => {
      if (answered) return;
      answered = true;
      resolvePromise(response);
    };
    for (const listener of state.messageListeners) {
      if (listener(message, sender, sendResponse) === true) keepsChannelOpen = true;
    }
    if (!answered && !keepsChannelOpen) resolvePromise(undefined);
  });
}
