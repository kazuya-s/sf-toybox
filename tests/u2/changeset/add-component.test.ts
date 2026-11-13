import { beforeEach, describe, expect, it } from 'vitest';
import { addComponent } from '../../../src/changeset/add-component';
import { ERROR_MESSAGES } from '../../../src/salesforce/markers';
import type { Result } from '../../../src/shared/result';
import { html, installFetchMock, networkError, redirect } from '../helpers/fetch-mock';
import { TEST_CHANGE_SET_ID, readFixture, useSalesforceLocation } from '../helpers/location';
import { ADD_FORM_ACTION, ADD_PAGE_1, ADD_PAGE_2, DETAIL_PAGE_1 } from '../helpers/paths';

const changeSetId = TEST_CHANGE_SET_ID;
/** add-page2.html にある Field_C__c のチェック欄の値 */
const FIELD_C_KEY = '00N000000000003';
const request = { changeSetId, componentType: 'CustomField', componentKey: FIELD_C_KEY };

function routeAddPages() {
  return installFetchMock()
    .route(ADD_PAGE_1, html(readFixture('add-page1.html')))
    .route(ADD_PAGE_2, html(readFixture('add-page2.html')));
}

function errorOf<T>(result: Result<T>) {
  if (result.ok) throw new Error('失敗を期待しました');
  return result.error;
}

describe('1 件の追加（addComponent、BR3.2〜BR3.5）', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('送る内容: POST の本文は、隠し項目・「追加」ボタン・選んだ 1 件のチェック欄だけ（NFR3.2）', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-after-add.html')));

    await addComponent(request);

    const post = mock.calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe(ADD_FORM_ACTION);
    expect([...new URLSearchParams(post?.body ?? '')]).toEqual([
      ['id', 'test-changeset'],
      ['_CONFIRMATIONTOKEN', 'test-token-2'],
      ['viewState', 'test-viewstate-2'],
      ['save', '変更セットに追加'],
      ['ids', FIELD_C_KEY],
    ]);
  });

  it('2 ページ目にある行を見つけて送り、読み直しで見つかれば成功', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, html(readFixture('add-page1.html')), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-after-add.html')));

    const result = await addComponent(request);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mock.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET ${ADD_PAGE_1}`,
      `GET ${ADD_PAGE_2}`,
      `POST ${ADD_FORM_ACTION}`,
      `GET ${DETAIL_PAGE_1}`,
    ]);
  });

  it('どのページにもないときは、送らずに notFound を返す（BR3.5）', async () => {
    const mock = routeAddPages();

    const missing = await addComponent({ ...request, componentKey: '00N000000000009' });
    const invalid = await addComponent({ ...request, componentKey: '' });

    expect(errorOf(missing)).toEqual({
      kind: 'notFound',
      message: ERROR_MESSAGES.candidateNotFound,
      detail: null,
    });
    expect(errorOf(invalid).message).toBe(ERROR_MESSAGES.invalidRequest);
    expect(mock.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('途中のページが読めないときは、notFound ではなくその種類の失敗を返す', async () => {
    const mock = installFetchMock()
      .route(ADD_PAGE_1, html(readFixture('add-page1.html')))
      .route(ADD_PAGE_2, redirect());

    const result = await addComponent(request);

    expect(errorOf(result).kind).toBe('sessionExpired');
    expect(mock.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('二重送信: 同じ (changeSetId, componentKey) で続けて 2 回頼んでも、POST は 1 回（NFR3.3）', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-after-add.html')));

    const [first, second] = await Promise.all([addComponent(request), addComponent(request)]);
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(1);
    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toBe(first);

    // 終わったあとは表から外れているので、次の頼みは新しく送る
    await addComponent(request);
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(2);
  });

  it('POST が失敗しても送り直さず、読み直しもしない', async () => {
    const mock = routeAddPages().route(ADD_FORM_ACTION, networkError(), 'POST');

    const result = await addComponent(request);

    expect(errorOf(result).kind).toBe('network');
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(1);
    expect(mock.count(DETAIL_PAGE_1)).toBe(0);
  });

  it('読み直しで見つからなければ unexpectedResponse（確かめられなかった）を返す（BR3.3）', async () => {
    routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-single.html')));

    const result = await addComponent(request);

    expect(errorOf(result)).toEqual({
      kind: 'unexpectedResponse',
      message: ERROR_MESSAGES.addNotConfirmed,
      detail: null,
    });
  });

  it('転送とログイン切れ: POST への転送は読み直しへ進み、読み直しの GET が転送ならログイン切れ（BR1.4）', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, redirect());

    const result = await addComponent(request);

    expect(errorOf(result).kind).toBe('sessionExpired');
    expect(mock.count(DETAIL_PAGE_1)).toBe(1);
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(1);
  });
});
