import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPage, request } from '../../../src/salesforce/connection';
import { ERROR_MESSAGES, REQUEST_TIMEOUT_MS } from '../../../src/salesforce/markers';
import type { Result } from '../../../src/shared/result';
import {
  hangBody,
  hangHeaders,
  html,
  installFetchMock,
  networkError,
  redirect,
} from '../helpers/fetch-mock';
import { TEST_ORIGIN, readFixture, useSalesforceLocation } from '../helpers/location';

const PAGE = '/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2000000000001';

function errorOf<T>(result: Result<T>) {
  if (result.ok) throw new Error('失敗を期待しました');
  return result.error;
}

describe('Salesforce とのやり取り（connection、BR1.1〜BR1.4、BR1.7）', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('送り先の確かめ: 組織の外や形の違う送り先には送らず unexpectedResponse を返す（NFR1.1、NFR1.4）', async () => {
    const mock = installFetchMock();
    const formBase = `${TEST_ORIGIN}/p/mfpkg/AddToPackageFromChangeMgmtUi`;
    const rejected = [
      { path: 'changemgmt/page' },
      { path: '//evil.example.com/x' },
      { path: '/\\evil.example.com/x' },
      { path: 'https://evil.example.com/x' },
      { path: `${TEST_ORIGIN}/same-org-absolute` },
      { path: 'javascript:alert(1)' },
      { path: 'https://evil.example.com/steal', base: formBase },
      { path: 'javascript:alert(1)', base: formBase },
      { path: 'http://example.my.salesforce.com/plain-http', base: formBase },
      { path: '/x', base: 'not a url' },
    ];

    for (const destination of rejected) {
      const result = await request({ ...destination, method: 'POST', formFields: [] });
      expect(errorOf(result)).toEqual({
        kind: 'unexpectedResponse',
        message: ERROR_MESSAGES.invalidDestination,
        detail: null,
      });
    }
    expect(mock.calls).toEqual([]);
  });

  it('同じ組織へは credentials: same-origin、redirect: manual で送り、フォームの送り先は画面の URL を基準に解く（NFR2.2）', async () => {
    const mock = installFetchMock()
      .route(PAGE, html(readFixture('detail-single.html')))
      .route('/p/mfpkg/add', redirect(), 'POST');

    const page = await getPage(PAGE);
    const posted = await request({
      path: 'add',
      base: `${TEST_ORIGIN}/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2000000000001`,
      method: 'POST',
      formFields: [
        { name: 'token', value: 'test-token' },
        { name: 'ids', value: '01p000000000001' },
      ],
    });

    expect(page.ok && page.value.url).toBe(`${TEST_ORIGIN}${PAGE}`);
    expect(page.ok && page.value.page.text('h2.pageDescription')).toBe('TestChangeSet');
    expect(posted).toEqual({ ok: true, value: { redirected: true } });
    expect(
      mock.calls.map(({ method, credentials, redirect: mode }) => [method, credentials, mode]),
    ).toEqual([
      ['GET', 'same-origin', 'manual'],
      ['POST', 'same-origin', 'manual'],
    ]);
    expect(mock.calls[0]?.body).toBeNull();
    expect(mock.calls[1]?.body).toBe('token=test-token&ids=01p000000000001');
  });

  it('転送とログイン切れ: GET への転送は sessionExpired、POST への転送は成功（BR1.4）', async () => {
    installFetchMock().route(PAGE, redirect());

    const got = await request({ path: PAGE, method: 'GET' });
    const page = await getPage(PAGE);
    const posted = await request({ path: PAGE, method: 'POST' });

    expect(errorOf(got)).toEqual({
      kind: 'sessionExpired',
      message: ERROR_MESSAGES.redirected,
      detail: null,
    });
    expect(errorOf(page).kind).toBe('sessionExpired');
    expect(posted).toEqual({ ok: true, value: { redirected: true } });
  });

  it('ログイン画面・権限の画面・403・404・データなし・500 をそれぞれの種類に見分ける', async () => {
    installFetchMock()
      .route('/login-page', html(readFixture('login.html')))
      .route('/denied-page', html(readFixture('permission-denied.html')))
      .route('/forbidden', html('<p>forbidden</p>', 403))
      .route('/missing', html('<p>missing</p>', 404))
      .route('/no-data', html(readFixture('not-found.html')))
      .route('/server-error', html('<p>error</p>', 500))
      .route('/moved', html('', 302));

    const kinds = [];
    for (const path of [
      '/login-page',
      '/denied-page',
      '/forbidden',
      '/missing',
      '/no-data',
      '/server-error',
      '/moved',
    ]) {
      kinds.push(errorOf(await request({ path, method: 'GET' })).kind);
    }

    expect(kinds).toEqual([
      'sessionExpired',
      'permissionDenied',
      'permissionDenied',
      'notFound',
      'notFound',
      'unexpectedResponse',
      'sessionExpired',
    ]);
  });

  it('通信の失敗は network で返し、送り直さない', async () => {
    const mock = installFetchMock().route(PAGE, networkError());

    const result = await request({ path: PAGE, method: 'GET' });

    expect(errorOf(result)).toEqual({
      kind: 'network',
      message: ERROR_MESSAGES.network,
      detail: null,
    });
    expect(mock.calls).toHaveLength(1);
  });

  it('30 秒の打ち切り: 応答も本文も、来なければ 30 秒で timeout になる（NFR5.2）', async () => {
    vi.useFakeTimers();
    installFetchMock().route('/no-headers', hangHeaders()).route('/no-body', hangBody());

    for (const path of ['/no-headers', '/no-body']) {
      let settled: Result<unknown> | null = null;
      const pending = request({ path, method: 'GET' }).then((result) => {
        settled = result;
        return result;
      });

      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
      expect(settled).toBeNull();
      await vi.advanceTimersByTimeAsync(1);

      expect(errorOf(await pending)).toEqual({
        kind: 'timeout',
        message: ERROR_MESSAGES.timeout,
        detail: null,
      });
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('失敗を Result で返す: 中で例外が起きても外に出ない（NFR5.1）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('unexpected');
      }),
    );
    try {
      const thrown = await request({ path: PAGE, method: 'GET' });
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            type: 'basic',
            status: 200,
            text: () => Promise.reject(new Error('broken body')),
          }),
        ),
      );
      const broken = await request({ path: PAGE, method: 'GET' });

      expect(errorOf(thrown).kind).toBe('unexpectedResponse');
      expect(errorOf(broken).kind).toBe('unexpectedResponse');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('AppError の中身: message は決めた識別子だけで、detail は null。失敗しても送り直さない（NFR1.3）', async () => {
    const mock = installFetchMock().route(PAGE, html('<p>TestChangeSet secret</p>', 500));
    const allowed = new Set<string>(Object.values(ERROR_MESSAGES));

    const result = await request({ path: PAGE, method: 'GET' });
    const error = errorOf(result);

    expect(allowed.has(error.message)).toBe(true);
    expect(error.message).not.toContain('TestChangeSet');
    expect(error.message).not.toContain(TEST_ORIGIN);
    expect(error.detail).toBeNull();
    expect(mock.count(PAGE)).toBe(1);
  });
});
