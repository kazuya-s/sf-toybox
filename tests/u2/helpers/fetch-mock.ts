/**
 * fetch stub (unit-test-instructions.md "Mock and stub rules").
 * Responses are defined per path. A call to an undefined path fails the test.
 * Never connects to a real org.
 */
import { onTestFinished, vi } from 'vitest';

/** How a response is defined */
export type MockReply =
  | { kind: 'html'; status: number; body: string }
  | { kind: 'redirect' }
  | { kind: 'networkError' }
  | { kind: 'hangHeaders' }
  | { kind: 'hangBody' };

export type RecordedCall = {
  /** Full destination URL */
  url: string;
  /** pathname and search */
  path: string;
  method: string;
  /** POST body (URLSearchParams as a string) */
  body: string | null;
  credentials: string | undefined;
  redirect: string | undefined;
};

type ReplySource = MockReply | MockReply[] | ((call: RecordedCall) => MockReply);

export type FetchMock = {
  calls: RecordedCall[];
  /** Calls to undefined paths */
  unmatched: string[];
  /** Maximum number of fetches running at once */
  readonly maxConcurrent: number;
  /** Defines a path's response. With method, it is used only for calls with that method */
  route(path: string, reply: ReplySource, method?: 'GET' | 'POST'): FetchMock;
  /** Response used when no defined path matches. Returning null makes it an "undefined destination" */
  fallback(reply: (call: RecordedCall) => MockReply | null): FetchMock;
  /** Number of calls whose destination was a path in this org */
  count(path: string, method?: 'GET' | 'POST'): number;
};

export function html(body: string, status = 200): MockReply {
  return { kind: 'html', status, body };
}

export function redirect(): MockReply {
  return { kind: 'redirect' };
}

export function networkError(): MockReply {
  return { kind: 'networkError' };
}

/** Response headers never arrive */
export function hangHeaders(): MockReply {
  return { kind: 'hangHeaders' };
}

/** Headers arrive but the body never does */
export function hangBody(): MockReply {
  return { kind: 'hangBody' };
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function waitForAbort(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (!signal) return;
    if (signal.aborted) reject(abortError());
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
  });
}

function bodyToString(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  return String(body);
}

/** Replaces fetch. Call inside a test; it is restored when the test ends */
export function installFetchMock(): FetchMock {
  const routes = new Map<string, ReplySource>();
  const used = new Map<string, number>();
  let active = 0;
  let maxConcurrent = 0;
  let fallbackReply: ((call: RecordedCall) => MockReply | null) | null = null;

  const mock: FetchMock = {
    calls: [],
    unmatched: [],
    get maxConcurrent() {
      return maxConcurrent;
    },
    route(path, reply, method) {
      routes.set(method ? `${method} ${path}` : path, reply);
      return mock;
    },
    fallback(reply) {
      fallbackReply = reply;
      return mock;
    },
    count(path, method) {
      return mock.calls.filter((call) => call.path === path && (!method || call.method === method))
        .length;
    },
  };

  function pickReply(call: RecordedCall): MockReply | null {
    const key = routes.has(`${call.method} ${call.path}`)
      ? `${call.method} ${call.path}`
      : call.path;
    const source = routes.get(key);
    if (!source) return fallbackReply ? fallbackReply(call) : null;
    if (typeof source === 'function') return source(call);
    if (!Array.isArray(source)) return source;
    const index = used.get(key) ?? 0;
    used.set(key, index + 1);
    return source[Math.min(index, source.length - 1)] ?? null;
  }

  const finish = () => {
    active -= 1;
  };

  const fetchMock = async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const call: RecordedCall = {
      url: url.href,
      path: `${url.pathname}${url.search}`,
      method: (init.method ?? 'GET').toUpperCase(),
      body: bodyToString(init.body),
      credentials: init.credentials,
      redirect: init.redirect,
    };
    mock.calls.push(call);
    active += 1;
    maxConcurrent = Math.max(maxConcurrent, active);
    await Promise.resolve();

    const reply = pickReply(call);
    if (!reply) {
      mock.unmatched.push(`${call.method} ${call.url}`);
      finish();
      throw new TypeError('Failed to fetch');
    }
    switch (reply.kind) {
      case 'networkError':
        finish();
        throw new TypeError('Failed to fetch');
      case 'redirect':
        finish();
        return { type: 'opaqueredirect', status: 0, url: '', ok: false } as unknown as Response;
      case 'hangHeaders':
        return waitForAbort(init.signal).finally(finish);
      case 'hangBody':
        return {
          type: 'basic',
          status: 200,
          url: url.href,
          ok: true,
          text: () => waitForAbort(init.signal).finally(finish),
        } as unknown as Response;
      case 'html':
        return {
          type: 'basic',
          status: reply.status,
          url: url.href,
          ok: reply.status >= 200 && reply.status < 300,
          text: async () => {
            await Promise.resolve();
            finish();
            return reply.body;
          },
        } as unknown as Response;
    }
  };

  vi.stubGlobal('fetch', vi.fn(fetchMock));
  onTestFinished(() => {
    vi.unstubAllGlobals();
    if (mock.unmatched.length > 0) {
      throw new Error(`An undefined destination was called: ${mock.unmatched.join(', ')}`);
    }
  });
  return mock;
}
