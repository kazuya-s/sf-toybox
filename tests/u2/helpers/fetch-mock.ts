/**
 * fetch の差し替え（unit-test-instructions.md「模擬と差し替えの決まり」）。
 * パスごとに応答を決める。決めていないパスが呼ばれたら、そのテストを失敗させる。
 * 実際の組織にはつながない。
 */
import { onTestFinished, vi } from 'vitest';

/** 応答の決め方 */
export type MockReply =
  | { kind: 'html'; status: number; body: string }
  | { kind: 'redirect' }
  | { kind: 'networkError' }
  | { kind: 'hangHeaders' }
  | { kind: 'hangBody' };

export type RecordedCall = {
  /** 送り先の完全な URL */
  url: string;
  /** pathname と search */
  path: string;
  method: string;
  /** POST の本文（URLSearchParams を文字列にしたもの） */
  body: string | null;
  credentials: string | undefined;
  redirect: string | undefined;
};

type ReplySource = MockReply | MockReply[] | ((call: RecordedCall) => MockReply);

export type FetchMock = {
  calls: RecordedCall[];
  /** 決めていないパスへの呼び出し */
  unmatched: string[];
  /** 同時に走っていた fetch の数の最大 */
  readonly maxConcurrent: number;
  /** パスの応答を決める。method を付けると、その方法の呼び出しだけに使う */
  route(path: string, reply: ReplySource, method?: 'GET' | 'POST'): FetchMock;
  /** 決めたパスに当たらないときに使う応答。null を返すと「決めていない送り先」になる */
  fallback(reply: (call: RecordedCall) => MockReply | null): FetchMock;
  /** 送り先がこの組織のパスだった呼び出しの数 */
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

/** 応答の頭（headers）が来ない */
export function hangHeaders(): MockReply {
  return { kind: 'hangHeaders' };
}

/** 応答の頭は来るが、本文が来ない */
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

/** fetch を差し替える。テストの中で呼び、テストが終わると元に戻す */
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
      throw new Error(`決めていない送り先が呼ばれました: ${mock.unmatched.join(', ')}`);
    }
  });
  return mock;
}
